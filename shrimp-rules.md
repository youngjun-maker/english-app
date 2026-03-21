# Development Guidelines

## Project Overview

- AI 기반 영어 회화 연습 앱 (MVP, 화이트리스트 10인)
- 음성 녹음 → STT → GPT-4o-mini 피드백 + 응답 → TTS 재생 흐름
- 개발 순서: `docs/ROADMAP.md` (24개 태스크, Phase 0~5) — 반드시 ROADMAP 순서대로 진행

## Project Architecture

```
english-app/
├── ai-server/          # Node.js Express 5, CommonJS
│   ├── app.js          # Express 앱 설정 + 라우트 등록 (module.exports)
│   ├── index.js        # 서버 시작 진입점 (app.js import 후 listen)
│   ├── routes/         # stt.js, tts.js, conversations.js, expressions.js, auth.js
│   ├── middleware/     # auth.js, turnLimit.js
│   ├── utils/          # errorResponse.js, buildPrompt.js
│   ├── prompts/        # _base.txt + 6개 topic 파일
│   └── __tests__/      # Jest + Supertest 테스트 파일만 위치
├── mobile-app/         # React Native 0.81, Expo SDK 54, TypeScript
│   ├── app/            # expo-router 파일 기반 라우팅
│   │   ├── (auth)/     # onboarding.tsx, login.tsx
│   │   ├── (tabs)/     # index.tsx (홈), study.tsx (학습장)
│   │   ├── chat/       # topic-select.tsx, [id].tsx
│   │   └── study/      # [expressionId].tsx
│   ├── components/
│   │   ├── chat/       # UserBubble, AIBubble, FeedbackBlock, TypingIndicator, RecordButton
│   │   ├── study/      # ExpressionCard
│   │   └── common/     # TTSButton, SavePopup, Toast
│   ├── store/          # useAppStore.ts (Zustand)
│   ├── types/          # index.ts (전체 타입 정의)
│   ├── api/            # chat.js, conversations.js
│   ├── utils/          # supabase.ts
│   └── constants/      # index.ts (API_BASE_URL 등)
└── docs/
    ├── PRD.md          # v1.7.0 — 요구사항 기준
    └── ROADMAP.md      # 태스크 진행 상황 추적
```

## Code Standards

### ai-server (Node.js)
- **반드시 CommonJS** 사용: `require()` / `module.exports` — `import/export` 절대 금지
- 모든 파일 상단에 `'use strict';` 선언
- `app.js`는 Express 앱만 export, 서버 시작 코드(`listen`) 금지 — `index.js`에서만 시작
- 새 라우트 파일 생성 시 **반드시 `app.js`에도 `app.use()` 등록**

### mobile-app (React Native)
- **TypeScript 필수** — JS 파일 신규 생성 금지 (단, `api/` 하위는 JS 허용)
- 스타일링은 **NativeWind v4 Tailwind 클래스** 사용 — `StyleSheet.create()` 사용 금지
- 경로 import는 **`@/` alias** 사용: `@/components/...`, `@/store/...` 등
- 새 화면 추가 시 **expo-router 파일 기반** 규칙 준수 (파일 위치 = 라우트 경로)

## Error Response Standards (ai-server)

- **반드시 `utils/errorResponse.js`의 `errorResponse()` 함수 사용**
- 직접 `res.status(xxx).json({ error: ... })` 작성 금지

```js
// ✅ 올바른 방법
const { errorResponse } = require('../utils/errorResponse');
return errorResponse(res, 401, 'UNAUTHORIZED', '인증이 필요합니다');

// ❌ 금지
res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '...' } });
```

- 허용 에러 코드: `TURN_LIMIT_EXCEEDED` | `AUDIO_TOO_LONG` | `STT_FAILED` | `LLM_JSON_PARSE_FAILED` | `TTS_FAILED` | `UNAUTHORIZED` | `INVALID_AUDIO_FORMAT`

## AI Response JSON Shape

- LLM 응답은 반드시 아래 구조를 유지:

```typescript
{
  feedback: Array<{
    original: string | null;   // is_perfect=true 이면 null
    corrected: string | null;  // is_perfect=true 이면 null
    comment: string;           // 반드시 한국어
    is_perfect: boolean;
  }>;
  next_response: string;       // 영어 대화 응답
}
```

- `is_perfect: true` 일 때 `original`, `corrected` 는 반드시 `null`
- `prompts/_base.txt`에 JSON 강제 규칙 명시됨 — 프롬프트 수정 시 JSON 구조 규칙 유지 필수

## Prompt Management

- LLM 시스템 프롬프트 조합은 **반드시 `utils/buildPrompt.js`의 `buildPrompt(topicId)` 경유**
- 라우트나 다른 파일에서 `prompts/` 파일을 직접 `fs.readFileSync()` 금지
- topic 파일 추가 시: `prompts/{topicId}.txt` 생성 후 `buildPrompt.js` 수정 불필요 (자동 로드)

## Middleware Application Rules

- 인증이 필요한 모든 라우트: `middleware/auth.js`의 `authMiddleware` 적용 필수
- 메시지 전송 엔드포인트(`POST /api/conversations/:id/messages`): `turnLimitMiddleware` 추가 필수
- 미들웨어 순서: `authMiddleware` → `turnLimitMiddleware` → 라우트 핸들러

## Turn Limit Rules

- 일일 20턴 제한 / 유저
- KST 자정(UTC+9) 리셋 — 쿼리 시 반드시 KST 기준 오늘 날짜 범위 계산
- 카운트 기준: `messages` 테이블에서 `content_type = 'user_speech'` + `user_id` + 오늘 날짜
- 인덱스 활용: `idx_messages_user_turn_count (user_id, content_type, created_at)`

## Recording Standards (mobile-app)

- `expo-av` 녹음 설정 시 **Android 옵션 반드시 명시**:

```typescript
// ✅ 필수
outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
```

- 녹음 최대 30초: 클라이언트 타이머 1차 차단 + 백엔드 2차 방어 모두 구현
- 파일 형식: m4a (Whisper STT 호환)

## State Management (mobile-app Zustand)

- 전역 상태는 **`store/useAppStore.ts`에서만** 관리
- 슬라이스: `auth` (user, session) / `turn` (todayTurnCount, isTurnLimitReached) / `ui` (isTypingIndicatorVisible) / `toast` (toastMessage)
- 컴포넌트에서 직접 로컬 state로 턴 카운트 관리 금지 — Store 경유 필수

## Environment Variables

| 위치 | 파일 | 규칙 |
|------|------|------|
| ai-server | `.env` | `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT` |
| mobile-app | `.env` | `EXPO_PUBLIC_` prefix 필수 |

- **`SUPABASE_SERVICE_ROLE_KEY` 는 ai-server에서만 사용 — mobile-app에 절대 노출 금지**
- mobile-app에서 Supabase 접근은 `EXPO_PUBLIC_SUPABASE_ANON_KEY` 사용

## Testing Standards (ai-server)

- 테스트 파일 위치: `ai-server/__tests__/*.test.js`만 허용
- Phase 3 백엔드 API 구현 시 **Jest + Supertest로 엔드포인트 테스트 필수**
- 실행: `npm test` (루트 아님, `ai-server/` 디렉토리에서)

## ROADMAP Update Rules

- **태스크 완료 시 즉시 `docs/ROADMAP.md` 업데이트 필수**
- 태스크 제목에 `✅` 추가 + 완료 기준 아래에 완료 이력 블록 추가:

```markdown
**✅ 완료 (YYYY-MM-DD)** — 작업 내용 한 줄 요약
```

- Phase 전체 완료 시 Phase 제목에도 `✅` 추가

## Key File Coordination Rules

| 변경 사항 | 함께 수정해야 할 파일 |
|-----------|----------------------|
| 새 라우트 파일 추가 | `ai-server/app.js` |
| 새 화면 파일 추가 | `mobile-app/app/` 하위 적절한 위치에 파일 생성 (expo-router 자동 등록) |
| 새 타입 추가 | `mobile-app/types/index.ts` |
| 새 API 함수 추가 | `mobile-app/api/chat.js` 또는 `conversations.js` |
| 태스크 완료 | `docs/ROADMAP.md` |

## Prohibited Actions

- `ai-server`에서 `import`/`export` (ES Module) 문법 사용
- `res.json()` 직접 에러 응답 (errorResponse 유틸 우회)
- `prompts/` 파일 직접 읽기 (buildPrompt 우회)
- `SUPABASE_SERVICE_ROLE_KEY` mobile-app 노출
- `expo start` 사용 (Expo Go 불가) — 반드시 EAS Dev Client 빌드 사용
- ROADMAP 순서 무시하고 태스크 건너뛰기
- mobile-app에서 `StyleSheet.create()` 스타일 정의 (NativeWind 대신)
- `app.js`에서 `app.listen()` 호출 (index.js 전용)
- `__tests__/` 외부에 테스트 파일 생성
