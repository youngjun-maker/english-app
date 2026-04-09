'use strict';

const fs = require('fs');
const path = require('path');

// 서버 구동 시 1회만 읽어 캐시에 보관
const promptCache = new Map();
const promptDir = path.join(__dirname, '../prompts');

const base = fs.readFileSync(path.join(promptDir, '_base.txt'), 'utf-8');

for (const file of fs.readdirSync(promptDir)) {
  if (file === '_base.txt') continue;
  const topicId = path.basename(file, '.txt');
  promptCache.set(topicId, fs.readFileSync(path.join(promptDir, file), 'utf-8'));
}

/** 레벨별 추가 지시어 */
const LEVEL_INSTRUCTIONS = {
  1: `\n\nDIFFICULTY: Beginner (Level 1)
- Use simple, everyday vocabulary and basic sentence structures. Avoid idioms, slang, and complex grammar.
- Correct every grammar and vocabulary mistake in the feedback array — be thorough.
- Keep your responses short (1–2 sentences) so the learner is not overwhelmed.
- If the learner seems stuck, gently guide them with a hint in your next_response.`,
  2: `\n\nDIFFICULTY: Intermediate (Level 2)
- Use natural conversational vocabulary with occasional idioms and phrasal verbs.
- Correct major errors but let minor stylistic imperfections slide.
- Keep responses to 2–3 sentences.`,
  3: `\n\nDIFFICULTY: Advanced (Level 3)
- Use natural idioms, phrasal verbs, and colloquial expressions freely.
- Only flag expressions that are unnatural or seriously incorrect — do not over-correct.
- Use nuanced, multi-sentence responses that genuinely challenge the learner.
- Do not simplify vocabulary or sentence structure.`,
};

/**
 * topicId에 맞는 프롬프트 문자열 반환 (프리로드된 캐시에서 조회)
 * @param {string} topicId - 토픽 ID (예: 'free_talk', 'cafe_order')
 * @param {number} [level=2] - 난이도 레벨 (1: 초급, 2: 중급, 3: 고급)
 * @returns {string} 시스템 프롬프트 문자열
 */
function buildPrompt(topicId, level = 2) {
  const topic = promptCache.get(topicId) ?? '';
  const levelInstruction = LEVEL_INSTRUCTIONS[level] ?? LEVEL_INSTRUCTIONS[2];
  return `${topic}${levelInstruction}\n\n${base}`.trim();
}

module.exports = { buildPrompt };
