'use strict';

/**
 * 공통 에러 응답 포맷
 * @param {import('express').Response} res
 * @param {number} status - HTTP 상태 코드
 * @param {string} code - 에러 코드 (예: 'UNAUTHORIZED', 'TURN_LIMIT_EXCEEDED')
 * @param {string} message - 에러 메시지
 */
function errorResponse(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

module.exports = { errorResponse };
