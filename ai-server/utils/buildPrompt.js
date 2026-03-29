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

/**
 * topicId에 맞는 프롬프트 문자열 반환 (프리로드된 캐시에서 조회)
 * @param {string} topicId - 토픽 ID (예: 'free_talk', 'cafe_order')
 * @returns {string} 시스템 프롬프트 문자열
 */
function buildPrompt(topicId) {
  const topic = promptCache.get(topicId) ?? '';
  return `${topic}\n\n${base}`.trim();
}

module.exports = { buildPrompt };
