'use strict';

const crypto = require('crypto');
const express = require('express');
const { OpenAI } = require('openai');
const { authMiddleware } = require('../middleware/auth');
const { errorResponse } = require('../utils/errorResponse');
const { supabase } = require('../utils/supabase');

const router = express.Router();
const openai = new OpenAI();

const MAX_TTS_INPUT_LENGTH = 500;
const TTS_CACHE_BUCKET = 'tts-cache';
const SIGNED_URL_EXPIRES_IN = 3600;

/**
 * text를 sha256 해시하여 캐시 키(파일명)를 생성한다.
 * @param {string} text - 정규화(trim)된 입력 문자열
 * @returns {string} "<hex>.mp3"
 */
const buildCacheKey = (text) =>
  crypto.createHash('sha256').update(text).digest('hex') + '.mp3';

/**
 * Supabase Storage에서 캐시 파일 존재 여부를 확인한다.
 * 실패 시 null을 반환하여 캐시 미스로 처리한다.
 * @param {string} cacheKey
 * @returns {Promise<boolean|null>}
 */
const checkCacheExists = async (cacheKey) => {
  try {
    const { data, error } = await supabase.storage
      .from(TTS_CACHE_BUCKET)
      .list('', { search: cacheKey, limit: 1 });

    if (error) {
      console.warn('[TTS] Storage list 실패, 캐시 미스로 처리:', error.message);
      return false;
    }

    return Array.isArray(data) && data.some((f) => f.name === cacheKey);
  } catch (err) {
    console.warn('[TTS] Storage list 예외, 캐시 미스로 처리:', err.message);
    return false;
  }
};

/**
 * 캐시된 파일의 Signed URL을 생성한다.
 * 실패 시 null을 반환한다.
 * @param {string} cacheKey
 * @returns {Promise<string|null>}
 */
const createSignedUrl = async (cacheKey) => {
  try {
    const { data, error } = await supabase.storage
      .from(TTS_CACHE_BUCKET)
      .createSignedUrl(cacheKey, SIGNED_URL_EXPIRES_IN);

    if (error || !data?.signedUrl) {
      console.warn('[TTS] Signed URL 생성 실패:', error?.message);
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.warn('[TTS] Signed URL 생성 예외:', err.message);
    return null;
  }
};

/**
 * Buffer를 base64 data URI로 변환하여 fallback 응답을 구성한다.
 * @param {Buffer} buffer
 * @returns {{ url: string }}
 */
const buildDataUriResponse = (buffer) => ({
  url: `data:audio/mpeg;base64,${buffer.toString('base64')}`,
});

// POST /api/tts
router.post('/', authMiddleware, async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return errorResponse(res, 400, 'INVALID_INPUT', 'text 필드가 필요합니다');
  }

  if (text.length > MAX_TTS_INPUT_LENGTH) {
    return errorResponse(
      res,
      400,
      'INVALID_INPUT',
      `text는 ${MAX_TTS_INPUT_LENGTH}자 이하여야 합니다`
    );
  }

  const normalizedText = text.trim();
  const cacheKey = buildCacheKey(normalizedText);

  // 1. 캐시 확인
  const cacheExists = await checkCacheExists(cacheKey);

  if (cacheExists) {
    const signedUrl = await createSignedUrl(cacheKey);

    if (signedUrl) {
      return res.json({ url: signedUrl });
    }

    // Signed URL 생성 실패 → Storage에서 직접 다운로드 후 fallback
    console.warn('[TTS] 캐시 히트지만 Signed URL 실패, OpenAI TTS 재호출');
  }

  // 2. 캐시 미스 (또는 Signed URL 실패) → OpenAI TTS 호출
  let buffer;
  try {
    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input: normalizedText,
      response_format: 'mp3',
    });

    buffer = Buffer.from(await response.arrayBuffer());
  } catch (err) {
    console.error('[TTS] OpenAI TTS 오류:', err.message);
    return errorResponse(res, 502, 'TTS_FAILED', 'TTS 처리 중 오류가 발생했습니다');
  }

  // 3. Storage 업로드 시도
  const { error: uploadError } = await supabase.storage
    .from(TTS_CACHE_BUCKET)
    .upload(cacheKey, buffer, { contentType: 'audio/mpeg', upsert: false });

  if (uploadError) {
    console.warn('[TTS] Storage 업로드 실패, base64 fallback 반환:', uploadError.message);
    return res.json(buildDataUriResponse(buffer));
  }

  // 4. 업로드 성공 → Signed URL 생성
  const signedUrl = await createSignedUrl(cacheKey);

  if (!signedUrl) {
    console.warn('[TTS] 업로드 성공이지만 Signed URL 실패, base64 fallback 반환');
    return res.json(buildDataUriResponse(buffer));
  }

  return res.json({ url: signedUrl });
});

module.exports = router;
