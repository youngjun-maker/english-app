'use strict';

const { supabase } = require('../utils/supabase');
const { errorResponse } = require('../utils/errorResponse');

async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return errorResponse(res, 401, 'UNAUTHORIZED', '인증 토큰이 필요합니다');
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return errorResponse(res, 401, 'UNAUTHORIZED', '유효하지 않거나 만료된 토큰입니다');
  }

  req.user = { id: data.user.id, email: data.user.email };
  next();
}

module.exports = { authMiddleware };
