'use strict';

const { Readable } = require('stream');
const express = require('express');
const { OpenAI } = require('openai');
const { authMiddleware } = require('../middleware/auth');
const { errorResponse } = require('../utils/errorResponse');

const router = express.Router();

const MAX_TTS_INPUT_LENGTH = 500;

// POST /api/tts
router.post('/', authMiddleware, async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return errorResponse(res, 400, 'INVALID_INPUT', 'text 필드가 필요합니다');
  }

  if (text.length > MAX_TTS_INPUT_LENGTH) {
    return errorResponse(res, 400, 'INVALID_INPUT', `text는 ${MAX_TTS_INPUT_LENGTH}자 이하여야 합니다`);
  }

  try {
    const openai = new OpenAI();
    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input: text,
      response_format: 'mp3',
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    Readable.fromWeb(response.body).pipe(res);
  } catch (err) {
    console.error('[TTS] OpenAI TTS error:', err.message);
    return errorResponse(res, 502, 'TTS_FAILED', 'TTS 처리 중 오류가 발생했습니다');
  }
});

module.exports = router;
