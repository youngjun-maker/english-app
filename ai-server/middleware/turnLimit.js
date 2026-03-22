'use strict';

const { supabase } = require('../utils/supabase');
const { errorResponse } = require('../utils/errorResponse');

function getKstTodayStart() {
  const nowMs = Date.now();
  const kstMs = nowMs + 9 * 3600 * 1000;
  const kstMidnightMs = Math.floor(kstMs / 86400000) * 86400000;
  return new Date(kstMidnightMs - 9 * 3600 * 1000);
}

async function turnLimitMiddleware(req, res, next) {
  const kstTodayStart = getKstTodayStart();

  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', req.user.id)
    .eq('content_type', 'user_speech')
    .gte('created_at', kstTodayStart.toISOString());

  if (error) {
    return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
  }
  if (count >= 20) {
    return errorResponse(res, 429, 'TURN_LIMIT_EXCEEDED', '일일 20턴 제한에 도달했습니다');
  }

  req.todayTurnCount = count;
  next();
}

module.exports = { turnLimitMiddleware };
