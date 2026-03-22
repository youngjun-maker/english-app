'use strict';

const express = require('express');
const router = express.Router();

const { supabase } = require('../utils/supabase');
const { errorResponse } = require('../utils/errorResponse');
const { authMiddleware } = require('../middleware/auth');

const VALID_SOURCE_BLOCKS = ['user_speech', 'feedback', 'response'];

// GET /api/expressions
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data: expressions, error } = await supabase
      .from('expressions')
      .select(
        'id, expression_text, source_block, user_memo, created_at, conversation_id, message_id, messages!expressions_message_id_fkey(content), conversations!expressions_conversation_id_fkey(topic_label)'
      )
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('expressions fetch error:', error);
      return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
    }

    const result = (expressions || []).map((expr) => {
      const msgContent = expr.messages?.content ?? null;
      let source_sentence = null;

      if (msgContent) {
        if (expr.source_block === 'user_speech') {
          source_sentence = msgContent.text ?? null;
        } else if (expr.source_block === 'feedback') {
          const matched = msgContent.feedback?.find((fb) => fb.corrected === expr.expression_text);
          source_sentence = matched?.corrected ?? msgContent.feedback?.[0]?.corrected ?? null;
        } else if (expr.source_block === 'response') {
          source_sentence = msgContent.next_response ?? null;
        }
      }

      return {
        id: expr.id,
        expression_text: expr.expression_text,
        source_block: expr.source_block,
        source_sentence,
        user_memo: expr.user_memo ?? null,
        created_at: expr.created_at,
        conversation_id: expr.conversation_id ?? null,
        message_id: expr.message_id ?? null,
        topic_label: expr.conversations?.topic_label ?? '',
      };
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('GET /expressions unexpected error:', err);
    return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
  }
});

// POST /api/expressions
router.post('/', authMiddleware, async (req, res) => {
  const { conversation_id, message_id, expression_text, source_block, user_memo } = req.body;

  if (!expression_text) {
    return errorResponse(res, 400, 'INVALID_REQUEST', 'expression_text가 필요합니다');
  }

  if (!source_block) {
    return errorResponse(res, 400, 'INVALID_REQUEST', 'source_block이 필요합니다');
  }

  if (!VALID_SOURCE_BLOCKS.includes(source_block)) {
    return errorResponse(
      res,
      400,
      'INVALID_REQUEST',
      `source_block은 ${VALID_SOURCE_BLOCKS.join(', ')} 중 하나여야 합니다`
    );
  }

  try {
    const { data, error } = await supabase
      .from('expressions')
      .insert({
        user_id: req.user.id,
        conversation_id: conversation_id ?? null,
        message_id: message_id ?? null,
        expression_text,
        source_block,
        user_memo: user_memo ?? null,
      })
      .select('id, created_at')
      .single();

    if (error || !data) {
      console.error('expression insert error:', error);
      return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
    }

    return res.status(201).json(data);
  } catch (err) {
    console.error('POST /expressions unexpected error:', err);
    return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
  }
});

// DELETE /api/expressions/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('expressions')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id');

    if (error) {
      console.error('expression delete error:', error);
      return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
    }

    if (!data || data.length === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', '표현을 찾을 수 없습니다');
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('DELETE /expressions/:id unexpected error:', err);
    return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
  }
});

module.exports = router;
