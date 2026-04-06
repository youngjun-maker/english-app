'use strict';

const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const { supabase } = require('../utils/supabase');
const { errorResponse } = require('../utils/errorResponse');
const { authMiddleware } = require('../middleware/auth');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 이번 주 월요일 날짜 반환 (YYYY-MM-DD)
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=일 ~ 6=토
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

// GET /api/reports/weekly
router.get('/weekly', authMiddleware, async (req, res) => {
  try {
    const weekStart = getMonday(new Date());

    // 1. 캐시 확인
    const { data: cached } = await supabase
      .from('weekly_reports')
      .select('content, created_at')
      .eq('user_id', req.user.id)
      .eq('week_start', weekStart)
      .single();

    if (cached) {
      return res.json({ report: cached.content, cached: true });
    }

    // 2. 지난 7일 ai_turn 메시지에서 is_perfect: false 피드백 수집
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('content, created_at')
      .eq('user_id', req.user.id)
      .eq('content_type', 'ai_turn')
      .gte('created_at', sevenDaysAgo);

    if (msgError) {
      console.error('[Reports] messages 조회 오류:', msgError);
      return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
    }

    const corrections = (messages || []).flatMap(m =>
      (m.content.feedback || []).filter(fb => !fb.is_perfect)
    );
    const totalTurns = messages?.length ?? 0;

    if (corrections.length === 0) {
      return res.json({ report: null, totalTurns, message: '이번 주 교정 내역이 없어요!' });
    }

    // 3. GPT-4o-mini 리포트 생성
    const correctionList = corrections
      .slice(0, 30) // 최대 30개
      .map(c => `original: "${c.original}" → corrected: "${c.corrected}"`)
      .join('\n');

    const systemPrompt = `You are an English learning coach analyzing a learner's weekly practice data.
Return ONLY valid JSON in this exact format:
{
  "summary": "이번 주 한 줄 총평 (한국어, 1-2문장)",
  "total_turns": ${totalTurns},
  "weak_points": [
    {
      "category": "문법 카테고리명 (한국어)",
      "count": 0,
      "examples": [
        { "original": "원문", "corrected": "교정문" }
      ]
    }
  ],
  "praise": "잘한 점 (한국어, 1문장)",
  "next_goal": "다음 주 목표 (한국어, 1문장)"
}
Rules:
- weak_points: top 3 only, sorted by count desc
- examples: 1-2 per category
- All Korean text must be in Korean`;

    const userPrompt = `Analyze these ${corrections.length} corrections from this week:\n\n${correctionList}`;

    let report;
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.5,
      });

      const raw = response.choices[0]?.message?.content;
      if (!raw) throw new Error('GPT 응답 없음');
      report = JSON.parse(raw);
    } catch (err) {
      console.error('[Reports] GPT 호출 실패:', err.message);
      return errorResponse(res, 502, 'REPORT_GENERATION_FAILED', '리포트 생성에 실패했습니다');
    }

    // 4. DB upsert
    await supabase
      .from('weekly_reports')
      .upsert({ user_id: req.user.id, week_start: weekStart, content: report });

    return res.json({ report, cached: false });
  } catch (err) {
    console.error('[Reports] GET /weekly unexpected error:', err);
    return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
  }
});

module.exports = router;
