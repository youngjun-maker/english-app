'use strict';

const fs = require('fs');
const path = require('path');

/**
 * topicId에 맞는 프롬프트 문자열 반환
 * @param {string} topicId - 토픽 ID (예: 'free_talk', 'cafe_order')
 * @returns {string} 시스템 프롬프트 문자열
 */
function buildPrompt(topicId) {
  // TODO: Phase 3에서 구현 (Task 014)
  const basePath = path.join(__dirname, '../prompts/_base.txt');
  const topicPath = path.join(__dirname, `../prompts/${topicId}.txt`);

  const base = fs.readFileSync(basePath, 'utf-8');
  const topic = fs.existsSync(topicPath)
    ? fs.readFileSync(topicPath, 'utf-8')
    : '';

  return `${topic}\n\n${base}`.trim();
}

module.exports = { buildPrompt };
