'use strict';

// ─────────────────────────────────────────────
// 1. Mock 선언 (jest.mock은 호이스팅되어 require보다 먼저 실행됨)
// ─────────────────────────────────────────────
jest.mock('@supabase/supabase-js');
jest.mock('../middleware/auth');

// ─────────────────────────────────────────────
// 2. require
// ─────────────────────────────────────────────
const { createClient } = require('@supabase/supabase-js');
const { authMiddleware } = require('../middleware/auth');
const request = require('supertest');
const express = require('express');

// ─────────────────────────────────────────────
// 3. authMiddleware mock: req.user 주입 후 next() 호출
// ─────────────────────────────────────────────
authMiddleware.mockImplementation((req, _res, next) => {
  req.user = { id: 'user-123', email: 'test@test.com' };
  next();
});

// ─────────────────────────────────────────────
// 4. Supabase mock 함수 (stable references)
// ─────────────────────────────────────────────

// ── GET /contents 체인 ──
// from('shadowing_contents').select().eq(is_published).order()  [resolved]
const mockContentsListOrder = jest.fn();
const mockContentsListEq = jest.fn().mockReturnValue({ order: mockContentsListOrder });
const mockContentsListSelect = jest.fn().mockReturnValue({ eq: mockContentsListEq });

// ── GET /contents/:id — 1st from 체인 ──
// from('shadowing_contents').select().eq(id).eq(is_published).single()  [resolved]
const mockContentDetailSingle = jest.fn();
const mockContentDetailEq2 = jest.fn().mockReturnValue({ single: mockContentDetailSingle });
const mockContentDetailEq1 = jest.fn().mockReturnValue({ eq: mockContentDetailEq2 });
const mockContentDetailSelect = jest.fn().mockReturnValue({ eq: mockContentDetailEq1 });

// ── GET /contents/:id — 2nd from 체인 ──
// from('shadowing_scripts').select().eq(content_id).order()  [resolved]
const mockScriptsOrder = jest.fn();
const mockScriptsEq = jest.fn().mockReturnValue({ order: mockScriptsOrder });
const mockScriptsSelect = jest.fn().mockReturnValue({ eq: mockScriptsEq });

// ── POST /sessions 체인 ──
// from('shadowing_sessions').insert().select().single()  [resolved]
const mockSessionInsertSingle = jest.fn();
const mockSessionInsertSelect = jest.fn().mockReturnValue({ single: mockSessionInsertSingle });
const mockSessionInsert = jest.fn().mockReturnValue({ select: mockSessionInsertSelect });

// ── from() dispatcher ──
const mockFrom = jest.fn();

// ─────────────────────────────────────────────
// 5. createClient mock 설정
// ─────────────────────────────────────────────
createClient.mockReturnValue({
  auth: { getUser: jest.fn() },
  from: mockFrom,
});

// ─────────────────────────────────────────────
// 6. 라우터 require (mock 설정 후)
// ─────────────────────────────────────────────
const shadowingRouter = require('../routes/shadowing');

const app = express();
app.use(express.json());
app.use('/api/shadowing', shadowingRouter);

// ─────────────────────────────────────────────
// 7. 체인 복원 헬퍼 (jest.resetAllMocks 후 필요)
// ─────────────────────────────────────────────
function restoreChainMocks() {
  // GET /contents
  mockContentsListEq.mockReturnValue({ order: mockContentsListOrder });
  mockContentsListSelect.mockReturnValue({ eq: mockContentsListEq });

  // GET /contents/:id — 1st from (shadowing_contents detail)
  mockContentDetailEq2.mockReturnValue({ single: mockContentDetailSingle });
  mockContentDetailEq1.mockReturnValue({ eq: mockContentDetailEq2 });
  mockContentDetailSelect.mockReturnValue({ eq: mockContentDetailEq1 });

  // GET /contents/:id — 2nd from (shadowing_scripts)
  mockScriptsEq.mockReturnValue({ order: mockScriptsOrder });
  mockScriptsSelect.mockReturnValue({ eq: mockScriptsEq });

  // POST /sessions
  mockSessionInsertSelect.mockReturnValue({ single: mockSessionInsertSingle });
  mockSessionInsert.mockReturnValue({ select: mockSessionInsertSelect });

  // authMiddleware 복원
  authMiddleware.mockImplementation((req, _res, next) => {
    req.user = { id: 'user-123', email: 'test@test.com' };
    next();
  });
}

// ─────────────────────────────────────────────
// 8. beforeEach
// ─────────────────────────────────────────────
beforeEach(() => {
  jest.resetAllMocks();
  restoreChainMocks();
});

// ─────────────────────────────────────────────
// 9. 테스트
// ─────────────────────────────────────────────

// ── describe 1: GET /api/shadowing/contents ──
describe('GET /api/shadowing/contents', () => {
  test('1. 정상 조회 → 200, 콘텐츠 배열 반환 (필드 포함)', async () => {
    mockFrom.mockReturnValueOnce({ select: mockContentsListSelect });
    mockContentsListOrder.mockResolvedValueOnce({
      data: [
        {
          id: 'content-1',
          title: '일상 대화',
          description: '기초 회화 연습',
          thumbnail_url: 'https://example.com/thumb.jpg',
          duration: 120,
          level: 'beginner',
          category: 'daily',
        },
      ],
      error: null,
    });

    const res = await request(app)
      .get('/api/shadowing/contents')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({
      id: 'content-1',
      title: '일상 대화',
      description: '기초 회화 연습',
      thumbnail_url: expect.any(String),
      duration: 120,
      level: 'beginner',
      category: 'daily',
    });
  });

  test('2. Supabase DB 오류 → 500, INTERNAL_ERROR', async () => {
    mockFrom.mockReturnValueOnce({ select: mockContentsListSelect });
    mockContentsListOrder.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB connection failed' },
    });

    const res = await request(app)
      .get('/api/shadowing/contents')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });

  test('3. 인증 없음 (authMiddleware가 401 반환) → 401', async () => {
    authMiddleware.mockImplementationOnce((_req, res, _next) => {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '인증 토큰이 필요합니다' } });
    });

    const res = await request(app)
      .get('/api/shadowing/contents')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

// ── describe 2: GET /api/shadowing/contents/:id ──
describe('GET /api/shadowing/contents/:id', () => {
  test('4. 정상 조회 → 200, content + scripts 반환 (필드 매핑 확인)', async () => {
    // 1st from: shadowing_contents detail
    mockFrom.mockReturnValueOnce({ select: mockContentDetailSelect });
    mockContentDetailSingle.mockResolvedValueOnce({
      data: {
        id: 'content-1',
        title: '일상 대화',
        video_url: 'https://example.com/video.mp4',
        duration: 120,
      },
      error: null,
    });

    // 2nd from: shadowing_scripts
    mockFrom.mockReturnValueOnce({ select: mockScriptsSelect });
    mockScriptsOrder.mockResolvedValueOnce({
      data: [
        {
          sentence_index: 0,
          start_time: 0.0,
          end_time: 3.5,
          text: 'Hello, how are you?',
          translation: '안녕하세요, 어떻게 지내세요?',
        },
        {
          sentence_index: 1,
          start_time: 3.5,
          end_time: 7.0,
          text: 'I am fine, thank you.',
          translation: '잘 지내고 있어요, 감사합니다.',
        },
      ],
      error: null,
    });

    const res = await request(app)
      .get('/api/shadowing/contents/content-1')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body.content).toMatchObject({
      id: 'content-1',
      title: '일상 대화',
      video_url: expect.any(String),
      duration: 120,
    });
    expect(Array.isArray(res.body.scripts)).toBe(true);
    expect(res.body.scripts[0]).toMatchObject({
      index: 0,
      start: 0.0,
      end: 3.5,
      text: 'Hello, how are you?',
      translation: '안녕하세요, 어떻게 지내세요?',
    });
    // sentence_index → index 매핑 확인
    expect(res.body.scripts[0].index).toBe(0);
    expect(res.body.scripts[1].index).toBe(1);
  });

  test('5. 콘텐츠 not found (contentError 있음) → 404, CONTENT_NOT_FOUND', async () => {
    // 1st from: shadowing_contents detail — 에러 반환
    mockFrom.mockReturnValueOnce({ select: mockContentDetailSelect });
    mockContentDetailSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Row not found' },
    });

    const res = await request(app)
      .get('/api/shadowing/contents/nonexistent-id')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CONTENT_NOT_FOUND');
  });

  test('6. scripts 조회 DB 오류 → 500, INTERNAL_ERROR', async () => {
    // 1st from: shadowing_contents detail — 성공
    mockFrom.mockReturnValueOnce({ select: mockContentDetailSelect });
    mockContentDetailSingle.mockResolvedValueOnce({
      data: {
        id: 'content-1',
        title: '일상 대화',
        video_url: 'https://example.com/video.mp4',
        duration: 120,
      },
      error: null,
    });

    // 2nd from: shadowing_scripts — DB 오류
    mockFrom.mockReturnValueOnce({ select: mockScriptsSelect });
    mockScriptsOrder.mockResolvedValueOnce({
      data: null,
      error: { message: 'scripts table query failed' },
    });

    const res = await request(app)
      .get('/api/shadowing/contents/content-1')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});

// ── describe 3: POST /api/shadowing/sessions ──
describe('POST /api/shadowing/sessions', () => {
  test('7. 정상 저장 → 201, { id, created_at }', async () => {
    mockFrom.mockReturnValueOnce({ insert: mockSessionInsert });
    mockSessionInsertSingle.mockResolvedValueOnce({
      data: {
        id: 'session-abc',
        created_at: '2026-03-25T10:00:00.000Z',
      },
      error: null,
    });

    const res = await request(app)
      .post('/api/shadowing/sessions')
      .set('Authorization', 'Bearer valid-token')
      .send({ content_id: 'content-1', completed: true });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: 'session-abc',
      created_at: expect.any(String),
    });
  });

  test('8. content_id 누락 → 400, INVALID_REQUEST', async () => {
    const res = await request(app)
      .post('/api/shadowing/sessions')
      .set('Authorization', 'Bearer valid-token')
      .send({ completed: true });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  test('9. completed가 string 타입 → 400, INVALID_REQUEST', async () => {
    const res = await request(app)
      .post('/api/shadowing/sessions')
      .set('Authorization', 'Bearer valid-token')
      .send({ content_id: 'content-1', completed: 'true' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });
});
