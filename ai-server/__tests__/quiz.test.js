'use strict';

// ─────────────────────────────────────────────
// 1. Mock 선언 (jest.mock은 호이스팅되어 require보다 먼저 실행됨)
// ─────────────────────────────────────────────
jest.mock('../middleware/auth');
jest.mock('../utils/supabase');

// OpenAI: quiz.js는 모듈 최상단에서 `new OpenAI()`로 인스턴스를 생성하므로
// factory 내부에 mockChatCreate 참조를 노출해 두어야 한다.
const mockChatCreate = jest.fn();
jest.mock('openai', () => {
  const MockConstructor = jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockChatCreate,
      },
    },
  }));
  return MockConstructor;
});

// ─────────────────────────────────────────────
// 2. require
// ─────────────────────────────────────────────
const { authMiddleware } = require('../middleware/auth');
const { supabase } = require('../utils/supabase');
const request = require('supertest');
const express = require('express');

// ─────────────────────────────────────────────
// 3. authMiddleware 기본 구현: req.user 주입 후 next()
// ─────────────────────────────────────────────
authMiddleware.mockImplementation((req, _res, next) => {
  req.user = { id: 'user-123', email: 'test@test.com' };
  next();
});

// ─────────────────────────────────────────────
// 4. Supabase mock 함수 (stable references)
// ─────────────────────────────────────────────

// ── POST /generate — 1st from 체인 ──
// from('expressions').select().eq('user_id', ...)  → { data, error }
const mockExpressionsEq = jest.fn();
const mockExpressionsSelect = jest.fn().mockReturnValue({ eq: mockExpressionsEq });

// ── POST /generate — 2nd from 체인 ──
// from('quiz_sessions').insert().select().single()  → { data, error }
const mockSessionInsertSingle = jest.fn();
const mockSessionInsertSelectFn = jest.fn().mockReturnValue({ single: mockSessionInsertSingle });
const mockSessionInsert = jest.fn().mockReturnValue({ select: mockSessionInsertSelectFn });

// ── POST /generate — 3rd from 체인 ──
// from('quiz_questions').insert([...])  → { error }
const mockQuestionsInsert = jest.fn();

// ── POST /generate — 4th from 체인 ──
// from('quiz_questions').select().eq().order()  → { data }
const mockQuestionsSelectOrder = jest.fn();
const mockQuestionsSelectEq = jest.fn().mockReturnValue({ order: mockQuestionsSelectOrder });
const mockQuestionsSelectAfterInsert = jest.fn().mockReturnValue({ eq: mockQuestionsSelectEq });

// ── GET /sessions 체인 ──
// from('quiz_sessions').select().eq().order()  → { data, error }
const mockSessionsListOrder = jest.fn();
const mockSessionsListEq = jest.fn().mockReturnValue({ order: mockSessionsListOrder });
const mockSessionsListSelect = jest.fn().mockReturnValue({ eq: mockSessionsListEq });

// ── GET /sessions/:id — 1st from 체인 ──
// from('quiz_sessions').select().eq(id).eq(user_id).single()  → { data, error }
const mockSessionDetailSingle = jest.fn();
const mockSessionDetailEq2 = jest.fn().mockReturnValue({ single: mockSessionDetailSingle });
const mockSessionDetailEq1 = jest.fn().mockReturnValue({ eq: mockSessionDetailEq2 });
const mockSessionDetailSelect = jest.fn().mockReturnValue({ eq: mockSessionDetailEq1 });

// ── GET /sessions/:id — 2nd from 체인 ──
// from('quiz_questions').select().eq().order()  → { data, error }
const mockQuestionsDetailOrder = jest.fn();
const mockQuestionsDetailEq = jest.fn().mockReturnValue({ order: mockQuestionsDetailOrder });
const mockQuestionsDetailSelect = jest.fn().mockReturnValue({ eq: mockQuestionsDetailEq });

// ── PATCH /sessions/:id 체인 ──
// from('quiz_sessions').update().eq(id).eq(user_id).select('id')  → { data, error }
const mockUpdateSelectFn = jest.fn();
const mockUpdateEq2 = jest.fn().mockReturnValue({ select: mockUpdateSelectFn });
const mockUpdateEq1 = jest.fn().mockReturnValue({ eq: mockUpdateEq2 });
const mockUpdateFn = jest.fn().mockReturnValue({ eq: mockUpdateEq1 });

// ── from() dispatcher ──
const mockFrom = jest.fn();
supabase.from = mockFrom;

// ─────────────────────────────────────────────
// 5. 라우터 require (mock 설정 후)
// ─────────────────────────────────────────────
const quizRouter = require('../routes/quiz');

const app = express();
app.use(express.json());
app.use('/api/quiz', quizRouter);

// ─────────────────────────────────────────────
// 6. 체인 복원 헬퍼 (jest.resetAllMocks 후 필요)
// ─────────────────────────────────────────────
function restoreChainMocks() {
  // POST /generate — 1st from (expressions)
  mockExpressionsSelect.mockReturnValue({ eq: mockExpressionsEq });

  // POST /generate — 2nd from (quiz_sessions insert)
  mockSessionInsertSelectFn.mockReturnValue({ single: mockSessionInsertSingle });
  mockSessionInsert.mockReturnValue({ select: mockSessionInsertSelectFn });

  // POST /generate — 4th from (quiz_questions select after insert)
  mockQuestionsSelectEq.mockReturnValue({ order: mockQuestionsSelectOrder });
  mockQuestionsSelectAfterInsert.mockReturnValue({ eq: mockQuestionsSelectEq });

  // GET /sessions
  mockSessionsListEq.mockReturnValue({ order: mockSessionsListOrder });
  mockSessionsListSelect.mockReturnValue({ eq: mockSessionsListEq });

  // GET /sessions/:id — 1st from (session detail)
  mockSessionDetailEq2.mockReturnValue({ single: mockSessionDetailSingle });
  mockSessionDetailEq1.mockReturnValue({ eq: mockSessionDetailEq2 });
  mockSessionDetailSelect.mockReturnValue({ eq: mockSessionDetailEq1 });

  // GET /sessions/:id — 2nd from (questions detail)
  mockQuestionsDetailEq.mockReturnValue({ order: mockQuestionsDetailOrder });
  mockQuestionsDetailSelect.mockReturnValue({ eq: mockQuestionsDetailEq });

  // PATCH /sessions/:id
  mockUpdateEq2.mockReturnValue({ select: mockUpdateSelectFn });
  mockUpdateEq1.mockReturnValue({ eq: mockUpdateEq2 });
  mockUpdateFn.mockReturnValue({ eq: mockUpdateEq1 });

  // authMiddleware 복원
  authMiddleware.mockImplementation((req, _res, next) => {
    req.user = { id: 'user-123', email: 'test@test.com' };
    next();
  });
}

// ─────────────────────────────────────────────
// 7. beforeEach
// ─────────────────────────────────────────────
beforeEach(() => {
  jest.resetAllMocks();
  restoreChainMocks();
});

// ─────────────────────────────────────────────
// 8. 테스트 헬퍼: 10개짜리 GPT 정상 응답 mock
// ─────────────────────────────────────────────
function mockGptSuccess() {
  mockChatCreate.mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            questions: Array(10).fill({
              expression_text: 'test expression',
              example_sentence_en: 'This is a test sentence.',
              example_sentence_ko: '이것은 테스트 문장입니다.',
              highlight_text: '테스트',
            }),
          }),
        },
      },
    ],
  });
}

// ─────────────────────────────────────────────
// 9. 테스트
// ─────────────────────────────────────────────

// ── describe 1: POST /api/quiz/generate ──
describe('POST /api/quiz/generate', () => {
  test('1. expressions 10개 이상 → 정상 생성 → 201, session.id 존재, questions.length === 10', async () => {
    // 1st from: expressions 10개 반환
    const fakeExpressions = Array.from({ length: 10 }, (_, i) => ({
      id: `expr-${i}`,
      expression_text: `expression ${i}`,
    }));
    mockFrom.mockReturnValueOnce({ select: mockExpressionsSelect });
    mockExpressionsEq.mockResolvedValueOnce({ data: fakeExpressions, error: null });

    // GPT 정상 응답
    mockGptSuccess();

    // 2nd from: quiz_sessions insert
    mockFrom.mockReturnValueOnce({ insert: mockSessionInsert });
    mockSessionInsertSingle.mockResolvedValueOnce({
      data: { id: 'session-001', created_at: '2026-03-29T10:00:00.000Z' },
      error: null,
    });

    // 3rd from: quiz_questions insert
    mockFrom.mockReturnValueOnce({ insert: mockQuestionsInsert });
    mockQuestionsInsert.mockResolvedValueOnce({ error: null });

    // 4th from: quiz_questions select (삽입 후 조회)
    const fakeInsertedQuestions = Array.from({ length: 10 }, (_, i) => ({
      id: `q-${i}`,
      expression_text: `expression ${i}`,
      example_sentence_en: 'This is a test sentence.',
      example_sentence_ko: '이것은 테스트 문장입니다.',
      highlight_text: '테스트',
      order_index: i,
    }));
    mockFrom.mockReturnValueOnce({ select: mockQuestionsSelectAfterInsert });
    mockQuestionsSelectOrder.mockResolvedValueOnce({ data: fakeInsertedQuestions });

    const res = await request(app)
      .post('/api/quiz/generate')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(201);
    expect(res.body.session).toBeDefined();
    expect(res.body.session.id).toBe('session-001');
    expect(Array.isArray(res.body.questions)).toBe(true);
    expect(res.body.questions.length).toBe(10);
  });

  test('2. expressions 9개 → 422, NOT_ENOUGH_EXPRESSIONS', async () => {
    const fakeExpressions = Array.from({ length: 9 }, (_, i) => ({
      id: `expr-${i}`,
      expression_text: `expression ${i}`,
    }));
    mockFrom.mockReturnValueOnce({ select: mockExpressionsSelect });
    mockExpressionsEq.mockResolvedValueOnce({ data: fakeExpressions, error: null });

    const res = await request(app)
      .post('/api/quiz/generate')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('NOT_ENOUGH_EXPRESSIONS');
  });

  test('3. GPT 3회 파싱 실패 → 502, QUIZ_GENERATION_FAILED', async () => {
    const fakeExpressions = Array.from({ length: 10 }, (_, i) => ({
      id: `expr-${i}`,
      expression_text: `expression ${i}`,
    }));
    mockFrom.mockReturnValueOnce({ select: mockExpressionsSelect });
    mockExpressionsEq.mockResolvedValueOnce({ data: fakeExpressions, error: null });

    // 3회 모두 파싱 불가 응답 반환
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: 'invalid json not parseable' } }],
    });

    const res = await request(app)
      .post('/api/quiz/generate')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('QUIZ_GENERATION_FAILED');
  });
});

// ── describe 2: GET /api/quiz/sessions ──
describe('GET /api/quiz/sessions', () => {
  test('4. 세션 목록 조회 → 200, 배열 반환', async () => {
    const fakeSessions = [
      { id: 'session-001', total_count: 10, correct_count: 7, created_at: '2026-03-29T10:00:00.000Z' },
      { id: 'session-002', total_count: 10, correct_count: 5, created_at: '2026-03-28T10:00:00.000Z' },
    ];
    mockFrom.mockReturnValueOnce({ select: mockSessionsListSelect });
    mockSessionsListOrder.mockResolvedValueOnce({ data: fakeSessions, error: null });

    const res = await request(app)
      .get('/api/quiz/sessions')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0]).toMatchObject({
      id: 'session-001',
      total_count: 10,
      correct_count: 7,
    });
  });
});

// ── describe 3: GET /api/quiz/sessions/:id ──
describe('GET /api/quiz/sessions/:id', () => {
  test('5. 유효 세션 ID → 200, session + questions 포함', async () => {
    const fakeSession = {
      id: 'session-001',
      total_count: 10,
      correct_count: null,
      created_at: '2026-03-29T10:00:00.000Z',
    };
    const fakeQuestions = Array.from({ length: 10 }, (_, i) => ({
      id: `q-${i}`,
      expression_text: `expression ${i}`,
      example_sentence_en: 'This is a test sentence.',
      example_sentence_ko: '이것은 테스트 문장입니다.',
      highlight_text: '테스트',
      order_index: i,
      is_correct: null,
    }));

    // 1st from: quiz_sessions detail
    mockFrom.mockReturnValueOnce({ select: mockSessionDetailSelect });
    mockSessionDetailSingle.mockResolvedValueOnce({ data: fakeSession, error: null });

    // 2nd from: quiz_questions detail
    mockFrom.mockReturnValueOnce({ select: mockQuestionsDetailSelect });
    mockQuestionsDetailOrder.mockResolvedValueOnce({ data: fakeQuestions, error: null });

    const res = await request(app)
      .get('/api/quiz/sessions/session-001')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body.session).toMatchObject({ id: 'session-001', total_count: 10 });
    expect(Array.isArray(res.body.questions)).toBe(true);
    expect(res.body.questions.length).toBe(10);
  });

  test('6. 없는 세션 ID → 404, NOT_FOUND', async () => {
    // session 조회 실패 (sessionError 있음)
    mockFrom.mockReturnValueOnce({ select: mockSessionDetailSelect });
    mockSessionDetailSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Row not found' },
    });

    const res = await request(app)
      .get('/api/quiz/sessions/nonexistent-id')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ── describe 4: PATCH /api/quiz/sessions/:id ──
describe('PATCH /api/quiz/sessions/:id', () => {
  test('7. correct_count: 7 → 200, success === true', async () => {
    mockFrom.mockReturnValueOnce({ update: mockUpdateFn });
    mockUpdateSelectFn.mockResolvedValueOnce({
      data: [{ id: 'session-001' }],
      error: null,
    });

    const res = await request(app)
      .patch('/api/quiz/sessions/session-001')
      .set('Authorization', 'Bearer valid-token')
      .send({ correct_count: 7 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('8. correct_count: 11 (범위 초과) → 400, INVALID_REQUEST', async () => {
    const res = await request(app)
      .patch('/api/quiz/sessions/session-001')
      .set('Authorization', 'Bearer valid-token')
      .send({ correct_count: 11 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  test('9. 타인 세션 (update 후 빈 배열 반환) → 404, NOT_FOUND', async () => {
    mockFrom.mockReturnValueOnce({ update: mockUpdateFn });
    // user_id .eq() 필터로 인해 다른 유저 세션은 매칭되지 않아 빈 배열 반환
    mockUpdateSelectFn.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const res = await request(app)
      .patch('/api/quiz/sessions/other-user-session')
      .set('Authorization', 'Bearer valid-token')
      .send({ correct_count: 5 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
