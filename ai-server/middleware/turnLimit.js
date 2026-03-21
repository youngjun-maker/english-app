'use strict';

const { errorResponse } = require('../utils/errorResponse');

// 일일 20턴 제한 미들웨어 (KST 자정 리셋)
async function turnLimitMiddleware(req, res, next) {
  // TODO: Phase 3에서 구현 (Task 013)
  // messages 테이블에서 오늘 user_id + content_type='user_speech' 카운트
  next();
}

module.exports = { turnLimitMiddleware };
