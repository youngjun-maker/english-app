'use strict';

const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const { supabase } = require('../utils/supabase');
const { errorResponse } = require('../utils/errorResponse');
const { authMiddleware } = require('../middleware/auth');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Fisher-Yates 셔플
function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 6단어 이하 → 짧은 표현, 7단어 이상 → 전체 문장
function isShortExpression(text) {
  return text.trim().split(/\s+/).length <= 6;
}

// GPT 프롬프트 빌더
function buildQuizPrompt(expressions) {
  const expressionList = expressions
    .map((e, i) => {
      const tag = isShortExpression(e.expression_text) ? '[PHRASE]' : '[SENTENCE]';
      return `${i + 1}. ${tag} ${e.expression_text}`;
    })
    .join('\n');

  const systemPrompt = `You are an English learning assistant that creates Korean sentence quiz questions.

For each English expression:
- If tagged [PHRASE]: create a BRAND NEW English example sentence that naturally uses this phrase in context. example_sentence_en must be completely different from the original phrase.
- If tagged [SENTENCE]: use the provided sentence exactly as-is for example_sentence_en.

For both types, also provide:
- A Korean translation of example_sentence_en
- The Korean text fragment (highlight_text) that corresponds to the expression's meaning — shown in bold to the learner

Rules:
- highlight_text MUST be an exact substring of example_sentence_ko
- Keep sentences conversational and intermediate level
- Return ONLY valid JSON in this exact format:
{
  "questions": [
    {
      "expression_text": "the original expression",
      "example_sentence_en": "The English sentence.",
      "example_sentence_ko": "그 문장의 한국어 번역입니다.",
      "highlight_text": "한국어 번역 중 해당 표현에 대응하는 부분"
    }
  ]
}`;

  const userPrompt = `Generate quiz questions for these ${expressions.length} English expressions:\n\n${expressionList}`;

  return { systemPrompt, userPrompt };
}

// GPT 호출 + 파싱 (최대 3회 retry)
async function generateQuizQuestions(expressions) {
  const { systemPrompt, userPrompt } = buildQuizPrompt(expressions);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      });

      const raw = response.choices[0]?.message?.content;
      if (!raw) throw new Error('GPT 응답 없음');

      const parsed = JSON.parse(raw);
      const questions = parsed.questions;

      if (!Array.isArray(questions) || questions.length !== expressions.length) {
        throw new Error(`questions 배열 길이 불일치: ${questions?.length}`);
      }

      // highlight_text 방어 처리: example_sentence_ko의 부분문자열이 아니면 전체로 대체
      return questions.map((q, i) => ({
        expression_id: expressions[i].id,
        expression_text: expressions[i].expression_text,
        example_sentence_en: q.example_sentence_en,
        example_sentence_ko: q.example_sentence_ko,
        highlight_text: q.example_sentence_ko.includes(q.highlight_text)
          ? q.highlight_text
          : q.example_sentence_ko,
        order_index: i,
      }));
    } catch (err) {
      console.error(`[Quiz] GPT 파싱 시도 ${attempt}/3 실패:`, err.message);
      if (attempt === 3) throw err;
    }
  }
}

// POST /api/quiz/generate
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    // 본인 표현 전체 조회
    const { data: expressions, error: exprError } = await supabase
      .from('expressions')
      .select('id, expression_text, next_review_date, review_interval')
      .eq('user_id', req.user.id);

    if (exprError) {
      console.error('[Quiz] expressions 조회 오류:', exprError);
      return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
    }

    if (!expressions || expressions.length < 10) {
      return errorResponse(
        res,
        422,
        'NOT_ENOUGH_EXPRESSIONS',
        '퀴즈를 생성하려면 표현이 10개 이상 필요합니다'
      );
    }

    // 망각 곡선 우선순위 선택: 복습 기한 도래 항목 먼저, 나머지는 랜덤
    const today = new Date().toISOString().split('T')[0];

    const due = expressions
      .filter(e => e.next_review_date <= today)
      .sort((a, b) => new Date(a.next_review_date) - new Date(b.next_review_date));

    const rest = shuffleArray(
      expressions.filter(e => e.next_review_date > today)
    );

    const selected = [...due, ...rest].slice(0, 10);

    // GPT 문제 생성
    let questions;
    try {
      questions = await generateQuizQuestions(selected);
    } catch {
      return errorResponse(res, 502, 'QUIZ_GENERATION_FAILED', '퀴즈 문제 생성에 실패했습니다');
    }

    // quiz_sessions INSERT
    const { data: session, error: sessionError } = await supabase
      .from('quiz_sessions')
      .insert({ user_id: req.user.id, total_count: 10 })
      .select('id, created_at')
      .single();

    if (sessionError || !session) {
      console.error('[Quiz] session insert 오류:', sessionError);
      return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
    }

    // quiz_questions INSERT
    const rows = questions.map((q) => ({ ...q, session_id: session.id }));
    const { error: questionsError } = await supabase.from('quiz_questions').insert(rows);

    if (questionsError) {
      console.error('[Quiz] questions insert 오류:', questionsError);
      return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
    }

    // 삽입된 questions 조회 (id 포함)
    const { data: insertedQuestions } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('session_id', session.id)
      .order('order_index', { ascending: true });

    return res.status(201).json({ session, questions: insertedQuestions || [] });
  } catch (err) {
    console.error('[Quiz] POST /generate unexpected error:', err);
    return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
  }
});

// GET /api/quiz/sessions
router.get('/sessions', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('quiz_sessions')
      .select('id, total_count, correct_count, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Quiz] sessions 조회 오류:', error);
      return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
    }

    return res.status(200).json(data || []);
  } catch (err) {
    console.error('[Quiz] GET /sessions unexpected error:', err);
    return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
  }
});

// GET /api/quiz/sessions/:id
router.get('/sessions/:id', authMiddleware, async (req, res) => {
  const sessionId = req.params.id;

  try {
    const { data: session, error: sessionError } = await supabase
      .from('quiz_sessions')
      .select('id, total_count, correct_count, created_at')
      .eq('id', sessionId)
      .eq('user_id', req.user.id)
      .single();

    if (sessionError || !session) {
      return errorResponse(res, 404, 'NOT_FOUND', '퀴즈 세션을 찾을 수 없습니다');
    }

    const { data: questions, error: questionsError } = await supabase
      .from('quiz_questions')
      .select('id, expression_id, expression_text, example_sentence_en, example_sentence_ko, highlight_text, order_index, is_correct')
      .eq('session_id', sessionId)
      .order('order_index', { ascending: true });

    if (questionsError) {
      console.error('[Quiz] questions 조회 오류:', questionsError);
      return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
    }

    return res.status(200).json({ session, questions: questions || [] });
  } catch (err) {
    console.error('[Quiz] GET /sessions/:id unexpected error:', err);
    return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
  }
});

// PATCH /api/quiz/sessions/:id
router.patch('/sessions/:id', authMiddleware, async (req, res) => {
  const sessionId = req.params.id;
  const { answers } = req.body;

  // answers 배열 필수 검증
  if (!Array.isArray(answers) || answers.length === 0) {
    return errorResponse(res, 400, 'INVALID_REQUEST', 'answers 배열이 필요합니다');
  }

  try {
    // Step 1: 세션 조회 — 소유권 확인 + total_count 확보
    const { data: sessionData, error: sessionFetchError } = await supabase
      .from('quiz_sessions')
      .select('id, total_count')
      .eq('id', sessionId)
      .eq('user_id', req.user.id)
      .single();

    if (sessionFetchError || !sessionData) {
      return errorResponse(res, 404, 'NOT_FOUND', '퀴즈 세션을 찾을 수 없습니다');
    }

    // Step 2: answers 루프 — quiz_questions.is_correct UPDATE (expression_id 기준)
    for (const answer of answers) {
      if (!answer.expression_id) continue; // expression_id 없는 항목 스킵

      // quiz_questions.is_correct 업데이트 (결과 화면 정답/오답 표시용)
      await supabase
        .from('quiz_questions')
        .update({ is_correct: answer.is_correct })
        .eq('session_id', sessionId)
        .eq('expression_id', answer.expression_id);
    }

    // Step 3: correct_count 서버 측 계산 (클라이언트 값 불신)
    const correctCount = answers.filter((a) => a.is_correct === true).length;

    if (correctCount > sessionData.total_count) {
      return errorResponse(
        res,
        400,
        'INVALID_REQUEST',
        `correct_count는 total_count(${sessionData.total_count}) 이하여야 합니다`
      );
    }

    // Step 4: quiz_sessions UPDATE — correct_count + completed_at 설정
    const { data, error } = await supabase
      .from('quiz_sessions')
      .update({
        correct_count: correctCount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('user_id', req.user.id)
      .select('id');

    if (error) {
      console.error('[Quiz] session update 오류:', error);
      return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
    }

    if (!data || data.length === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', '퀴즈 세션을 찾을 수 없습니다');
    }

    // Step 5: 망각 곡선 갱신 — expression_id null 체크 후 next_review_date 업데이트
    for (const answer of answers) {
      if (!answer.expression_id) continue; // expression_id 없는 항목 스킵

      const { data: expr } = await supabase
        .from('expressions')
        .select('review_interval')
        .eq('id', answer.expression_id)
        .single();

      const currentInterval = expr?.review_interval ?? 1;
      const newInterval = answer.is_correct
        ? Math.min(currentInterval * 2, 30)
        : 1;

      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + newInterval);

      await supabase
        .from('expressions')
        .update({
          review_interval: newInterval,
          next_review_date: nextDate.toISOString().split('T')[0],
        })
        .eq('id', answer.expression_id);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[Quiz] PATCH /sessions/:id unexpected error:', err);
    return errorResponse(res, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다');
  }
});

module.exports = router;
