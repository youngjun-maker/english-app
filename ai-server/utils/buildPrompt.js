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
- Speak slowly and use simple, everyday vocabulary.
- Avoid idioms, slang, or complex grammar.
- Provide generous feedback and corrections — correct every grammar or vocabulary mistake.
- Keep your responses short (1–2 sentences) so the learner isn't overwhelmed.`,
  2: `\n\nDIFFICULTY: Intermediate (Level 2)
- Speak at a natural conversational pace.
- Use moderately complex vocabulary and occasional idioms.
- Provide balanced feedback — correct major errors but let minor ones slide.
- Keep responses to 2–3 sentences.`,
  3: `\n\nDIFFICULTY: Advanced (Level 3)
- Speak at native speed and use natural idioms, phrasal verbs, and colloquial expressions.
- Minimize corrections — only flag unnatural or severely incorrect expressions.
- Use nuanced, multi-sentence responses to challenge the learner.`,
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
