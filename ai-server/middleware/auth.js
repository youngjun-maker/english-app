'use strict';

const { errorResponse } = require('../utils/errorResponse');

// Supabase JWT 검증 미들웨어
async function authMiddleware(req, res, next) {
  // TODO: Phase 3에서 구현 (Task 012)
  // Authorization: Bearer <supabase_jwt> 검증
  next();
}

module.exports = { authMiddleware };
