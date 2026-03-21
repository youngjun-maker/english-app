# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI 기반 영어 회화 연습 앱 (MVP). 음성 녹음 → STT → AI 피드백 → TTS 재생 흐름. 설계 기준은 `docs/PRD.md` (v1.7.0), 개발 순서는 `docs/ROADMAP.md` (24개 태스크, Phase 0–5).

## Repository Structure

```
english-app/
├── ai-server/        # Node.js Express REST API (CommonJS, Express 5)
├── mobile-app/       # React Native (Expo SDK 54, New Architecture enabled)
└── docs/             # PRD.md (v1.7.0), ROADMAP.md (final)
```

## Commands

### mobile-app
```bash
cd mobile-app
npm start              # Expo Dev Server (requires EAS Dev Client — NOT Expo Go)
npm run android        # Android
npm run ios            # iOS
npm run lint           # ESLint (expo lint)
```

### ai-server
```bash
cd ai-server
# Dev server (nodemon 미설치 — ROADMAP Task 003에서 추가 예정)
node index.js

# Tests (jest + supertest 미설치 — ROADMAP Task 003에서 추가 예정)
npx jest
npx jest __tests__/stt.test.js   # 단일 테스트 파일 실행
```

> **중요:** `expo start` (Expo Go)는 사용 불가. Apple Sign In + 마이크 권한 제약으로 반드시 EAS Dev Client 빌드 필요 (Phase 0 Task 001).

## Architecture

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Mobile | React Native 0.81, Expo SDK 54, expo-router (file-based) |
| State | Zustand v5 |
| Styling | NativeWind v4 (Tailwind CSS — Task 004에서 설정 예정) |
| Backend | Node.js Express 5, CommonJS |
| DB / Auth | Supabase (PostgreSQL + RLS + Social Login) |
| STT | OpenAI Whisper (`whisper-1`, m4a) |
| LLM | OpenAI GPT-4o-mini (JSON mode, 6-turn sliding window) |
| TTS | OpenAI TTS (`tts-1`, `nova`, mp3 binary stream, 캐싱 없음) |

### Core API Flow (2-Step)
1. `POST /api/stt` — 오디오 파일 → 텍스트 (Whisper)
2. `POST /api/conversations/:id/messages` — 텍스트 → AI JSON 응답 (GPT-4o-mini)
3. `POST /api/tts` — 텍스트 → mp3 binary stream → `expo-file-system` 임시파일 → `expo-av` 재생

### AI Response JSON Shape
```typescript
{
  feedback: Array<{ original: string | null; corrected: string | null; is_perfect: boolean }>;
  next_response: string;
}
```
`is_perfect: true` 일 때 `original`/`corrected`는 `null`, TTS 🔊 버튼 미표시.

### Database Schema (4 tables)
- **users** — Supabase Auth 연동
- **conversations** — `updated_at` 트리거 자동 갱신 (INSERT on messages)
- **messages** — `content_type: 'user_speech' | 'ai_turn'`, `content: JSONB`, `user_id` (턴 카운트 JOIN 없이 직접 조회용)
- **expressions** — `source_block: 'user_speech' | 'feedback' | 'response'` (원문 SQL CASE 분기용), `conversation_id` FK

### Turn Count Query (핵심 인덱스)
```sql
CREATE INDEX idx_messages_user_turn_count ON messages (user_id, content_type, created_at);
-- 일일 20턴 제한, KST 자정 리셋 (UTC+9)
```

### source_sentence SQL CASE
```sql
CASE e.source_block
  WHEN 'user_speech' THEN m.content->>'text'
  WHEN 'feedback'    THEN m.content->'feedback'->0->>'corrected'
  WHEN 'response'    THEN m.content->>'next_response'
END AS source_sentence
```

### mobile-app Routing (expo-router)
```
app/
├── _layout.tsx         # Root layout (Stack)
├── (auth)/             # 온보딩, 로그인 (Task 008)
├── (tabs)/
│   ├── _layout.tsx     # Bottom tab navigator
│   ├── index.tsx       # Home 화면
│   └── explore.tsx     # Study 탭
├── chat/[id].tsx       # 대화 화면 (Task 010)
└── study/              # 표현 학습 (Task 011)
```
Path alias `@/*` → `mobile-app/*` (tsconfig paths 설정됨)

### Zustand Store (`store/useAppStore.ts` — Task 006)
```typescript
// auth: user, session, setSession, clearSession
// turn: todayTurnCount, isTurnLimitReached, setTodayTurnCount, incrementTurnCount, resetTurnCount
// ui: isTypingIndicatorVisible, setTypingIndicator
// toast: toastMessage, showToast, clearToast
```

### Android 녹음 필수 설정
`expo-av` 사용 시 반드시 명시:
```typescript
outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
```

## Development Status

**완료:** PRD v1.7.0 확정, ROADMAP 24개 태스크 확정, Expo 프로젝트 초기화, ai-server package.json 기본 설정

**미완료:** Phase 0 (EAS Build) → Phase 1 (DB 스키마, 서버 뼈대, 타입, Zustand) → Phase 2 (UI) → Phase 3 (백엔드 API) → Phase 4 (프론트 연동)

## Key Constraints (PRD v1.7)
- 일일 20턴/유저, KST 자정 리셋
- 녹음 최대 30초 (클라이언트 타이머 1차 차단, 백엔드 2차 방어)
- 응답 목표 8초 이내 (STT + LLM 합산)
- 6-turn 슬라이딩 윈도우 (LLM context)
- MVP 화이트리스트 10인
