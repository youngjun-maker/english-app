#!/usr/bin/env node
/**
 * add-shadowing.js
 * Usage: node scripts/add-shadowing.js <youtube_url> <start> <end> [title] [level] [category]
 * Example: node scripts/add-shadowing.js https://youtu.be/xxx 2:25 3:37
 *          node scripts/add-shadowing.js https://youtu.be/xxx 2:25 3:37 "My Title" medium speech
 */

'use strict';

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ai-server에서 실행하거나 루트에서 실행하는 경우 모두 지원
const envPath = path.resolve(__dirname, '../ai-server/.env');
const nodeModules = path.resolve(__dirname, '../ai-server/node_modules');

require(path.join(nodeModules, 'dotenv')).config({ path: envPath });

const { OpenAI } = require(path.join(nodeModules, 'openai'));
const { createClient } = require(path.join(nodeModules, '@supabase/supabase-js'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const STORAGE_BUCKET = 'shadowing-videos';
const SUPABASE_URL = process.env.SUPABASE_URL;

// ── 인자 파싱 ─────────────────────────────────────────────────────────────────
const [,, url, start, end, customTitle, level = 'medium', category = 'speech'] = process.argv;

if (!url || !start || !end) {
  console.error('Usage: node add-shadowing.js <youtube_url> <start> <end> [title] [level] [category]');
  console.error('Example: node add-shadowing.js https://youtu.be/xxx 2:25 3:37');
  process.exit(1);
}

const VALID_LEVELS = ['easy', 'medium', 'hard'];
const VALID_CATEGORIES = ['movie', 'speech', 'ted'];
if (!VALID_LEVELS.includes(level)) {
  console.error(`level은 ${VALID_LEVELS.join('/')} 중 하나여야 합니다.`);
  process.exit(1);
}
if (!VALID_CATEGORIES.includes(category)) {
  console.error(`category는 ${VALID_CATEGORIES.join('/')} 중 하나여야 합니다.`);
  process.exit(1);
}

// YouTube video ID 추출 (파일명 기반으로 사용)
const videoIdMatch = url.match(/(?:youtu\.be\/|v=)([^?&]+)/);
const videoId = videoIdMatch ? videoIdMatch[1] : `clip_${Date.now()}`;
const fileName = `${videoId}_${start.replace(/:/g, '')}_${end.replace(/:/g, '')}.mp4`;
const tmpDir = os.tmpdir();
const fullVideoPath = path.join(tmpDir, `${videoId}_full.mp4`);
const clipPath = path.join(tmpDir, fileName);

// ── 유틸 ─────────────────────────────────────────────────────────────────────
function run(cmd, label) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(cmd, { shell: true, encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    throw new Error(`"${label}" 실패 (exit ${result.status})`);
  }
  return result.stdout.trim();
}

function mergeBySentence(segments) {
  const merged = [];
  let buffer = null;
  for (const seg of segments) {
    const text = seg.text.trim();
    if (!buffer) {
      buffer = { start: Math.round(seg.start * 100) / 100, end: Math.round(seg.end * 100) / 100, text };
    } else {
      buffer.text += ' ' + text;
      buffer.end = Math.round(seg.end * 100) / 100;
    }
    if (/[.?!]$/.test(text)) { merged.push({ ...buffer }); buffer = null; }
  }
  if (buffer) merged.push(buffer);
  return merged;
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🎬 섀도잉 영상 추가 시작`);
  console.log(`   URL   : ${url}`);
  console.log(`   구간  : ${start} ~ ${end}`);

  // ① YouTube 제목 가져오기
  let title = customTitle;
  if (!title) {
    title = run(`yt-dlp --print "%(title)s" "${url}"`, 'YouTube 제목 조회');
    console.log(`   제목  : ${title}`);
  }

  // ② 전체 영상 다운로드
  if (!fs.existsSync(fullVideoPath)) {
    run(
      `yt-dlp -f "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]" -o "${fullVideoPath}" "${url}"`,
      '영상 다운로드 (480p)'
    );
  } else {
    console.log('\n▶ 영상 다운로드 (캐시 사용)');
  }

  // ③ ffmpeg 구간 컷 + faststart
  run(
    `ffmpeg -i "${fullVideoPath}" -ss ${start} -to ${end} -movflags faststart -c:v libx264 -crf 23 -c:a aac "${clipPath}" -y`,
    `ffmpeg 구간 컷 (${start} ~ ${end})`
  );

  // 실제 duration 확인
  const durationRaw = run(
    `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${clipPath}"`,
    'duration 확인'
  );
  const duration = Math.round(parseFloat(durationRaw));

  // ④ Supabase Storage 업로드
  console.log(`\n▶ Supabase Storage 업로드 (${fileName})`);
  const fileBuffer = fs.readFileSync(clipPath);
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, fileBuffer, { contentType: 'video/mp4', upsert: true });
  if (uploadError) throw new Error(`Storage 업로드 실패: ${uploadError.message}`);

  const videoUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${fileName}`;
  const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  // ⑤ Whisper 타임스탬프 추출
  console.log('\n▶ Whisper 타임스탬프 추출');
  let transcript;
  try {
    transcript = await openai.audio.transcriptions.create({
      file: fs.createReadStream(clipPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
      language: 'en',
    });
  } catch (e) {
    console.warn('  Whisper 1차 실패, 재시도...');
    transcript = await openai.audio.transcriptions.create({
      file: fs.createReadStream(clipPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
      language: 'en',
    });
  }

  const scripts = mergeBySentence(transcript.segments || []);
  console.log(`  ${scripts.length}개 문장 추출`);
  scripts.forEach((s, i) => console.log(`  [${i}] ${s.start}~${s.end}: ${s.text}`));

  // ⑥ DB 삽입
  console.log('\n▶ DB 등록');
  const { data: content, error: ce } = await supabase
    .from('shadowing_contents')
    .insert({ title, description: '', video_url: videoUrl, thumbnail_url: thumbnailUrl, duration, level, category, is_published: true })
    .select('id').single();
  if (ce) throw new Error(`shadowing_contents 삽입 실패: ${ce.message}`);

  const rows = scripts.map((s, i) => ({
    content_id: content.id,
    sentence_index: i,
    start_time: s.start,
    end_time: s.end,
    text: s.text,
    translation: null,
  }));
  const { error: se } = await supabase.from('shadowing_scripts').insert(rows);
  if (se) throw new Error(`shadowing_scripts 삽입 실패: ${se.message}`);

  // ⑦ 임시 파일 정리
  fs.unlinkSync(clipPath);

  console.log(`\n✅ 완료!`);
  console.log(`   content_id : ${content.id}`);
  console.log(`   제목       : ${title}`);
  console.log(`   구간       : ${start} ~ ${end} (${duration}초)`);
  console.log(`   스크립트   : ${scripts.length}개 문장`);
  console.log(`   video_url  : ${videoUrl}`);
}

main().catch((e) => {
  console.error(`\n❌ 오류: ${e.message}`);
  process.exit(1);
});
