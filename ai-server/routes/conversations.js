'use strict';

const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const { supabase } = require('../utils/supabase');
const { errorResponse } = require('../utils/errorResponse');
const { buildPrompt } = require('../utils/buildPrompt');
const { authMiddleware } = require('../middleware/auth');
const { turnLimitMiddleware } = require('../middleware/turnLimit');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// GET /api/conversations
router.get('/', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented yet' } });
});

// POST /api/conversations
router.post('/', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented yet' } });
});

// POST /api/conversations/:id/messages
router.post('/:id/messages', authMiddleware, turnLimitMiddleware, async (req, res) => {
  const conversationId = req.params.id;
  const { text } = req.body;

  // 1. Request body 검증
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return errorResponse(res, 400, 'INVALID_REQUEST', 'text 필드가 필요합니다');
  }

  try {
    // 2. Conversation 조회 (본인 소유 확인)
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, topic_id')
      .eq('id', conversationId)
      .eq('user_id', req.user.id)
      .single();

    if (convError || !conversation) {
      return errorResponse(res, 404, 'CONVERSATION_NOT_FOUND', '대화를 찾을 수 없습니다');
    }

    // 3. 시스템 프롬프트 빌드
    const systemPrompt = buildPrompt(conversation.topic_id);

    // 4. 슬라이딩 윈도우: 최근 6턴 메시지 조회
    const { data: recentMessages, error: msgError } = await supabase
      .from('messages')
      .select('id, turn_number, content_type, content')
      .eq('conversation_id', conversationId)
      .in('content_type', ['user_speech', 'ai_turn'])
      .order('turn_number', { ascending: false })
      .limit(6);

    if (msgError) {
      console.error('messages fetch error:', msgError);
      return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
    }

    // 내림차순으로 가져온 뒤 오름차순으로 재정렬
    const historyMessages = (recentMessages || [])
      .reverse()
      .map((msg) => {
        if (msg.content_type === 'user_speech') {
          return { role: 'user', content: msg.content.text };
        }
        return { role: 'assistant', content: JSON.stringify(msg.content) };
      });

    // 5. GPT-4o-mini 호출 (JSON 파싱 실패 시 최대 2회 재시도)
    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: text.trim() },
    ];

    let parsedAiContent = null;
    let lastParseError = null;

    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: openaiMessages,
        });

        const raw = completion.choices[0].message.content;
        parsedAiContent = JSON.parse(raw);
        break;
      } catch (err) {
        lastParseError = err;
        if (attempt < 2) {
          console.warn(`LLM JSON parse attempt ${attempt + 1} failed, retrying...`);
        }
      }
    }

    if (!parsedAiContent) {
      console.error('error_type: json_parse_failure', lastParseError);
      return errorResponse(res, 502, 'LLM_JSON_PARSE_FAILED', 'AI 응답 파싱에 실패했습니다');
    }

    const { feedback, next_response } = parsedAiContent;

    // 6. 현재 최대 turn_number 조회
    const { data: maxTurnData, error: maxTurnError } = await supabase
      .from('messages')
      .select('turn_number')
      .eq('conversation_id', conversationId)
      .order('turn_number', { ascending: false })
      .limit(1);

    if (maxTurnError) {
      console.error('max turn_number fetch error:', maxTurnError);
      return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
    }

    const maxTurnNumber = maxTurnData && maxTurnData.length > 0 ? maxTurnData[0].turn_number : 0;
    const userTurnNumber = maxTurnNumber + 1;

    // 7. 사용자 발화 INSERT
    const { error: userInsertError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      turn_number: userTurnNumber,
      role: 'user',
      content_type: 'user_speech',
      content: { text: text.trim() },
      user_id: req.user.id,
    });

    if (userInsertError) {
      console.error('user message insert error:', userInsertError);
      return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
    }

    // 8. AI 응답 INSERT
    const { data: aiMessage, error: aiInsertError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        turn_number: userTurnNumber + 1,
        role: 'assistant',
        content_type: 'ai_turn',
        content: { feedback, next_response },
        user_id: req.user.id,
      })
      .select('id, turn_number')
      .single();

    if (aiInsertError || !aiMessage) {
      console.error('ai message insert error:', aiInsertError);
      return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
    }

    // 9. 응답
    return res.status(201).json({
      message_id: aiMessage.id,
      turn_number: aiMessage.turn_number,
      content: { feedback, next_response },
    });
  } catch (err) {
    console.error('POST /:id/messages unexpected error:', err);
    return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
  }
});

// GET /api/conversations/:id/messages
router.get('/:id/messages', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented yet' } });
});

module.exports = router;
