'use strict';

const express = require('express');
const multer = require('multer');
const os = require('os');
const fs = require('fs');
const { OpenAI } = require('openai');
const { authMiddleware } = require('../middleware/auth');
const { errorResponse } = require('../utils/errorResponse');
const { supabase } = require('../utils/supabase');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => cb(null, Date.now() + file.originalname),
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB (Whisper 최대)
});

// POST /api/shadowing/transcribe
// 오디오 파일 → 타임스탬프 포함 스크립트 반환 (관리자용 콘텐츠 제작 도구)
router.post('/transcribe', authMiddleware, upload.single('audio'), async (req, res) => {
  const file = req.file;

  if (!file) {
    return errorResponse(res, 400, 'INVALID_AUDIO_FORMAT', '오디오 파일이 필요합니다');
  }

  const filePath = file.path;

  try {
    const openai = new OpenAI();
    const transcript = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    fs.unlink(filePath, () => {});

    // Whisper raw segments → 마침표/물음표/느낌표 기준으로 병합
    const rawSegments = (transcript.segments || []).map((seg) => ({
      start: Math.round(seg.start * 100) / 100,
      end: Math.round(seg.end * 100) / 100,
      text: seg.text.trim(),
    }));

    const merged = [];
    let buffer = null;
    for (const seg of rawSegments) {
      if (!buffer) {
        buffer = { start: seg.start, end: seg.end, text: seg.text };
      } else {
        buffer.text = buffer.text + ' ' + seg.text;
        buffer.end = seg.end;
      }
      if (/[.?!]$/.test(seg.text)) {
        merged.push({ ...buffer });
        buffer = null;
      }
    }
    if (buffer) merged.push(buffer);

    const segments = merged.map((s, i) => ({ index: i, ...s }));

    return res.json({ segments });
  } catch (err) {
    console.error('[Shadowing] Whisper transcribe error:', err.message);
    fs.unlink(filePath, () => {});
    return errorResponse(res, 502, 'TRANSCRIBE_FAILED', '타임스탬프 추출 중 오류가 발생했습니다');
  }
});

// GET /api/shadowing/contents
// is_published=true 콘텐츠 목록 반환
router.get('/contents', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('shadowing_contents')
      .select('id, title, description, thumbnail_url, duration, level, category')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Shadowing] contents list error:', error);
      return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
    }

    return res.status(200).json(data || []);
  } catch (err) {
    console.error('[Shadowing] GET /contents unexpected error:', err);
    return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
  }
});

// GET /api/shadowing/contents/:id
// 콘텐츠 상세 + 스크립트 전체 반환
router.get('/contents/:id', authMiddleware, async (req, res) => {
  const contentId = req.params.id;
  try {
    const { data: content, error: contentError } = await supabase
      .from('shadowing_contents')
      .select('id, title, video_url, duration')
      .eq('id', contentId)
      .eq('is_published', true)
      .single();

    if (contentError || !content) {
      return errorResponse(res, 404, 'CONTENT_NOT_FOUND', '콘텐츠를 찾을 수 없습니다');
    }

    const { data: scripts, error: scriptsError } = await supabase
      .from('shadowing_scripts')
      .select('sentence_index, start_time, end_time, text, translation')
      .eq('content_id', contentId)
      .order('sentence_index', { ascending: true });

    if (scriptsError) {
      console.error('[Shadowing] scripts fetch error:', scriptsError);
      return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
    }

    return res.status(200).json({
      content,
      scripts: (scripts || []).map((s) => ({
        index: s.sentence_index,
        start: s.start_time,
        end: s.end_time,
        text: s.text,
        translation: s.translation,
      })),
    });
  } catch (err) {
    console.error('[Shadowing] GET /contents/:id unexpected error:', err);
    return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
  }
});

// POST /api/shadowing/sessions
// 섀도잉 세션 기록 저장
router.post('/sessions', authMiddleware, async (req, res) => {
  const { content_id, completed } = req.body;

  if (!content_id) {
    return errorResponse(res, 400, 'INVALID_REQUEST', 'content_id가 필요합니다');
  }
  if (typeof completed !== 'boolean') {
    return errorResponse(res, 400, 'INVALID_REQUEST', 'completed는 boolean이어야 합니다');
  }

  try {
    const { data, error } = await supabase
      .from('shadowing_sessions')
      .insert({ user_id: req.user.id, content_id, completed })
      .select('id, created_at')
      .single();

    if (error) {
      console.error('[Shadowing] session insert error:', error);
      return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
    }

    return res.status(201).json(data);
  } catch (err) {
    console.error('[Shadowing] POST /sessions unexpected error:', err);
    return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
  }
});

module.exports = router;
