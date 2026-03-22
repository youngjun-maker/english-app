'use strict';

jest.mock('@supabase/supabase-js');

const { createClient } = require('@supabase/supabase-js');
const request = require('supertest');
const express = require('express');

// 안정적인 mock 함수 (모듈 수준 선언 — supabase.js 캐시와 동일 참조 유지)
const mockGetUser = jest.fn();
const mockGte = jest.fn();
const mockEq2 = jest.fn().mockReturnValue({ gte: mockGte });
const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 });
const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

// middleware require 전에 createClient 반환값 설정
createClient.mockReturnValue({
  auth: { getUser: mockGetUser },
  from: mockFrom,
});

// supabase.js가 위 mock으로 초기화된 이후 미들웨어 로드
const { authMiddleware } = require('../middleware/auth');
const { turnLimitMiddleware } = require('../middleware/turnLimit');

const app = express();
app.use(express.json());
app.get('/protected', authMiddleware, (req, res) => res.json({ userId: req.user.id }));
app.get('/limited', authMiddleware, turnLimitMiddleware, (req, res) =>
  res.json({ count: req.todayTurnCount })
);

beforeEach(() => {
  jest.clearAllMocks();
  // 체인 복원 (clearAllMocks가 mockReturnValue도 초기화하므로)
  mockEq2.mockReturnValue({ gte: mockGte });
  mockEq1.mockReturnValue({ eq: mockEq2 });
  mockSelect.mockReturnValue({ eq: mockEq1 });
  mockFrom.mockReturnValue({ select: mockSelect });
  // 기본값: 유효 유저, 오늘 0회
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'test@test.com' } },
    error: null,
  });
  mockGte.mockResolvedValue({ count: 0, error: null });
});

describe('authMiddleware', () => {
  test('유효한 JWT → 200, req.user 주입', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('user-1');
  });

  test('Authorization 헤더 없음 → 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('만료된 JWT → 401 UNAUTHORIZED', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'JWT expired' },
    });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer expired-token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('turnLimitMiddleware', () => {
  test('오늘 0회 → 200, todayTurnCount=0', async () => {
    const res = await request(app)
      .get('/limited')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
  });

  test('오늘 20회 소진 → 429 TURN_LIMIT_EXCEEDED', async () => {
    mockGte.mockResolvedValueOnce({ count: 20, error: null });
    const res = await request(app)
      .get('/limited')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TURN_LIMIT_EXCEEDED');
  });

  test('KST 기준 오늘 자정 계산 — 어제 레코드 미포함 검증', async () => {
    jest.useFakeTimers();
    // KST 2026-03-22 10:00:00 = UTC 2026-03-22 01:00:00
    jest.setSystemTime(new Date('2026-03-22T01:00:00.000Z'));

    await request(app)
      .get('/limited')
      .set('Authorization', 'Bearer valid-token');

    // KST 2026-03-22 00:00:00 = UTC 2026-03-21 15:00:00
    expect(mockGte).toHaveBeenCalledWith('created_at', '2026-03-21T15:00:00.000Z');

    jest.useRealTimers();
  });
});
