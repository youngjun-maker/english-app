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

// ── conversations.POST / ──
// from('conversations').insert({}).select().single()
const mockConvInsertSingle = jest.fn();
const mockConvInsertSelect = jest.fn().mockReturnValue({ single: mockConvInsertSingle });
const mockConvInsert = jest.fn().mockReturnValue({ select: mockConvInsertSelect });

// ── conversations.GET / ──
// from('conversations').select().eq().order()
const mockConvListOrder = jest.fn();
const mockConvListEq = jest.fn().mockReturnValue({ order: mockConvListOrder });
const mockConvListSelect = jest.fn().mockReturnValue({ eq: mockConvListEq });

// turn count per conversation:
// from('messages').select({count,head}).eq(conversation_id).eq(content_type)
const mockTurnCountEq2 = jest.fn();
const mockTurnCountEq1 = jest.fn().mockReturnValue({ eq: mockTurnCountEq2 });
const mockTurnCountSelect = jest.fn().mockReturnValue({ eq: mockTurnCountEq1 });

// ── conversations.GET /:id/messages ──
// from('conversations').select().eq(id).eq(user_id).single()
const mockGetMsgConvSingle = jest.fn();
const mockGetMsgConvEq2 = jest.fn().mockReturnValue({ single: mockGetMsgConvSingle });
const mockGetMsgConvEq1 = jest.fn().mockReturnValue({ eq: mockGetMsgConvEq2 });
const mockGetMsgConvSelect = jest.fn().mockReturnValue({ eq: mockGetMsgConvEq1 });

// from('messages').select().eq(conversation_id).order()
const mockMsgListOrder = jest.fn();
const mockMsgListEq = jest.fn().mockReturnValue({ order: mockMsgListOrder });
const mockMsgListSelect = jest.fn().mockReturnValue({ eq: mockMsgListEq });

// ── expressions.GET / ──
// from('expressions').select().eq(user_id).order()
const mockExprListOrder = jest.fn();
const mockExprListEq = jest.fn().mockReturnValue({ order: mockExprListOrder });
const mockExprListSelect = jest.fn().mockReturnValue({ eq: mockExprListEq });

// ── expressions.POST / ──
// from('expressions').insert().select().single()
const mockExprInsertSingle = jest.fn();
const mockExprInsertSelect = jest.fn().mockReturnValue({ single: mockExprInsertSingle });
const mockExprInsert = jest.fn().mockReturnValue({ select: mockExprInsertSelect });

// ── expressions.DELETE /:id ──
// from('expressions').delete().eq(id).eq(user_id).select()
const mockExprDeleteSelect = jest.fn();
const mockExprDeleteEq2 = jest.fn().mockReturnValue({ select: mockExprDeleteSelect });
const mockExprDeleteEq1 = jest.fn().mockReturnValue({ eq: mockExprDeleteEq2 });
const mockExprDelete = jest.fn().mockReturnValue({ eq: mockExprDeleteEq1 });

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
const conversationsRouter = require('../routes/conversations');
const expressionsRouter = require('../routes/expressions');

const app = express();
app.use(express.json());
app.use('/api/conversations', conversationsRouter);
app.use('/api/expressions', expressionsRouter);

// ─────────────────────────────────────────────
// 7. 체인 복원 헬퍼 (jest.resetAllMocks 후 필요)
// ─────────────────────────────────────────────
function restoreChainMocks() {
  // conversations POST /
  mockConvInsertSelect.mockReturnValue({ single: mockConvInsertSingle });
  mockConvInsert.mockReturnValue({ select: mockConvInsertSelect });

  // conversations GET /
  mockConvListEq.mockReturnValue({ order: mockConvListOrder });
  mockConvListSelect.mockReturnValue({ eq: mockConvListEq });

  // turn count
  mockTurnCountEq2.mockReturnValue({ eq: jest.fn().mockReturnValue(Promise.resolve({ count: 0, error: null })) });
  mockTurnCountEq1.mockReturnValue({ eq: mockTurnCountEq2 });
  mockTurnCountSelect.mockReturnValue({ eq: mockTurnCountEq1 });

  // conversations GET /:id/messages — conv ownership
  mockGetMsgConvEq2.mockReturnValue({ single: mockGetMsgConvSingle });
  mockGetMsgConvEq1.mockReturnValue({ eq: mockGetMsgConvEq2 });
  mockGetMsgConvSelect.mockReturnValue({ eq: mockGetMsgConvEq1 });

  // conversations GET /:id/messages — messages list
  mockMsgListEq.mockReturnValue({ order: mockMsgListOrder });
  mockMsgListSelect.mockReturnValue({ eq: mockMsgListEq });

  // expressions GET /
  mockExprListEq.mockReturnValue({ order: mockExprListOrder });
  mockExprListSelect.mockReturnValue({ eq: mockExprListEq });

  // expressions POST /
  mockExprInsertSelect.mockReturnValue({ single: mockExprInsertSingle });
  mockExprInsert.mockReturnValue({ select: mockExprInsertSelect });

  // expressions DELETE /:id
  mockExprDeleteEq2.mockReturnValue({ select: mockExprDeleteSelect });
  mockExprDeleteEq1.mockReturnValue({ eq: mockExprDeleteEq2 });
  mockExprDelete.mockReturnValue({ eq: mockExprDeleteEq1 });

  // authMiddleware mock 복원
  authMiddleware.mockImplementation((req, _res, next) => {
    req.user = { id: 'user-123', email: 'test@test.com' };
    next();
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  restoreChainMocks();
});

// ─────────────────────────────────────────────
// 8. 테스트
// ─────────────────────────────────────────────

// ── Test 1: POST /api/conversations → 201 ──
describe('POST /api/conversations', () => {
  test('1. topic_id, topic_label 제공 → 201 { id, topic_id, topic_label, created_at }', async () => {
    mockFrom.mockReturnValueOnce({ insert: mockConvInsert });
    mockConvInsertSingle.mockResolvedValueOnce({
      data: {
        id: 'conv-abc',
        topic_id: 'free_talk',
        topic_label: '자유 대화',
        created_at: '2026-03-22T00:00:00.000Z',
      },
      error: null,
    });

    const res = await request(app)
      .post('/api/conversations')
      .set('Authorization', 'Bearer valid-token')
      .send({ topic_id: 'free_talk', topic_label: '자유 대화' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: 'conv-abc',
      topic_id: 'free_talk',
      topic_label: '자유 대화',
      created_at: expect.any(String),
    });
  });
});

// ── Test 2: GET /api/conversations → 200 with turn_count ──
describe('GET /api/conversations', () => {
  test('2. 대화 목록 조회 → 200, turn_count 포함', async () => {
    // 1st from: conversations list
    mockFrom.mockReturnValueOnce({ select: mockConvListSelect });
    mockConvListOrder.mockResolvedValueOnce({
      data: [
        {
          id: 'conv-1',
          topic_id: 'free_talk',
          topic_label: '자유 대화',
          updated_at: '2026-03-22T10:00:00.000Z',
          created_at: '2026-03-22T09:00:00.000Z',
        },
      ],
      error: null,
    });

    // 2nd from: turn count for conv-1
    const mockTurnFinalEq = jest.fn().mockResolvedValueOnce({ count: 3, error: null });
    const mockTurnInnerEq = jest.fn().mockReturnValue({ eq: mockTurnFinalEq });
    const mockTurnInnerSelect = jest.fn().mockReturnValue({ eq: mockTurnInnerEq });
    mockFrom.mockReturnValueOnce({ select: mockTurnInnerSelect });

    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({
      id: 'conv-1',
      turn_count: 3,
    });
  });
});

// ── Test 3: GET /api/conversations/:id/messages → 200 turn_number ASC ──
describe('GET /api/conversations/:id/messages', () => {
  test('3. 메시지 목록 조회 → 200, turn_number 오름차순', async () => {
    // 1st from: conversations ownership check
    mockFrom.mockReturnValueOnce({ select: mockGetMsgConvSelect });
    mockGetMsgConvSingle.mockResolvedValueOnce({
      data: { id: 'conv-1' },
      error: null,
    });

    // 2nd from: messages list
    mockFrom.mockReturnValueOnce({ select: mockMsgListSelect });
    mockMsgListOrder.mockResolvedValueOnce({
      data: [
        {
          id: 'msg-1',
          turn_number: 1,
          role: 'user',
          content_type: 'user_speech',
          content: { text: 'Hello' },
          created_at: '2026-03-22T09:01:00.000Z',
        },
        {
          id: 'msg-2',
          turn_number: 2,
          role: 'assistant',
          content_type: 'ai_turn',
          content: { feedback: [], next_response: 'Hi there!' },
          created_at: '2026-03-22T09:01:05.000Z',
        },
      ],
      error: null,
    });

    const res = await request(app)
      .get('/api/conversations/conv-1/messages')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].turn_number).toBe(1);
    expect(res.body[1].turn_number).toBe(2);
  });
});

// ── Tests 4-6: GET /api/expressions — source_sentence 파생 ──
describe('GET /api/expressions', () => {
  function setupExprListMock(expressions) {
    mockFrom.mockReturnValueOnce({ select: mockExprListSelect });
    mockExprListOrder.mockResolvedValueOnce({ data: expressions, error: null });
  }

  test('4. source_block=feedback → source_sentence = feedback[0].corrected', async () => {
    setupExprListMock([
      {
        id: 'expr-1',
        expression_text: 'I go to school',
        source_block: 'feedback',
        user_memo: null,
        created_at: '2026-03-22T10:00:00.000Z',
        conversation_id: 'conv-1',
        message_id: 'msg-1',
        messages: {
          content: {
            feedback: [{ original: 'I goes', corrected: 'I go', is_perfect: false }],
            next_response: 'Great!',
          },
        },
      },
    ]);

    const res = await request(app)
      .get('/api/expressions')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body[0].source_sentence).toBe('I go');
  });

  test('5. source_block=response → source_sentence = next_response', async () => {
    setupExprListMock([
      {
        id: 'expr-2',
        expression_text: 'Great effort',
        source_block: 'response',
        user_memo: null,
        created_at: '2026-03-22T10:00:00.000Z',
        conversation_id: 'conv-1',
        message_id: 'msg-2',
        messages: {
          content: {
            feedback: [],
            next_response: 'Great effort indeed!',
          },
        },
      },
    ]);

    const res = await request(app)
      .get('/api/expressions')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body[0].source_sentence).toBe('Great effort indeed!');
  });

  test('6. source_block=user_speech → source_sentence = content.text', async () => {
    setupExprListMock([
      {
        id: 'expr-3',
        expression_text: 'I am happy',
        source_block: 'user_speech',
        user_memo: 'keep this',
        created_at: '2026-03-22T10:00:00.000Z',
        conversation_id: 'conv-1',
        message_id: 'msg-3',
        messages: {
          content: {
            text: 'I am happy today',
          },
        },
      },
    ]);

    const res = await request(app)
      .get('/api/expressions')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body[0].source_sentence).toBe('I am happy today');
  });
});

// ── Test 7: POST /api/expressions — source_block 미포함 → 400 ──
describe('POST /api/expressions', () => {
  test('7. source_block 미포함 → 400 INVALID_REQUEST', async () => {
    const res = await request(app)
      .post('/api/expressions')
      .set('Authorization', 'Bearer valid-token')
      .send({ expression_text: 'Hello world', conversation_id: 'conv-1', message_id: 'msg-1' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });
});

// ── Tests 8-9: DELETE /api/expressions/:id ──
describe('DELETE /api/expressions/:id', () => {
  test('8. 삭제 성공 → 200 { success: true }', async () => {
    mockFrom.mockReturnValueOnce({ delete: mockExprDelete });
    mockExprDeleteSelect.mockResolvedValueOnce({
      data: [{ id: 'expr-1' }],
      error: null,
    });

    const res = await request(app)
      .delete('/api/expressions/expr-1')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  test('9. 존재하지 않는 표현 → 404 NOT_FOUND', async () => {
    mockFrom.mockReturnValueOnce({ delete: mockExprDelete });
    mockExprDeleteSelect.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const res = await request(app)
      .delete('/api/expressions/nonexistent-id')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
