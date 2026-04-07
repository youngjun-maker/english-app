'use strict';

const express = require('express');
const multer = require('multer');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { OpenAI } = require('openai');
const { authMiddleware } = require('../middleware/auth');
const { errorResponse } = require('../utils/errorResponse');

const router = express.Router();

// 30초 m4a 기준 ~500KB 크기 제한
const MAX_AUDIO_SIZE = 500 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => cb(null, Date.now() + file.originalname),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// POST /api/stt
router.post('/', authMiddleware, upload.single('audio'), async (req, res) => {
  const file = req.file;

  if (!file) {
    return errorResponse(res, 400, 'INVALID_AUDIO_FORMAT', '오디오 파일이 필요합니다');
  }

  const { mimetype, originalname, size } = file;
  const filePath = file.path;

  // 포맷 검증: audio/mp4 mimetype이거나 .m4a 확장자여야 함
  const isMp4Mime = mimetype === 'audio/mp4';
  const isM4aExt = originalname.toLowerCase().endsWith('.m4a');

  if (!isMp4Mime && !isM4aExt) {
    fs.unlink(filePath, () => {});
    return errorResponse(res, 400, 'INVALID_AUDIO_FORMAT', '지원하지 않는 오디오 형식입니다 (m4a만 허용)');
  }

  // 크기 검증: 30초 기준 초과 시 거부
  if (size > MAX_AUDIO_SIZE) {
    fs.unlink(filePath, () => {});
    return errorResponse(res, 400, 'AUDIO_TOO_LONG', '오디오 파일이 너무 큽니다 (최대 30초)');
  }

  // Whisper STT 호출
  try {
    const openai = new OpenAI();
    const transcript = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
      language: 'en',
    });
    fs.unlink(filePath, () => {});
    return res.json({ text: transcript.text });
  } catch (err) {
    console.error('[STT] Whisper API error:', err.message);
    fs.unlink(filePath, () => {});
    return errorResponse(res, 502, 'STT_FAILED', 'STT 처리 중 오류가 발생했습니다');
  }
});

module.exports = router;
