'use strict';

jest.mock('openai');
jest.mock('@supabase/supabase-js');

const { Readable } = require('stream');
const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');
const request = require('supertest');
const express = require('express');

// --- Supabase mock (authMiddleware 통과용) ---
const mockGetUser = jest.fn();
createClient.mockReturnValue({
  auth: { getUser: mockGetUser },
});

// --- OpenAI mock ---
const mockSpeechCreate = jest.fn();
OpenAI.mockImplementation(() => ({
  audio: {
    speech: {
      create: mockSpeechCreate,
    },
  },
}));

// supabase mock이 설정된 이후 라우터 로드
const ttsRouter = require('../routes/tts');

const app = express();
app.use(express.json());
app.use('/api/tts', ttsRouter);

// --- 헬퍼: 유효한 Web ReadableStream (mock mp3 data) 반환 ---
function makeMockTtsResponse(data = 'mock audio data') {
  // Node.js Readable → Web ReadableStream 변환
  const nodeReadable = Readable.from([Buffer.from(data)]);
  const webStream = Readable.toWeb(nodeReadable);
  return { body: webStream };
}

beforeEach(() => {
  jest.clearAllMocks();

  // 기본값: 유효한 유저 인증
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'test@test.com' } },
    error: null,
  });

  // 기본값: TTS 성공
  mockSpeechCreate.mockResolvedValue(makeMockTtsResponse());
});

describe('POST /api/tts', () => {
  test('유효한 텍스트 전송 → 200, Content-Type: audio/mpeg, non-empty binary', async () => {
    const res = await request(app)
      .post('/api/tts')
      .set('Authorization', 'Bearer valid-token')
      .send({ text: 'Hello, how are you?' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/audio\/mpeg/);
    expect(res.body).toBeDefined();
    // supertest는 binary를 Buffer로 수신 — 비어 있지 않아야 함
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('빈 문자열 전송 → 400 INVALID_INPUT', async () => {
    const res = await request(app)
      .post('/api/tts')
      .set('Authorization', 'Bearer valid-token')
      .send({ text: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });

  test('text 필드 없이 요청 → 400 INVALID_INPUT', async () => {
    const res = await request(app)
      .post('/api/tts')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });

  test('인증 없이 요청 → 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .post('/api/tts')
      .send({ text: 'Hello' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('TTS API 오류 주입 → 502 TTS_FAILED', async () => {
    mockSpeechCreate.mockRejectedValueOnce(new Error('OpenAI upstream error'));

    const res = await request(app)
      .post('/api/tts')
      .set('Authorization', 'Bearer valid-token')
      .send({ text: 'Hello' });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('TTS_FAILED');
  });
});
