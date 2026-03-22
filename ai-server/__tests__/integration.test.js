'use strict';

// ─────────────────────────────────────────────
// 1. Mock 선언 (jest.mock은 호이스팅되어 require보다 먼저 실행됨)
// ─────────────────────────────────────────────

// conversations.js: const OpenAI = require('openai') — default export
// stt.js / tts.js: const { OpenAI } = require('openai') — named export
// 두 패턴을 모두 지원하도록 MockConstructor를 default이자 named export로 노출
jest.mock('openai', () => {
  const mockChatCreate = jest.fn();
  const mockTranscriptionsCreate = jest.fn();
  const mockSpeechCreate = jest.fn();

  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockChatCreate } },
    audio: {
      transcriptions: { create: mockTranscriptionsCreate },
      speech: { create: mockSpeechCreate },
    },
  }));

  // 테스트에서 개별 mock 함수에 접근하기 위해 생성자에 저장
  MockOpenAI._mockChatCreate = mockChatCreate;
  MockOpenAI._mockTranscriptionsCreate = mockTranscriptionsCreate;
  MockOpenAI._mockSpeechCreate = mockSpeechCreate;

  // named export { OpenAI } 도 동일 생성자를 반환
  MockOpenAI.OpenAI = MockOpenAI;

  return MockOpenAI;
});

jest.mock('@supabase/supabase-js');
jest.mock('../middleware/auth');
jest.mock('../utils/buildPrompt');

// ─────────────────────────────────────────────
// 2. require (mock 설정 후)
// ─────────────────────────────────────────────
const { createClient } = require('@supabase/supabase-js');
const { authMiddleware } = require('../middleware/auth');
const { buildPrompt } = require('../utils/buildPrompt');
const MockOpenAI = require('openai');
const request = require('supertest');

// mock 함수 참조
const mockChatCreate = MockOpenAI._mockChatCreate;
const mockTranscriptionsCreate = MockOpenAI._mockTranscriptionsCreate;
const mockSpeechCreate = MockOpenAI._mockSpeechCreate;

// ─────────────────────────────────────────────
// 3. Supabase mock 함수 (stable references)
// ─────────────────────────────────────────────

const mockGetUser = jest.fn();

// ── turnLimitMiddleware 체인 ──
// from('messages').select(*,{count}).eq(user_id).eq(content_type).gte(created_at)
const mockTurnGte = jest.fn();
const mockTurnEq2 = jest.fn().mockReturnValue({ gte: mockTurnGte });
const mockTurnEq1 = jest.fn().mockReturnValue({ eq: mockTurnEq2 });
const mockTurnSelect = jest.fn().mockReturnValue({ eq: mockTurnEq1 });

// ── conversations 소유권 확인 체인 ──
// from('conversations').select().eq(id).eq(user_id).single()
const mockConvSingle = jest.fn();
const mockConvEq2 = jest.fn().mockReturnValue({ single: mockConvSingle });
const mockConvEq1 = jest.fn().mockReturnValue({ eq: mockConvEq2 });
const mockConvSelect = jest.fn().mockReturnValue({ eq: mockConvEq1 });

// ── messages 히스토리 조회 체인 ──
// from('messages').select().eq(conv_id).in(content_type).order().limit(6)
const mockHistLimit = jest.fn();
const mockHistOrder = jest.fn().mockReturnValue({ limit: mockHistLimit });
const mockHistIn = jest.fn().mockReturnValue({ order: mockHistOrder });
const mockHistEq = jest.fn().mockReturnValue({ in: mockHistIn });
const mockHistSelect = jest.fn().mockReturnValue({ eq: mockHistEq });

// ── messages maxTurn 조회 체인 ──
// from('messages').select().eq(conv_id).order().limit(1)
const mockMaxLimit = jest.fn();
const mockMaxOrder = jest.fn().mockReturnValue({ limit: mockMaxLimit });
const mockMaxEq = jest.fn().mockReturnValue({ order: mockMaxOrder });
const mockMaxSelect = jest.fn().mockReturnValue({ eq: mockMaxEq });

// ── messages 사용자 발화 INSERT ──
const mockUserInsert = jest.fn();

// ── messages AI 응답 INSERT 체인 ──
const mockAiInsertSingle = jest.fn();
const mockAiInsertSelect = jest.fn().mockReturnValue({ single: mockAiInsertSingle });
const mockAiInsert = jest.fn().mockReturnValue({ select: mockAiInsertSelect });

// ── POST /api/conversations → INSERT 체인 ──
const mockNewConvSingle = jest.fn();
const mockNewConvInsertSelect = jest.fn().mockReturnValue({ single: mockNewConvSingle });
const mockNewConvInsert = jest.fn().mockReturnValue({ select: mockNewConvInsertSelect });

// ── POST /api/expressions → INSERT 체인 ──
const mockExprInsertSingle = jest.fn();
const mockExprInsertSelect = jest.fn().mockReturnValue({ single: mockExprInsertSingle });
const mockExprInsert = jest.fn().mockReturnValue({ select: mockExprInsertSelect });

// ── GET /api/expressions → 조회 체인 ──
const mockExprListOrder = jest.fn();
const mockExprListEq = jest.fn().mockReturnValue({ order: mockExprListOrder });
const mockExprListSelect = jest.fn().mockReturnValue({ eq: mockExprListEq });

// ── from() 디스패처 ──
const mockFrom = jest.fn();

// ─────────────────────────────────────────────
// 4. createClient mock 설정
// ─────────────────────────────────────────────
createClient.mockReturnValue({
  auth: { getUser: mockGetUser },
  from: mockFrom,
});

// ─────────────────────────────────────────────
// 5. app 로드 (mock 설정 완료 후)
// ─────────────────────────────────────────────
const app = require('../app');

// ─────────────────────────────────────────────
// 6. 헬퍼
// ─────────────────────────────────────────────

/**
 * clearAllMocks/resetAllMocks 후 체인 mockReturnValue 복원
 */
function restoreChainMocks() {
  // turnLimit
  mockTurnEq2.mockReturnValue({ gte: mockTurnGte });
  mockTurnEq1.mockReturnValue({ eq: mockTurnEq2 });
  mockTurnSelect.mockReturnValue({ eq: mockTurnEq1 });

  // conversation ownership
  mockConvEq2.mockReturnValue({ single: mockConvSingle });
  mockConvEq1.mockReturnValue({ eq: mockConvEq2 });
  mockConvSelect.mockReturnValue({ eq: mockConvEq1 });

  // history
  mockHistOrder.mockReturnValue({ limit: mockHistLimit });
  mockHistIn.mockReturnValue({ order: mockHistOrder });
  mockHistEq.mockReturnValue({ in: mockHistIn });
  mockHistSelect.mockReturnValue({ eq: mockHistEq });

  // maxTurn
  mockMaxOrder.mockReturnValue({ limit: mockMaxLimit });
  mockMaxEq.mockReturnValue({ order: mockMaxOrder });
  mockMaxSelect.mockReturnValue({ eq: mockMaxEq });

  // ai insert
  mockAiInsertSelect.mockReturnValue({ single: mockAiInsertSingle });
  mockAiInsert.mockReturnValue({ select: mockAiInsertSelect });

  // new conversation insert
  mockNewConvInsertSelect.mockReturnValue({ single: mockNewConvSingle });
  mockNewConvInsert.mockReturnValue({ select: mockNewConvInsertSelect });

  // expressions insert
  mockExprInsertSelect.mockReturnValue({ single: mockExprInsertSingle });
  mockExprInsert.mockReturnValue({ select: mockExprInsertSelect });

  // expressions list
  mockExprListEq.mockReturnValue({ order: mockExprListOrder });
  mockExprListSelect.mockReturnValue({ eq: mockExprListEq });
}

/**
 * POST /api/conversations/:id/messages 용 from() 체인 기본 설정
 * turnLimit(1) → conv ownership(2) → history(3) → maxTurn(4) → userInsert(5) → aiInsert(6)
 */
function setupMessagesFromChain({ historyMessages = [], maxTurnNumber = 0, turnCount = 0 } = {}) {
  mockFrom
    .mockReturnValueOnce({ select: mockTurnSelect })    // 1: turn count
    .mockReturnValueOnce({ select: mockConvSelect })    // 2: conversation ownership
    .mockReturnValueOnce({ select: mockHistSelect })    // 3: history
    .mockReturnValueOnce({ select: mockMaxSelect })     // 4: maxTurn
    .mockReturnValueOnce({ insert: mockUserInsert })    // 5: user insert
    .mockReturnValueOnce({ insert: mockAiInsert });     // 6: ai insert

  mockTurnGte.mockResolvedValueOnce({ count: turnCount, error: null });
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

// ─────────────────────────────────────────────
// 7. 각 테스트 전 초기화
// ─────────────────────────────────────────────
beforeEach(() => {
  jest.resetAllMocks();
  restoreChainMocks();

  // 기본: 인증 성공 (req.user 주입)
  authMiddleware.mockImplementation((req, _res, next) => {
    req.user = { id: 'user-123', email: 'test@test.com' };
    next();
  });

  // buildPrompt 기본값
  buildPrompt.mockReturnValue('You are an English conversation tutor.');

  // 기본 GPT 응답
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

afterEach(() => {
  jest.useRealTimers();
});

// ─────────────────────────────────────────────
// 8. 테스트
// ─────────────────────────────────────────────

// ══════════════════════════════════════════════
// Describe 1: E2E 전체 대화 플로우
// ══════════════════════════════════════════════
describe('E2E 전체 대화 플로우', () => {
  test('1. 대화 생성 → 메시지 전송 → 표현 저장 → 표현 목록 조회 순서 검증', async () => {
    // ── Step 1: POST /api/conversations ──
    mockFrom.mockReturnValueOnce({ insert: mockNewConvInsert });
    mockNewConvSingle.mockResolvedValueOnce({
      data: {
        id: 'conv-e2e',
        topic_id: 'free_talk',
        topic_label: '자유 대화',
        created_at: '2026-03-22T10:00:00.000Z',
      },
      error: null,
    });

    const convRes = await request(app)
      .post('/api/conversations')
      .set('Authorization', 'Bearer valid-token')
      .send({ topic_id: 'free_talk', topic_label: '자유 대화' });

    expect(convRes.status).toBe(201);
    expect(convRes.body).toMatchObject({
      id: 'conv-e2e',
      topic_id: 'free_talk',
      topic_label: '자유 대화',
      created_at: expect.any(String),
    });

    // ── Step 2: POST /api/conversations/:id/messages ──
    setupMessagesFromChain({ maxTurnNumber: 0 });

    const msgRes = await request(app)
      .post('/api/conversations/conv-e2e/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ text: 'Hello, how are you?' });

    expect(msgRes.status).toBe(201);
    expect(msgRes.body).toMatchObject({
      message_id: 'msg-ai-1',
      turn_number: expect.any(Number),
      content: {
        feedback: expect.any(Array),
        next_response: 'Great effort!',
      },
    });

    // ── Step 3: POST /api/expressions ──
    mockFrom.mockReturnValueOnce({ insert: mockExprInsert });
    mockExprInsertSingle.mockResolvedValueOnce({
      data: { id: 'expr-e2e', created_at: '2026-03-22T10:01:00.000Z' },
      error: null,
    });

    const exprPostRes = await request(app)
      .post('/api/expressions')
      .set('Authorization', 'Bearer valid-token')
      .send({
        expression_text: 'I go',
        source_block: 'feedback',
        conversation_id: 'conv-e2e',
        message_id: 'msg-ai-1',
      });

    expect(exprPostRes.status).toBe(201);
    expect(exprPostRes.body).toMatchObject({
      id: 'expr-e2e',
      created_at: expect.any(String),
    });

    // ── Step 4: GET /api/expressions ──
    mockFrom.mockReturnValueOnce({ select: mockExprListSelect });
    mockExprListOrder.mockResolvedValueOnce({
      data: [
        {
          id: 'expr-e2e',
          expression_text: 'I go',
          source_block: 'feedback',
          user_memo: null,
          created_at: '2026-03-22T10:01:00.000Z',
          conversation_id: 'conv-e2e',
          message_id: 'msg-ai-1',
          messages: {
            content: {
              feedback: [{ original: 'I goes', corrected: 'I go', is_perfect: false }],
              next_response: 'Great effort!',
            },
          },
        },
      ],
      error: null,
    });

    const exprGetRes = await request(app)
      .get('/api/expressions')
      .set('Authorization', 'Bearer valid-token');

    expect(exprGetRes.status).toBe(200);
    expect(Array.isArray(exprGetRes.body)).toBe(true);
    expect(exprGetRes.body[0]).toMatchObject({
      id: 'expr-e2e',
      expression_text: 'I go',
      source_sentence: 'I go',
    });
  });

  test('2. 6-turn 슬라이딩 윈도우 — LLM에 전달되는 messages 배열이 8개 이하여야 함 (history 6 초과 불가)', async () => {
    // DB에 7개 메시지가 있지만 limit(6)으로 최근 6개만 반환하는 상황을 시뮬레이션
    // (서버가 실제로 limit(6)을 사용하므로 mock도 6개만 반환)
    const sixTurnHistory = [
      { id: 'm1', turn_number: 1, content_type: 'user_speech', content: { text: 'Turn 1 user' } },
      { id: 'm2', turn_number: 2, content_type: 'ai_turn', content: { feedback: [], next_response: 'Turn 1 ai' } },
      { id: 'm3', turn_number: 3, content_type: 'user_speech', content: { text: 'Turn 2 user' } },
      { id: 'm4', turn_number: 4, content_type: 'ai_turn', content: { feedback: [], next_response: 'Turn 2 ai' } },
      { id: 'm5', turn_number: 5, content_type: 'user_speech', content: { text: 'Turn 3 user' } },
      { id: 'm6', turn_number: 6, content_type: 'ai_turn', content: { feedback: [], next_response: 'Turn 3 ai' } },
    ];

    setupMessagesFromChain({ historyMessages: sixTurnHistory, maxTurnNumber: 6 });

    const res = await request(app)
      .post('/api/conversations/conv-1/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ text: 'This is turn 7 user input.' });

    expect(res.status).toBe(201);

    expect(mockChatCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockChatCreate.mock.calls[0][0];
    const messages = callArgs.messages;

    // system(1) + history(6) + current_user(1) = 8
    expect(messages.length).toBeLessThanOrEqual(8);
    expect(messages[0].role).toBe('system');
    expect(messages[messages.length - 1].role).toBe('user');
    expect(messages[messages.length - 1].content).toBe('This is turn 7 user input.');

    // history 부분 (system 제외, current user 제외)
    const historyPart = messages.slice(1, -1);
    expect(historyPart.length).toBeLessThanOrEqual(6);
    expect(historyPart).toHaveLength(6);
  });
});

// ══════════════════════════════════════════════
// Describe 2: 일일 20턴 제한
// ══════════════════════════════════════════════
describe('일일 20턴 제한', () => {
  test('3. 오늘 턴 20회 소진 → 429 TURN_LIMIT_EXCEEDED, messages INSERT 호출 없음', async () => {
    // turnLimitMiddleware: count >= 20 → 미들웨어에서 차단
    mockFrom.mockReturnValueOnce({ select: mockTurnSelect });
    mockTurnGte.mockResolvedValueOnce({ count: 20, error: null });

    const res = await request(app)
      .post('/api/conversations/conv-1/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ text: 'One more message please' });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TURN_LIMIT_EXCEEDED');
    expect(res.body.error.message).toBeDefined();

    // 라우터 핸들러(INSERT)에 도달하지 않아야 함
    expect(mockUserInsert).not.toHaveBeenCalled();
    expect(mockAiInsert).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════
// Describe 3: KST 자정 리셋
// ══════════════════════════════════════════════
describe('KST 자정 리셋', () => {
  test('4. KST 2026-03-22 01:00 기준 — Supabase에 전달되는 gte 파라미터가 KST 자정(UTC 2026-03-21T15:00:00.000Z)임을 검증', async () => {
    jest.useFakeTimers();
    // KST 2026-03-22 01:00:00 = UTC 2026-03-21 16:00:00
    jest.setSystemTime(new Date('2026-03-22T01:00:00+09:00'));

    mockFrom.mockReturnValueOnce({ select: mockTurnSelect });
    mockTurnGte.mockResolvedValueOnce({ count: 0, error: null });

    await request(app)
      .post('/api/conversations/conv-1/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ text: 'hello' });

    // KST 2026-03-22 00:00:00 = UTC 2026-03-21 15:00:00
    // turnLimitMiddleware가 gte('created_at', ...) 에 전달하는 timestamp 검증
    expect(mockTurnGte).toHaveBeenCalledWith('created_at', '2026-03-21T15:00:00.000Z');

    // 어제(UTC 2026-03-21 14:59:59) 레코드는 조회 범위 밖임을 timestamp 비교로 확인
    const gteTimestamp = mockTurnGte.mock.calls[0][1];
    const yesterdayRecord = new Date('2026-03-21T14:59:59.000Z');
    const cutoff = new Date(gteTimestamp);
    expect(yesterdayRecord.getTime()).toBeLessThan(cutoff.getTime());
  });
});

// ══════════════════════════════════════════════
// Describe 4: 에러 코드 7종 포맷 일관성
// ══════════════════════════════════════════════
describe('에러 코드 7종 포맷 일관성', () => {
  // 공통 assertion 헬퍼
  function assertErrorFormat(body) {
    expect(body.error).toBeDefined();
    expect(typeof body.error.code).toBe('string');
    expect(body.error.code.length).toBeGreaterThan(0);
    expect(typeof body.error.message).toBe('string');
    expect(body.error.message.length).toBeGreaterThan(0);
  }

  test('4-1. UNAUTHORIZED — Authorization 헤더 없이 보호된 엔드포인트 요청 → 401', async () => {
    // 이 테스트에서만 실제 authMiddleware 동작을 시뮬레이션 (헤더 없음 → 401)
    authMiddleware.mockImplementation((req, res, _next) => {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '인증 토큰이 필요합니다' } });
      }
      req.user = { id: 'user-123', email: 'test@test.com' };
      _next();
    });

    const res = await request(app)
      .post('/api/conversations/conv-1/messages')
      .send({ text: 'hello' });
    // Authorization 헤더 없음

    expect(res.status).toBe(401);
    assertErrorFormat(res.body);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('4-2. INVALID_AUDIO_FORMAT — mp3 mimetype 파일로 POST /api/stt → 400', async () => {
    const res = await request(app)
      .post('/api/stt')
      .set('Authorization', 'Bearer valid-token')
      .attach('audio', Buffer.from('fake audio data'), {
        filename: 'recording.mp3',
        contentType: 'audio/mpeg',
      });

    expect(res.status).toBe(400);
    assertErrorFormat(res.body);
    expect(res.body.error.code).toBe('INVALID_AUDIO_FORMAT');
  });

  test('4-3. AUDIO_TOO_LONG — 500KB 초과 파일로 POST /api/stt → 400', async () => {
    // 500KB 초과 버퍼 생성 (501 * 1024 bytes)
    const oversizedBuffer = Buffer.alloc(501 * 1024, 0);

    const res = await request(app)
      .post('/api/stt')
      .set('Authorization', 'Bearer valid-token')
      .attach('audio', oversizedBuffer, {
        filename: 'recording.m4a',
        contentType: 'audio/mp4',
      });

    expect(res.status).toBe(400);
    assertErrorFormat(res.body);
    expect(res.body.error.code).toBe('AUDIO_TOO_LONG');
  });

  test('4-4. STT_FAILED — OpenAI Whisper mock이 Error throw → 502', async () => {
    mockTranscriptionsCreate.mockRejectedValueOnce(new Error('Whisper API timeout'));

    // 유효한 m4a 파일 (500KB 이하, m4a 확장자)
    const validAudioBuffer = Buffer.alloc(100 * 1024, 0);

    const res = await request(app)
      .post('/api/stt')
      .set('Authorization', 'Bearer valid-token')
      .attach('audio', validAudioBuffer, {
        filename: 'recording.m4a',
        contentType: 'audio/mp4',
      });

    expect(res.status).toBe(502);
    assertErrorFormat(res.body);
    expect(res.body.error.code).toBe('STT_FAILED');
  });

  test('4-5. LLM_JSON_PARSE_FAILED — GPT mock이 3회 연속 JSON.parse 불가 응답 → 502', async () => {
    // 파싱 불가 응답을 3회 반환
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: 'INVALID JSON {{{{' } }],
    });

    // 502까지 가는 경로: turnLimit → conv → hist → maxTurn (INSERT는 호출 안 됨)
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
    assertErrorFormat(res.body);
    expect(res.body.error.code).toBe('LLM_JSON_PARSE_FAILED');
    // 3회 시도 확인
    expect(mockChatCreate).toHaveBeenCalledTimes(3);
  });

  test('4-6. TTS_FAILED — OpenAI TTS mock이 Error throw → 502', async () => {
    mockSpeechCreate.mockRejectedValueOnce(new Error('TTS API unavailable'));

    const res = await request(app)
      .post('/api/tts')
      .set('Authorization', 'Bearer valid-token')
      .send({ text: 'Hello, how are you?' });

    expect(res.status).toBe(502);
    assertErrorFormat(res.body);
    expect(res.body.error.code).toBe('TTS_FAILED');
  });

  test('4-7. TURN_LIMIT_EXCEEDED — count mock이 20 반환 후 메시지 전송 → 429', async () => {
    mockFrom.mockReturnValueOnce({ select: mockTurnSelect });
    mockTurnGte.mockResolvedValueOnce({ count: 20, error: null });

    const res = await request(app)
      .post('/api/conversations/conv-1/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ text: 'Exceeding the daily limit' });

    expect(res.status).toBe(429);
    assertErrorFormat(res.body);
    expect(res.body.error.code).toBe('TURN_LIMIT_EXCEEDED');
  });
});
