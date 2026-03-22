'use strict';

// ─────────────────────────────────────────────
// 1. Mock 선언 (jest.mock은 호이스팅되어 require보다 먼저 실행됨)
// ─────────────────────────────────────────────

// conversations.js: const OpenAI = require('openai') → require 결과 자체가 생성자
// factory를 쓰면 호이스팅 시점에도 안전하게 mock 구성 가능
// __mocks__ 객체에 create 함수를 저장해 테스트에서 참조
jest.mock('openai', () => {
  const mockChatCreate = jest.fn();
  const MockConstructor = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockChatCreate } },
  }));
  // 테스트에서 mockChatCreate에 접근할 수 있도록 생성자에 프로퍼티로 노출
  MockConstructor._mockChatCreate = mockChatCreate;
  return MockConstructor;
});

jest.mock('@supabase/supabase-js');
jest.mock('../utils/buildPrompt');

// ─────────────────────────────────────────────
// 2. require (mock 설정 후)
// ─────────────────────────────────────────────
const { createClient } = require('@supabase/supabase-js');
const MockOpenAI = require('openai');
const request = require('supertest');
const { buildPrompt } = require('../utils/buildPrompt');

// 테스트에서 쓸 mockChatCreate 참조
const mockChatCreate = MockOpenAI._mockChatCreate;

// ─────────────────────────────────────────────
// 3. Supabase mock 함수 (stable references)
// ─────────────────────────────────────────────

// auth
const mockGetUser = jest.fn();

// turnLimitMiddleware 체인:
//   from('messages').select(*,{count}).eq(user_id).eq(content_type).gte(created_at) → {count, error}
const mockTurnGte = jest.fn();
const mockTurnEq2 = jest.fn().mockReturnValue({ gte: mockTurnGte });
const mockTurnEq1 = jest.fn().mockReturnValue({ eq: mockTurnEq2 });
const mockTurnSelect = jest.fn().mockReturnValue({ eq: mockTurnEq1 });

// conversations 소유권 확인 체인:
//   from('conversations').select(...).eq(id).eq(user_id).single() → {data, error}
const mockConvSingle = jest.fn();
const mockConvEq2 = jest.fn().mockReturnValue({ single: mockConvSingle });
const mockConvEq1 = jest.fn().mockReturnValue({ eq: mockConvEq2 });
const mockConvSelect = jest.fn().mockReturnValue({ eq: mockConvEq1 });

// messages 히스토리 조회 체인:
//   from('messages').select(...).eq(conversation_id).in(content_type).order(...).limit(6)
const mockHistLimit = jest.fn();
const mockHistOrder = jest.fn().mockReturnValue({ limit: mockHistLimit });
const mockHistIn = jest.fn().mockReturnValue({ order: mockHistOrder });
const mockHistEq = jest.fn().mockReturnValue({ in: mockHistIn });
const mockHistSelect = jest.fn().mockReturnValue({ eq: mockHistEq });

// maxTurn 조회 체인:
//   from('messages').select(...).eq(conversation_id).order(...).limit(1)
const mockMaxLimit = jest.fn();
const mockMaxOrder = jest.fn().mockReturnValue({ limit: mockMaxLimit });
const mockMaxEq = jest.fn().mockReturnValue({ order: mockMaxOrder });
const mockMaxSelect = jest.fn().mockReturnValue({ eq: mockMaxEq });

// 사용자 발화 INSERT:
//   from('messages').insert({...}) → {error}
const mockUserInsert = jest.fn();

// AI 응답 INSERT 체인:
//   from('messages').insert({...}).select(...).single() → {data, error}
const mockAiInsertSingle = jest.fn();
const mockAiInsertSelect = jest.fn().mockReturnValue({ single: mockAiInsertSingle });
const mockAiInsert = jest.fn().mockReturnValue({ select: mockAiInsertSelect });

// from() — 호출 순서에 따라 다른 체인 반환
const mockFrom = jest.fn();

// ─────────────────────────────────────────────
// 4. createClient mock 설정 (supabase.js require 전에 완료해야 함)
// ─────────────────────────────────────────────
createClient.mockReturnValue({
  auth: { getUser: mockGetUser },
  from: mockFrom,
});

// ─────────────────────────────────────────────
// 5. 라우터 require (supabase + openai mock 이후)
//    이 시점에 conversations.js 내부의 new OpenAI() 가 호출됨
// ─────────────────────────────────────────────
const conversationsRouter = require('../routes/conversations');

const express = require('express');
const app = express();
app.use(express.json());
app.use('/api/conversations', conversationsRouter);

// ─────────────────────────────────────────────
// 6. 헬퍼
// ─────────────────────────────────────────────

/**
 * from() 호출 순서:
 *   1. turnLimitMiddleware: messages (count)
 *   2. conversations 소유권
 *   3. messages 히스토리
 *   4. messages maxTurn
 *   5. messages 사용자 INSERT
 *   6. messages AI INSERT
 */
function setupDefaultFromChain({ historyMessages = [], maxTurnNumber = 0 } = {}) {
  mockFrom
    .mockReturnValueOnce({ select: mockTurnSelect })      // 1: turn count
    .mockReturnValueOnce({ select: mockConvSelect })      // 2: conversation
    .mockReturnValueOnce({ select: mockHistSelect })      // 3: history
    .mockReturnValueOnce({ select: mockMaxSelect })       // 4: maxTurn
    .mockReturnValueOnce({ insert: mockUserInsert })      // 5: user insert
    .mockReturnValueOnce({ insert: mockAiInsert });       // 6: ai insert

  mockTurnGte.mockResolvedValueOnce({ count: 0, error: null });
  mockConvSingle.mockResolvedValueOnce({
    data: { id: 'conv-1', topic_id: 'free_talk' },
    error: null,
  });
  mockHistLimit.mockResolvedValueOnce({ data: historyMessages, error: null });
  mockMaxLimit.mockResolvedValueOnce({
    data: maxTurnNumber > 0 ? [{ turn_number: maxTurnNumber }] : [],
    error: null,
  });
  mockUserInsert.mockResolvedValueOnce({ error: null });
  mockAiInsertSingle.mockResolvedValueOnce({
    data: { id: 'msg-ai-1', turn_number: maxTurnNumber + 2 },
    error: null,
  });
}

/** clearAllMocks()가 mockReturnValue도 초기화하므로 체인 복원 */
function restoreChainMocks() {
  mockTurnEq2.mockReturnValue({ gte: mockTurnGte });
  mockTurnEq1.mockReturnValue({ eq: mockTurnEq2 });
  mockTurnSelect.mockReturnValue({ eq: mockTurnEq1 });

  mockConvEq2.mockReturnValue({ single: mockConvSingle });
  mockConvEq1.mockReturnValue({ eq: mockConvEq2 });
  mockConvSelect.mockReturnValue({ eq: mockConvEq1 });

  mockHistOrder.mockReturnValue({ limit: mockHistLimit });
  mockHistIn.mockReturnValue({ order: mockHistOrder });
  mockHistEq.mockReturnValue({ in: mockHistIn });
  mockHistSelect.mockReturnValue({ eq: mockHistEq });

  mockMaxOrder.mockReturnValue({ limit: mockMaxLimit });
  mockMaxEq.mockReturnValue({ order: mockMaxOrder });
  mockMaxSelect.mockReturnValue({ eq: mockMaxEq });

  mockAiInsertSelect.mockReturnValue({ single: mockAiInsertSingle });
  mockAiInsert.mockReturnValue({ select: mockAiInsertSelect });
}

// ─────────────────────────────────────────────
// 7. 각 테스트 전 초기화
// ─────────────────────────────────────────────
beforeEach(() => {
  // resetAllMocks: mock 호출 기록 + mockReturnValueOnce 큐 + mockReturnValue 모두 초기화
  // clearAllMocks는 Once 큐를 지우지 않아 테스트 간 잔류 값 문제가 생기므로 reset 사용
  jest.resetAllMocks();
  restoreChainMocks();

  // resetAllMocks가 MockOpenAI.mockImplementation도 초기화하므로 재설정
  // (conversations.js 내부의 openai 인스턴스는 이미 생성되어 고정이므로
  //  mockChatCreate 참조 자체는 살아있음 — 인스턴스 재생성 불필요)

  // 기본: 유효한 사용자 인증
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'test@test.com' } },
    error: null,
  });

  // buildPrompt 기본 반환값
  buildPrompt.mockReturnValue('You are an English conversation tutor.');

  // 기본 GPT 응답: is_perfect: false 케이스
  mockChatCreate.mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            feedback: [{ original: 'I goes', corrected: 'I go', is_perfect: false }],
            next_response: 'Great effort!',
          }),
        },
      },
    ],
  });
});

// ─────────────────────────────────────────────
// 8. 테스트
// ─────────────────────────────────────────────
describe('POST /api/conversations/:id/messages', () => {
  // ── 테스트 1: 유효한 텍스트 전송 → 201 정상 응답 ──
  test('1. 유효한 텍스트 전송 → 201, { message_id, turn_number, content } 응답', async () => {
    setupDefaultFromChain();

    const res = await request(app)
      .post('/api/conversations/conv-1/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ text: 'Hello, how are you?' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      message_id: 'msg-ai-1',
      turn_number: expect.any(Number),
      content: {
        feedback: expect.any(Array),
        next_response: 'Great effort!',
      },
    });
    expect(res.body.content.feedback[0]).toMatchObject({
      original: 'I goes',
      corrected: 'I go',
      is_perfect: false,
    });
  });

  // ── 테스트 2: is_perfect: true 응답 시 original/corrected === null ──
  test('2. is_perfect: true 응답 시 original === null && corrected === null', async () => {
    mockChatCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              feedback: [{ original: null, corrected: null, is_perfect: true }],
              next_response: 'Perfect! That was excellent.',
            }),
          },
        },
      ],
    });

    setupDefaultFromChain();

    const res = await request(app)
      .post('/api/conversations/conv-1/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ text: 'I am going to the store.' });

    expect(res.status).toBe(201);
    const feedbackItem = res.body.content.feedback[0];
    expect(feedbackItem.is_perfect).toBe(true);
    expect(feedbackItem.original).toBeNull();
    expect(feedbackItem.corrected).toBeNull();
    expect(res.body.content.next_response).toBe('Perfect! That was excellent.');
  });

  // ── 테스트 3: 7번째 턴 — LLM 호출 시 messages 길이가 8개 이하 ──
  test('3. 7번째 턴: LLM에 전달되는 messages = system(1) + history(6) + user(1) = 8개', async () => {
    // DB에서 반환되는 6턴 히스토리 (limit(6)으로 슬라이딩 윈도우 적용됨)
    const sixTurnHistory = [
      { id: 'm1', turn_number: 1, content_type: 'user_speech', content: { text: 'Turn 1 user' } },
      { id: 'm2', turn_number: 2, content_type: 'ai_turn', content: { feedback: [], next_response: 'Turn 1 ai' } },
      { id: 'm3', turn_number: 3, content_type: 'user_speech', content: { text: 'Turn 2 user' } },
      { id: 'm4', turn_number: 4, content_type: 'ai_turn', content: { feedback: [], next_response: 'Turn 2 ai' } },
      { id: 'm5', turn_number: 5, content_type: 'user_speech', content: { text: 'Turn 3 user' } },
      { id: 'm6', turn_number: 6, content_type: 'ai_turn', content: { feedback: [], next_response: 'Turn 3 ai' } },
    ];

    setupDefaultFromChain({ historyMessages: sixTurnHistory, maxTurnNumber: 6 });

    const res = await request(app)
      .post('/api/conversations/conv-1/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ text: 'This is turn 7 user input.' });

    expect(res.status).toBe(201);

    expect(mockChatCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockChatCreate.mock.calls[0][0];
    const messages = callArgs.messages;

    // system(1) + 6 history + user(1) = 8
    expect(messages).toHaveLength(8);
    expect(messages[0].role).toBe('system');
    expect(messages[messages.length - 1].role).toBe('user');
    expect(messages[messages.length - 1].content).toBe('This is turn 7 user input.');

    // history 6개 확인
    const historyPart = messages.slice(1, -1);
    expect(historyPart).toHaveLength(6);
  });

  // ── 테스트 4: JSON 파싱 3회 모두 실패 → 502 LLM_JSON_PARSE_FAILED ──
  test('4. LLM JSON 파싱 3회 모두 실패 → 502 LLM_JSON_PARSE_FAILED, 3회 시도 확인', async () => {
    // invalid JSON 반환 → JSON.parse 예외 발생
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: 'THIS IS NOT JSON {{{{' } }],
    });

    // 502까지 가는 경로: turnLimit → conv → hist → maxTurn (INSERT는 도달 안 함)
    mockFrom
      .mockReturnValueOnce({ select: mockTurnSelect })
      .mockReturnValueOnce({ select: mockConvSelect })
      .mockReturnValueOnce({ select: mockHistSelect })
      .mockReturnValueOnce({ select: mockMaxSelect });

    mockTurnGte.mockResolvedValueOnce({ count: 0, error: null });
    mockConvSingle.mockResolvedValueOnce({
      data: { id: 'conv-1', topic_id: 'free_talk' },
      error: null,
    });
    mockHistLimit.mockResolvedValueOnce({ data: [], error: null });
    mockMaxLimit.mockResolvedValueOnce({ data: [], error: null });

    const res = await request(app)
      .post('/api/conversations/conv-1/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ text: 'Hello world' });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('LLM_JSON_PARSE_FAILED');
    // attempt 0, 1, 2 — 총 3회 호출
    expect(mockChatCreate).toHaveBeenCalledTimes(3);
  });

  // ── 테스트 5: 20회 소진 상태 → 429 TURN_LIMIT_EXCEEDED, INSERT 없음 ──
  test('5. 20회 소진 상태 → 429 TURN_LIMIT_EXCEEDED, messages INSERT 호출 없음', async () => {
    // turnLimitMiddleware: count >= 20
    mockFrom.mockReturnValueOnce({ select: mockTurnSelect });
    mockTurnGte.mockResolvedValueOnce({ count: 20, error: null });

    const res = await request(app)
      .post('/api/conversations/conv-1/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ text: 'One more message please' });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TURN_LIMIT_EXCEEDED');

    // messages INSERT가 절대 호출되지 않아야 함
    expect(mockUserInsert).not.toHaveBeenCalled();
    expect(mockAiInsert).not.toHaveBeenCalled();
  });

  // ── 테스트 6: 타인 conversation id → 404 CONVERSATION_NOT_FOUND ──
  test('6. 타인 소유 conversation id로 요청 → 404 CONVERSATION_NOT_FOUND', async () => {
    // turnLimit 통과 후 .eq('user_id', ...) 조건 불일치 → data: null
    mockFrom
      .mockReturnValueOnce({ select: mockTurnSelect })
      .mockReturnValueOnce({ select: mockConvSelect });

    mockTurnGte.mockResolvedValueOnce({ count: 0, error: null });
    mockConvSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

    const res = await request(app)
      .post('/api/conversations/other-user-conv/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ text: 'Trying to access someone else conversation' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CONVERSATION_NOT_FOUND');
  });
});
