'use strict';

const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const { supabase } = require('../utils/supabase');
const { errorResponse } = require('../utils/errorResponse');
const { buildPrompt } = require('../utils/buildPrompt');
const { authMiddleware } = require('../middleware/auth');
const { MISSIONS } = require('../constants/missions');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// GET /api/conversations
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_conversations_with_turns', {
      p_user_id: req.user.id,
    });

    if (error) {
      console.error('get_conversations_with_turns rpc error:', error);
      return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
    }

    return res.status(200).json(data || []);
  } catch (err) {
    console.error('GET /conversations unexpected error:', err);
    return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
  }
});

// POST /api/conversations
router.post('/', authMiddleware, async (req, res) => {
  const { topic_id, topic_label, mission_id } = req.body;

  if (!topic_id || !topic_label) {
    return errorResponse(res, 400, 'INVALID_REQUEST', 'topic_id와 topic_label이 필요합니다');
  }

  try {
    const insertData = { user_id: req.user.id, topic_id, topic_label };
    if (mission_id) insertData.mission_id = mission_id;

    const { data, error } = await supabase
      .from('conversations')
      .insert(insertData)
      .select('id, topic_id, topic_label, created_at')
      .single();

    if (error || !data) {
      console.error('conversation insert error:', error);
      return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
    }

    return res.status(201).json(data);
  } catch (err) {
    console.error('POST /conversations unexpected error:', err);
    return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
  }
});

// POST /api/conversations/:id/messages
router.post('/:id/messages', authMiddleware, async (req, res) => {
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
      .select('id, topic_id, mission_id')
      .eq('id', conversationId)
      .eq('user_id', req.user.id)
      .single();

    if (convError || !conversation) {
      return errorResponse(res, 404, 'CONVERSATION_NOT_FOUND', '대화를 찾을 수 없습니다');
    }

    // 3. 시스템 프롬프트 빌드
    let systemPrompt = buildPrompt(conversation.topic_id);

    const { data: recentExpressions } = await supabase
      .from('expressions')
      .select('expression_text')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentExpressions?.length > 0) {
      const list = recentExpressions
        .map(e => `- "${e.expression_text}"`)
        .join('\n');

      systemPrompt +=
        `\n\nThe learner recently saved these expressions:\n${list}\n\n` +
        `Naturally steer the conversation so the learner has an opportunity ` +
        `to use these expressions in context. ` +
        `Never explicitly mention that you are practicing them. ` +
        `Do not break character. Just guide the context naturally.`;
    }

    // 미션 모드: goal_achieved 조건 주입
    const mission = MISSIONS.find(m => m.id === conversation.mission_id);
    if (mission) {
      systemPrompt +=
        `\n\nMISSION MODE — Additional instructions:\n${mission.successPrompt}` +
        `\n\nYour JSON response MUST include a "goal_achieved" boolean field alongside feedback and next_response.`;
    }

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

    const { feedback, next_response, goal_achieved = false } = parsedAiContent;

    // 6. process_turn RPC 호출 — 턴 제한 체크 + 두 메시지 INSERT 원자적 처리
    const { data: rpcResult, error: rpcError } = await supabase.rpc('process_turn', {
      p_conversation_id: conversationId,
      p_user_id: req.user.id,
      p_text: text.trim(),
      p_feedback: feedback,
      p_next_response: next_response,
    });

    if (rpcError) {
      console.error('process_turn rpc error:', rpcError);
      return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
    }

    if (rpcResult.error === 'TURN_LIMIT_EXCEEDED') {
      return errorResponse(res, 429, 'TURN_LIMIT_EXCEEDED', '일일 20턴 제한에 도달했습니다');
    }

    // rpcResult: { user_message_id, ai_message_id, turn_number }
    const content = { feedback, next_response };
    if (mission) content.goal_achieved = goal_achieved;

    return res.status(201).json({
      message_id: rpcResult.ai_message_id,
      user_message_id: rpcResult.user_message_id,
      turn_number: rpcResult.turn_number,
      content,
    });
  } catch (err) {
    console.error('POST /:id/messages unexpected error:', err);
    return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
  }
});

// GET /api/conversations/:id/messages
router.get('/:id/messages', authMiddleware, async (req, res) => {
  const conversationId = req.params.id;

  try {
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', req.user.id)
      .single();

    if (convError || !conversation) {
      return errorResponse(res, 404, 'CONVERSATION_NOT_FOUND', '대화를 찾을 수 없습니다');
    }

    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, turn_number, role, content_type, content, created_at')
      .eq('conversation_id', conversationId)
      .order('turn_number', { ascending: true });

    if (msgError) {
      console.error('messages fetch error:', msgError);
      return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
    }

    return res.status(200).json(messages || []);
  } catch (err) {
    console.error('GET /:id/messages unexpected error:', err);
    return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
  }
});

module.exports = router;
