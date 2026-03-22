'use strict';

// 1. 호이스팅 — require 전에 선언
jest.mock('openai');
jest.mock('@supabase/supabase-js');

const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');
const request = require('supertest');
const express = require('express');
const fs = require('fs');

// 2. 모듈 레벨 stable mock 함수 선언
const mockGetUser = jest.fn();
const mockTranscriptionsCreate = jest.fn();

// OpenAI 인스턴스 mock: new OpenAI() 할 때 transcriptions.create를 반환
OpenAI.mockImplementation(() => ({
  audio: {
    transcriptions: {
      create: mockTranscriptionsCreate,
    },
  },
}));

// 3. createClient mock 설정 (supabase.js require 전에 완료)
createClient.mockReturnValue({
  auth: { getUser: mockGetUser },
});

// 4. 라우터 require (이 시점에 supabase.js 캐시됨, mock 반영)
const sttRouter = require('../routes/stt');

// 5. 테스트용 Express 앱
const app = express();
app.use(express.json());
app.use('/api/stt', sttRouter);

// 6. 각 테스트 전 mock 초기화 및 기본값 설정
beforeEach(() => {
  jest.clearAllMocks();

  // OpenAI mock 체인 복원
  OpenAI.mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: mockTranscriptionsCreate,
      },
    },
  }));

  // 기본: 유효한 사용자 인증
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'test@test.com' } },
    error: null,
  });

  // 기본: Whisper 정상 응답
  mockTranscriptionsCreate.mockResolvedValue({ text: 'hello' });
});

describe('POST /api/stt', () => {
  test('1. 유효한 m4a 파일 전송 → 200 { text: "hello" }', async () => {
    const res = await request(app)
      .post('/api/stt')
      .set('Authorization', 'Bearer valid-token')
      .attach('audio', Buffer.alloc(1024), { filename: 'test.m4a', contentType: 'audio/mp4' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ text: 'hello' });
  });

  test('2. mp3 파일 전송 → 400 INVALID_AUDIO_FORMAT', async () => {
    const res = await request(app)
      .post('/api/stt')
      .set('Authorization', 'Bearer valid-token')
      .attach('audio', Buffer.alloc(1024), { filename: 'test.mp3', contentType: 'audio/mpeg' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_AUDIO_FORMAT');
  });

  test('3. Authorization 헤더 없음 → 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .post('/api/stt')
      .attach('audio', Buffer.alloc(1024), { filename: 'test.m4a', contentType: 'audio/mp4' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('4. Whisper API mock 오류 → 502 STT_FAILED', async () => {
    mockTranscriptionsCreate.mockRejectedValueOnce(new Error('Whisper API error'));

    const res = await request(app)
      .post('/api/stt')
      .set('Authorization', 'Bearer valid-token')
      .attach('audio', Buffer.alloc(1024), { filename: 'test.m4a', contentType: 'audio/mp4' });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('STT_FAILED');
  });

  test('5. 처리 완료 후 fs.unlink 호출 확인', async () => {
    const unlinkSpy = jest.spyOn(fs, 'unlink');
    mockTranscriptionsCreate.mockResolvedValueOnce({ text: 'hello' });

    const res = await request(app)
      .post('/api/stt')
      .set('Authorization', 'Bearer valid-token')
      .attach('audio', Buffer.alloc(1024), { filename: 'test.m4a', contentType: 'audio/mp4' });

    expect(res.status).toBe(200);
    expect(unlinkSpy).toHaveBeenCalled();

    unlinkSpy.mockRestore();
  });
});
