# 영어 말하기 연습 앱 개발 로드맵

> "말하고 싶은 게 생각났는데 어떻게 말하는지 모를 때, 부담 없이 연습하고, 나중에 문맥과 함께 다시 꺼내보는 영어 말하기 앱"

## 개요

본 앱은 **비동기 AI 대화 + 문맥 연동 표현 저장**을 핵심 가치로, 실시간 대화의 심리적 부담 없이 영어 말하기를 연습하는 iOS/Android 앱입니다. 다음 기능을 제공합니다:

- **비동기 AI 말하기 연습**: Push-to-talk 녹음 → Whisper STT → GPT-4o-mini 피드백 + 대화 응답 (2-Step 분리 호출)
- **문맥 연동 표현 저장**: 저장된 표현과 당시 대화 전체 문맥이 `conversation_id`로 자동 연결되어 함께 보존
- **원어민 발음 듣기**: 모든 영어 텍스트에 OpenAI TTS Nova 보이스 재생 버튼 제공

## 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| **모바일** | React Native (Expo), EAS Build Dev Client | Expo Go 사용 불가 (Apple Sign In, 마이크 권한 제한) |
| **백엔드** | Node.js (Express) | REST API 서버 |
| **DB/Auth** | Supabase (PostgreSQL + Auth) | Google/Apple 소셜 로그인 |
| **상태 관리** | Zustand | 전역 상태 (인증 세션, 일일 턴 카운트, UI 상태) |
| **스타일링** | NativeWind v4 (Tailwind CSS) | React Native용 Tailwind CSS |
| **STT** | OpenAI Whisper (`whisper-1`, m4a) | |
| **LLM** | OpenAI GPT-4o-mini | JSON mode, 6턴 슬라이딩 윈도우 |
| **TTS** | OpenAI TTS (`tts-1`, `nova` 보이스) | mp3 binary stream, 캐싱 없음 |
| **API 테스트** | Jest + Supertest | 백엔드 Express API 단위/통합 테스트 |

## 프로젝트 디렉토리 구조

```
english-app/
├── mobile-app/                  # React Native (Expo) 앱
│   ├── app/                     # expo-router 기반 화면
│   │   ├── (auth)/              # 온보딩, 로그인
│   │   ├── (tabs)/              # 홈 탭, 학습장 탭
│   │   ├── chat/                # 채팅 화면, 주제 선택
│   │   └── study/               # 표현 상세 화면
│   ├── api/                     # API 추상화 레이어 (chat.js)
│   ├── components/
│   │   ├── chat/                # 말풍선, 피드백 블록, 녹음 버튼
│   │   ├── study/               # 표현 카드
│   │   └── common/              # TTS 버튼, 저장 팝업, 토스트
│   ├── store/                   # Zustand 전역 상태 관리
│   │   └── useAppStore.ts
│   ├── types/                   # TypeScript 타입 정의
│   ├── utils/                   # supabase 클라이언트, 상수
│   └── constants/               # API_BASE_URL 등
├── ai-server/                   # Node.js (Express) 백엔드
│   ├── routes/                  # stt.js, tts.js, conversations.js, expressions.js
│   ├── middleware/              # auth.js, turnLimit.js
│   ├── utils/                   # buildPrompt.js, errorResponse.js
│   ├── prompts/                 # _base.txt, {topic_id}.txt (6개)
│   └── __tests__/               # Jest + Supertest 테스트 파일
└── docs/                        # PRD.md, ROADMAP.md
```

## 개발 워크플로우

1. **작업 계획**: PRD v1.7을 기준으로 Task 단위로 분해, 의존성 순서대로 진행. 본 ROADMAP.md에서 진행 상황 추적
2. **작업 구현**: 각 Task의 구현 사항을 체크하며 진행. 완료 기준 충족 후 다음 Task로 이동
3. **API 테스트**: Phase 3 백엔드 API 구현 시 **Jest + Supertest**로 엔드포인트 테스트 수행 필수 (`npm test`)
4. **로드맵 업데이트**: 완료된 Task를 ✅로, 완료된 Phase를 `Phase N: ... ✅`로 표시

---

## 개발 단계

### Phase 0: 개발 환경 선행 설정

> ⚠️ EAS Build Dev Client 없이는 Apple Sign In 및 마이크 권한 테스트가 불가능하다. Phase 1 착수 전 반드시 완료해야 한다.

---

#### Task 001: EAS Build 및 외부 서비스 초기 설정 — 우선순위 `[Developer]`

- EAS Build 계정 설정 및 `eas.json` 구성 (`development` / `preview` / `production` 프로필)
- EAS Dev Client 빌드 생성 (iOS + Android), 실제 디바이스에서 Dev Client 앱 실행 확인
- Apple Developer 계정 — Sign In with Apple 서비스 ID 설정, Supabase Auth Apple 공급자 연동
- Google OAuth 클라이언트 설정 (iOS/Android 각각 client_id), Supabase Auth Google 공급자 연동
- OpenAI API 키 발급, `ai-server/.env` 파일 생성 (`OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`)

**완료 기준:** EAS Dev Client 앱이 실제 디바이스에서 실행되고, Supabase Auth 대시보드에서 Google/Apple 공급자 연동 상태가 "Enabled"로 표시됨

**진행 이력 및 결정 사항:**

- `app.json` slug/owner/bundleIdentifier(`com.fyuer.englishapp`) 설정 완료, `eas.json` 생성 완료
- EAS 계정 username이 `fyuer`가 아닌 `anyoungjun`임을 확인 → `app.json` owner 수정 후 `eas init` 성공, `projectId: a8843a9f-277c-459b-befa-ac33b13f9547` 자동 등록됨
- Android EAS Dev Client 빌드 완료 (build ID: `b36a9d4a-5e9a-4677-a57b-bd0984cab9d9`)
- Supabase Google 공급자 연동 완료
- OpenAI API 키 및 Supabase Service Role Key → `ai-server/.env` 업데이트 완료

**✅ 완료 (가능한 범위 내)**

---

**⏸ 보류 항목 — Apple Developer 계정 등록 시 처리**

> Apple Developer 계정($99/년) 미등록으로 인해 아래 항목을 보류함. 계정 등록 후 순서대로 진행할 것.

1. **iOS EAS Dev Client 빌드**
   ```bash
   cd mobile-app
   eas build --profile development --platform ios
   ```

2. **Sign in with Apple 설정** (Apple Developer Portal)
   - App ID에서 Sign in with Apple capability 활성화
   - Service ID 생성 (`com.fyuer.englishapp.service`)
   - Key 생성 → Key ID + `.p8` 파일 다운로드
   - Team ID 확인

3. **Supabase Apple 공급자 연동**
   - Authentication → Providers → Apple 활성화
   - Client IDs: `com.fyuer.englishapp` (bundle ID)
   - Secret Key: Team ID + Key ID + `.p8`로 JWT 생성 후 입력
   - Callback URL: `https://brjvyzdeyszfhgttybzn.supabase.co/auth/v1/callback`

4. **iOS Dev Client 실제 기기(iPhone) 설치 확인**

---

### Phase 1: 프로젝트 골격 구축

> Structure-First: 실제 기능 구현 전에 전체 앱 구조, 타입 정의, DB 스키마, 전역 상태 뼈대를 먼저 완성한다.
> 이 단계 완료 후 백엔드팀(Task 012~)과 프론트엔드 UI팀(Task 007~)이 독립적으로 병렬 개발 가능하다.

---

#### Task 002: Supabase DB 스키마, RLS, 트리거, 인덱스 설정 ✅ `[Developer]`

- Supabase 프로젝트 생성, SQL Editor에서 4개 테이블 생성:
  - `users` (id, email, display_name, created_at, last_login_at)
  - `conversations` (id, user_id, topic_id, topic_label, created_at, updated_at)
  - `messages` (id, conversation_id, **user_id**, turn_number, role, content jsonb, content_type, created_at)
  - `expressions` (id, user_id, conversation_id, message_id, expression_text, **source_block**, user_memo, created_at)
- RLS 3개 정책 적용 (conversations / messages / expressions 각각 본인 데이터만 접근)
- `update_conversation_timestamp()` 트리거 생성 (`AFTER INSERT ON messages` → `conversations.updated_at` 자동 갱신)
- 복합 인덱스 생성: `CREATE INDEX idx_messages_user_turn_count ON messages (user_id, content_type, created_at)`

**완료 기준:** Table Editor에서 4개 테이블 확인. 테스트 메시지 INSERT 시 `conversations.updated_at` 자동 갱신 확인. `idx_messages_user_turn_count` 인덱스 존재 확인

**✅ 완료 (2026-03-21)** — Playwright로 Supabase SQL Editor에서 직접 실행. 4개 테이블, RLS 4개 정책, 트리거, 복합 인덱스 모두 확인.

---

#### Task 003: 백엔드 Express 서버 프로젝트 구조 설정 ✅ `@contexttalk-api-architect`

- `ai-server/` 디렉토리, `package.json` 초기화, 필수 패키지 설치:
  - **런타임**: `express`, `@supabase/supabase-js`, `openai`, `multer`, `dotenv`, `cors`
  - **테스트**: `jest`, `supertest`, `@types/jest` (devDependencies)
- 폴더 구조 생성: `routes/`, `middleware/`, `utils/`, `prompts/`, `__tests__/`
- 빈 라우트 파일 생성 및 `app.js`에 등록: `routes/stt.js`, `routes/tts.js`, `routes/conversations.js`, `routes/expressions.js`, `routes/auth.js`
- 빈 미들웨어 파일 생성: `middleware/auth.js`, `middleware/turnLimit.js`
- `utils/errorResponse.js` 공통 에러 응답 포맷 유틸리티 작성 — `{ error: { code, message } }` 구조
- `utils/buildPrompt.js` 함수 껍데기 생성 (`topicId` 파라미터 받아 문자열 반환)
- `prompts/_base.txt` 작성 (②JSON 강제 ③피드백 한국어 ④문장별 분리 + is_perfect 처리 공통 지시)
- `prompts/` 아래 6개 topic 파일 생성: `free_talk.txt`, `cafe_order.txt`, `airport_immigration.txt`, `hotel_checkin.txt`, `small_talk.txt`, `opinion.txt` (각각 ①역할/상황 부여만 작성)
- `/health` 엔드포인트 추가 → `{ status: 'ok', timestamp: new Date() }` 반환
- `jest.config.js` 설정 (`testEnvironment: 'node'`, `testMatch: ['**/__tests__/**/*.test.js']`)
- `package.json` scripts에 `"test": "jest"`, `"test:watch": "jest --watch"` 추가
- `.env.example` 파일 작성

**완료 기준:** `node app.js` 실행 후 `GET /health` → `{ status: 'ok' }` 응답 확인. `npm test` 실행 시 Jest 실행 환경 동작 확인 (테스트 파일 없어도 오류 없이 "0 tests passed" 출력)

**✅ 완료 (2026-03-21)** — 패키지 설치, 폴더 구조, 라우트/미들웨어 껍데기, 프롬프트 파일 6개, /health 엔드포인트, Jest 설정 완료.

---

#### Task 004: ✅ 모바일 앱 Expo 프로젝트 구조 및 내비게이션 골격 `@rn-expo-frontend`

- `mobile-app/` 디렉토리, `npx create-expo-app` 초기화 (TypeScript 템플릿)
- 필수 패키지 설치:
  - **내비게이션**: `expo-router`
  - **DB/Auth**: `@supabase/supabase-js`, `@react-native-async-storage/async-storage`
  - **미디어**: `expo-av`, `expo-file-system`, `expo-haptics`
  - **소셜 로그인**: `expo-apple-authentication`, `expo-web-browser`, `expo-auth-session`
  - **상태 관리**: `zustand`
  - **스타일링**: `nativewind`, `tailwindcss`
- NativeWind v4 설정:
  - `npx tailwindcss init` → `tailwind.config.js` 생성, content 경로 설정
  - `global.css` 생성 (`@tailwind base; @tailwind components; @tailwind utilities;`)
  - `babel.config.js` 업데이트 (nativewind/babel 프리셋 추가)
  - `metro.config.js` 업데이트 (CSS 지원 설정)
  - `app/_layout.tsx`에 `import './global.css'` 추가
- 전체 화면 파일 빈 껍데기 생성 (각 파일은 화면명 텍스트만 표시):
  - `app/(auth)/onboarding.tsx`, `app/(auth)/login.tsx`
  - `app/(tabs)/index.tsx` (홈 화면), `app/(tabs)/study.tsx` (학습장 탭)
  - `app/chat/topic-select.tsx`, `app/chat/[id].tsx` (채팅 화면)
  - `app/study/[expressionId].tsx` (표현 상세)
- 탭 네비게이션 설정 (`_layout.tsx`): 홈 탭(🏠), 학습장 탭(📚)
- 인증 가드 레이아웃 설정 (로그인 상태에 따라 auth/tabs 분기)
- `mobile-app/api/chat.js` 빈 함수 껍데기 작성 (transcribeAudio, sendMessage, fetchMessages, saveExpression, playTTS)
- `mobile-app/api/conversations.js` 빈 함수 껍데기 (createConversation, fetchConversations)
- `mobile-app/constants/index.ts` — `API_BASE_URL` 상수 정의
- `mobile-app/utils/supabase.ts` — Supabase 클라이언트 초기화 껍데기
- **환경변수 파일 생성:**
  - `mobile-app/.env` 생성:
    ```
    EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
    EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
    EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
    ```
  - `mobile-app/.env.example` 동일 구조로 작성 (값은 placeholder)
  - `.gitignore`에 `.env` 추가

**완료 기준:** EAS Dev Client에서 앱 실행 시 탭 네비게이션이 보이고 각 화면의 빈 페이지로 전환됨. NativeWind 동작 확인 (임시로 `className="text-red-500"` 적용 후 텍스트 색상 변경 확인). 환경변수 `process.env.EXPO_PUBLIC_API_BASE_URL` 런타임에서 참조 가능 확인

**✅ 완료 (2026-03-21)** — 누락 패키지 설치, NativeWind v4 설정, 화면 골격 7개 생성, 인증 가드 레이아웃, API 추상화 레이어 껍데기, 환경변수 파일 구성 완료.

---

#### Task 005: TypeScript 타입 및 인터페이스 전체 정의 ✅ `@rn-expo-frontend`

- `mobile-app/types/index.ts` 생성, 아래 타입 전부 정의:
  ```typescript
  // DB 엔티티 타입
  type User = { id: string; email: string; display_name: string; created_at: string; last_login_at: string }
  type Conversation = { id: string; user_id: string; topic_id: string; topic_label: string; updated_at: string; turn_count: number }
  type Message = { id: string; conversation_id: string; turn_number: number; role: 'user' | 'assistant'; content: MessageContent; content_type: ContentType; created_at: string }
  type Expression = { id: string; expression_text: string; source_block: SourceBlock; user_memo?: string; created_at: string; topic_label: string; source_sentence: string }

  // LLM 응답 타입
  type FeedbackItem = { original: string | null; corrected: string | null; comment: string; is_perfect: boolean }
  type AITurnContent = { feedback: FeedbackItem[]; next_response: string }
  type UserSpeechContent = { text: string }
  type MessageContent = AITurnContent | UserSpeechContent

  // 분류 타입
  type ContentType = 'user_speech' | 'ai_turn'
  type SourceBlock = 'user_speech' | 'feedback' | 'response'

  // API 요청/응답 타입
  type SendMessageResponse = { message_id: string; turn_number: number; content: AITurnContent }
  type TranscribeResponse = { text: string }
  type APIError = { error: { code: ErrorCode; message: string } }
  type ErrorCode = 'TURN_LIMIT_EXCEEDED' | 'AUDIO_TOO_LONG' | 'STT_FAILED' | 'LLM_JSON_PARSE_FAILED' | 'TTS_FAILED' | 'UNAUTHORIZED' | 'INVALID_AUDIO_FORMAT'
  ```

**완료 기준:** TypeScript 컴파일 에러 없이 빌드됨. `FeedbackItem.is_perfect = true` 시 `original`과 `corrected`가 `string | null` 타입으로 정의됨. 모든 API 응답 구조가 타입으로 커버됨

**✅ 완료 (2026-03-21)** — types/index.ts 생성, ContentType/SourceBlock/FeedbackItem/AITurnContent/UserSpeechContent/MessageContent/User/Conversation/Message/Expression/ErrorCode/TranscribeResponse/SendMessageResponse/APIError 14개 타입 export 완료.

---

#### Task 006: 전역 상태 관리 Store 뼈대 구축 (Zustand) — 우선순위 ✅ `@rn-expo-frontend`

- `mobile-app/store/useAppStore.ts` 생성:
  ```typescript
  interface AppState {
    // 인증 상태
    user: User | null
    session: Session | null
    setSession: (session: Session | null) => void
    clearSession: () => void

    // 일일 턴 제한 상태
    todayTurnCount: number
    isTurnLimitReached: boolean
    setTodayTurnCount: (count: number) => void
    incrementTurnCount: () => void
    resetTurnCount: () => void

    // UI 전역 상태
    isTypingIndicatorVisible: boolean
    setTypingIndicator: (visible: boolean) => void

    // 토스트 메시지
    toastMessage: string | null
    showToast: (message: string) => void
    clearToast: () => void
  }

  export const useAppStore = create<AppState>((set, get) => ({ ... }))
  ```
- `mobile-app/store/index.ts` barrel export 생성
- Phase 2 UI 컴포넌트에서 `isTurnLimitReached`, `isTypingIndicatorVisible`, `toastMessage` 를 Store에서 읽어 렌더링 조건으로 활용 (더미 상태로 테스트 가능)

**완료 기준:**
- `useAppStore()` 호출 시 타입 에러 없이 상태 읽기/쓰기 가능
- 더미 테스트: `setTodayTurnCount(20)` 호출 후 `isTurnLimitReached === true` 확인
- `setTypingIndicator(true)` → 채팅 화면에서 TypingIndicator 표시, `false` → 숨김 (Phase 2 UI와 연결 확인)

**✅ 완료 (2026-03-21)** — store/useAppStore.ts 생성, auth/turn/ui/toast 4개 슬라이스 구현, isTurnLimitReached 파생 로직(count >= 20) 포함. setSession에서 Supabase Session.user → 프로젝트 User 타입 명시적 매핑 처리. store/index.ts barrel export 완료.

---

### Phase 2: UI/UX 완성 (더미 데이터 활용)

> 모든 화면을 하드코딩된 더미 데이터로 완성한다. 백엔드 없이도 전체 앱 플로우를 확인할 수 있는 상태가 목표다.
> 스타일링은 NativeWind Tailwind 클래스를 사용한다.

---

#### Task 007: 공통 UI 컴포넌트 라이브러리 구현 ✅ `@rn-expo-frontend`

- `components/chat/UserBubble.tsx` — 사용자 발화 오른쪽 말풍선 (텍스트 + 🔊 TTSButton)
- `components/chat/AIBubble.tsx` — AI 응답 컨테이너 (FeedbackBlock 배열 + 대화 응답 블록 포함)
- `components/chat/FeedbackBlock.tsx` — 피드백 블록 (배경색 구분):
  - `is_perfect = false`: 원문(취소선) → 교정문(강조 + 🔊) → 코멘트
  - `is_perfect = true`: 칭찬 코멘트만 표시, 🔊 버튼 미표시
- `components/chat/TypingIndicator.tsx` — "AI가 문장을 교정하고 있어요 ✍️" 로딩 애니메이션, `useAppStore`의 `isTypingIndicatorVisible` 구독
- `components/chat/RecordButton.tsx` — PTT 마이크 버튼 (녹음 중 파형 애니메이션, 30초 타이머 UI 표시). `useAppStore`의 `isTurnLimitReached` 구독 → true 시 비활성화
- `components/study/ExpressionCard.tsx` — 표현 카드 (expression_text, topic_label, 저장일, 🔊 버튼, 메모)
- `components/common/TTSButton.tsx` — 🔊 아이콘 버튼. Props: `text: string`, `isPlaying: boolean`, `onPress: () => void`
- `components/common/SavePopup.tsx` — 롱프레스 편집 팝업 (텍스트 입력창, 메모 입력란, 저장/취소 버튼). Props: `initialText: string`, `onSave: (text, memo) => void`
- `components/common/Toast.tsx` — `useAppStore`의 `toastMessage` 구독, 2초 자동 소멸

**완료 기준:** 더미 화면에서 모든 컴포넌트 렌더링 확인. `is_perfect = true` 항목 🔊 버튼 미표시 확인. SavePopup 텍스트 수정 가능 확인. NativeWind 클래스 적용 확인

**✅ 완료 (2026-03-21)** — TTSButton/SavePopup/Toast/FeedbackBlock/UserBubble/AIBubble/TypingIndicator/RecordButton/ExpressionCard 9개 컴포넌트 구현 완료. NativeWind className 적용, is_perfect 분기, isTurnLimitReached/isTypingIndicatorVisible store 구독, 30초 카운트다운 타이머 포함.

---

#### Task 008: 온보딩 및 소셜 로그인 화면 UI ✅ `@rn-expo-frontend`

- `app/(auth)/onboarding.tsx`: 슬라이드 3장 구현
  - 슬라이드 1: "AI 선생님과 부담 없이 영어로 대화해요"
  - 슬라이드 2: "틀린 표현은 즉시 교정! 완벽하면 칭찬!"
  - 슬라이드 3: "배운 표현은 대화 문맥과 함께 저장" + 로그인 버튼
- 슬라이드 인디케이터 점, 좌우 스와이프 또는 "다음" 버튼
- 마지막 슬라이드: "Google로 시작하기" / "Apple로 시작하기" 버튼 배치
- 더미: 버튼 탭 시 홈 탭으로 바로 이동 (실제 auth는 Task 018에서 연동)
- `AsyncStorage`에 `onboarding_completed` 플래그 저장 → 재실행 시 온보딩 skip, 홈으로 직행

**완료 기준:** 슬라이드 스와이프/탭 동작. 마지막 슬라이드에서 버튼 탭 시 홈 화면 진입. 재실행 시 온보딩 화면 미표시 확인

**✅ 완료 (2026-03-21)** — onboarding.tsx 슬라이드 3장 구현, 슬라이드 인디케이터, Google/Apple 버튼 UI(더미), AsyncStorage `onboarding_completed` 플래그 저장/조회 완료.

---

#### Task 009: 홈 화면 및 주제 선택 화면 UI ✅ `@rn-expo-frontend`

- `app/(tabs)/index.tsx` 홈 화면:
  - 더미 대화 목록 3건 (topic_label, 마지막 대화 시간, 대화 턴 수)
  - FAB(+) 버튼 → 주제 선택 화면으로 이동
  - 기존 대화 탭 → 채팅 화면으로 이동 (conversation id 전달)
  - 빈 상태 화면 (대화 없을 때)
- `app/chat/topic-select.tsx` 주제 선택 화면:
  - 6개 topic 카드 (topic_label + AI 역할 한 줄 설명)
  - 탭 → 새 대화 시작 → `app/chat/[id].tsx`로 이동

**완료 기준:** 더미 대화 목록 3개 표시. 주제 선택 후 채팅 화면 진입 확인. FAB 탭 → 주제 선택 → 채팅 화면 전체 플로우 확인

**✅ 완료 (2026-03-21)** — (tabs)/index.tsx 더미 대화 목록 3건, FAB 버튼, 빈 상태 화면 구현. chat/topic-select.tsx 6개 topic 카드 구현 완료.

---

#### Task 010: 채팅 화면 UI (더미 데이터) ✅ `@rn-expo-frontend`

- `app/chat/[id].tsx` 채팅 화면 레이아웃:
  - 헤더: 주제명 + "대화 끝내기" 버튼 (우상단, 탭 시 홈으로 즉시 이동)
  - 스크롤 영역: UserBubble + AIBubble(FeedbackBlock + 응답 블록) 더미 데이터로 렌더링
  - 하단: RecordButton + 텍스트 입력 모드 전환 (키보드 아이콘)
- 더미 대화 데이터 2턴 이상 표시 (is_perfect=false 항목 1개, is_perfect=true 항목 1개 포함)
- 롱프레스 → SavePopup 등장, 블록 종류별 원문 자동 채우기 (더미):
  - 피드백 블록 롱프레스 → corrected 텍스트 채워짐
  - 대화 응답 블록 롱프레스 → next_response 텍스트 채워짐
  - 내 발화 롱프레스 → content.text 채워짐
- `useAppStore`의 `isTypingIndicatorVisible` 구독하여 TypingIndicator 표시/숨김
- `useAppStore`의 `isTurnLimitReached` 구독하여 입력 비활성화 + "오늘의 연습을 모두 완료했어요! 내일 다시 만나요 🎉"

**완료 기준:**
- 더미 데이터로 피드백 블록과 대화 응답 블록이 시각적으로 구분되어 렌더링
- `is_perfect = true` 항목: 🔊 버튼 미표시, 칭찬 코멘트만 표시
- 롱프레스 팝업에서 블록별 원문 자동 채우기 확인
- Store에서 `isTurnLimitReached = true` 설정 시 RecordButton 비활성화 확인

**✅ 완료 (2026-03-21)** — chat/[id].tsx 더미 2턴 렌더링, UserBubble/AIBubble/FeedbackBlock/RecordButton 컴포넌트 연결, TypingIndicator/isTurnLimitReached store 구독, 롱프레스 SavePopup 구현 완료.

---

#### Task 011: 표현 학습장 탭 UI (더미 데이터) ✅ `@rn-expo-frontend`

- `app/(tabs)/study.tsx` 학습장 탭:
  - ExpressionCard 목록 (저장일 역순 더미 3건)
  - 빈 상태 화면 (표현 없을 때)
- `app/study/[expressionId].tsx` 표현 상세 화면:
  - 상단: 저장한 표현 강조 표시
  - 중간: 원본 대화 문맥 (채팅 UI 형태, 읽기 전용) — 해당 `ai_turn` 블록 전체 하이라이트
  - 하단: "예문 더 보기" 버튼 → 더미 예문 2~3개 표시
- 표현 삭제: 카드 롱프레스 또는 스와이프 → 확인 팝업 → 목록에서 제거 (더미)

**완료 기준:** 더미 표현 카드 3개 표시. 탭 시 원본 대화 문맥 화면 열림. 해당 `ai_turn` 블록 하이라이트 확인. 삭제 팝업 동작 확인

**✅ 완료 (2026-03-21)** — (tabs)/study.tsx ExpressionCard 목록, 빈 상태 화면, study/[expressionId].tsx 대화 문맥 화면, DeleteConfirmModal 스와이프 삭제 구현 완료.

---

### Phase 3: 백엔드 API 구현

> 각 API 구현 완료 후 **Jest + Supertest**로 엔드포인트 테스트를 수행한다 (`npm test`).
> 테스트 파일은 `ai-server/__tests__/` 디렉토리에 위치한다. 테스트 모두 통과 확인 후 다음 Task로 진행한다.

---

#### Task 012: 인증 미들웨어 및 KST 일일 턴 제한 미들웨어 ✅ — 우선순위 `@contexttalk-api-architect` + `@api-test-writer`

- `middleware/auth.js` 구현:
  - `Authorization: Bearer <token>` 헤더 파싱
  - Supabase `supabase.auth.getUser(token)` 서버사이드 JWT 검증
  - 검증 성공 시 `req.user = { id, email }` 주입
  - 토큰 없음/만료 시 `UNAUTHORIZED` 401 응답
- `middleware/turnLimit.js` 구현:
  - KST(UTC+9) 기준 오늘 자정 UTC timestamp 계산
  - 쿼리: `SELECT COUNT(*) FROM messages WHERE user_id = :uid AND content_type = 'user_speech' AND created_at >= :kst_today_start`
  - 20 이상 시 `TURN_LIMIT_EXCEEDED` 429 응답
  - 미만 시 `req.todayTurnCount` 주입 후 next()
- 모든 인증 필요 라우트에 `auth` 미들웨어 등록
- `__tests__/middleware.test.js` 작성

## 테스트 체크리스트 (Jest + Supertest)

> `npm test` 실행으로 아래 시나리오를 모두 통과 확인 후 Task 013으로 진행

- [ ] 유효한 JWT → 다음 미들웨어 통과 (200 또는 다음 핸들러 실행)
- [ ] 헤더 없음 → 401 `{ error: { code: 'UNAUTHORIZED' } }`
- [ ] 만료된 JWT → 401 `{ error: { code: 'UNAUTHORIZED' } }`
- [ ] 정상 user, 오늘 0회 → 제한 통과
- [ ] 정상 user, 오늘 20회 소진 → 429 `{ error: { code: 'TURN_LIMIT_EXCEEDED' } }`
- [ ] `created_at`을 어제 날짜로 설정한 레코드는 오늘 카운트에 미포함 (KST 기준)

**완료 기준:** 위 6개 테스트 시나리오 전부 통과 (`npm test` 초록불)

**✅ 완료 (2026-03-22)** — middleware/auth.js (Supabase getUser JWT 검증, req.user 주입), middleware/turnLimit.js (KST UTC+9 자정 계산, COUNT 쿼리, 20턴 제한), __tests__/middleware.test.js 작성 완료.

---

#### Task 013: STT API 구현 (POST /api/stt) ✅ `@contexttalk-api-architect` + `@api-test-writer`

- `routes/stt.js` 구현:
  - `multer` 설정 (임시 파일 저장, 크기 제한)
  - m4a 포맷 검증 (mimetype `audio/mp4` 또는 파일 확장자), 비유효 시 `INVALID_AUDIO_FORMAT` 400 응답
  - 오디오 파일 크기 기반 30초 초과 추정 시 `AUDIO_TOO_LONG` 400 응답 (백엔드 2차 방어선)
  - OpenAI Whisper API 호출: `openai.audio.transcriptions.create({ file, model: 'whisper-1' })`
  - Whisper 오류 시 `STT_FAILED` 502 응답
  - 성공 시 `{ "text": string }` 반환
  - 처리 완료 후 임시 오디오 파일 즉시 삭제 (서버에 저장 금지)
- `__tests__/stt.test.js` 작성 (Whisper API는 jest.mock으로 대체)

## 테스트 체크리스트 (Jest + Supertest)

- [ ] 유효한 m4a 파일 전송 → `{ "text": "..." }` 응답 (텍스트 비어있지 않음)
- [ ] 비m4a 파일(mp3, wav) 전송 → 400 `INVALID_AUDIO_FORMAT`
- [ ] 인증 헤더 없이 전송 → 401 `UNAUTHORIZED`
- [ ] Whisper API mock 오류 주입 → 502 `STT_FAILED`
- [ ] 요청 완료 후 서버 임시 파일 삭제 확인

**완료 기준:** 위 5개 테스트 시나리오 전부 통과

**✅ 완료 (2026-03-22)** — routes/stt.js multer 설정, m4a 포맷 검증, 500KB 크기 제한(30초 방어), Whisper API 호출, 임시 파일 삭제, __tests__/stt.test.js 작성 완료.

---

#### Task 014: LLM API 구현 (POST /api/conversations/:id/messages) ✅ `@contexttalk-api-architect` + `@api-test-writer`

- `routes/conversations.js` 구현 (POST `/:id/messages` 엔드포인트):
  - `auth` + `turnLimit` 미들웨어 적용
  - Request body `{ "text": string }` 검증
  - Supabase에서 해당 conversation의 `topic_id` 조회 (본인 소유 확인 포함)
  - `utils/buildPrompt.js` 완성: `fs.readFileSync`로 `{topicId}.txt` + `_base.txt` 문자열 연결 (`${topic}\n\n${base}`)
  - 최근 6턴 메시지 조회 (슬라이딩 윈도우: turn_number 내림차순 6개 조회 후 오름차순 정렬)
  - OpenAI GPT-4o-mini 호출 (`response_format: { type: "json_object" }`)
  - JSON 파싱 실패 시 최대 2회 재시도, 최종 실패 시 `LLM_JSON_PARSE_FAILED` 502 응답 + `console.error('error_type: json_parse_failure')` 로그
  - 사용자 발화 messages INSERT (role='user', content_type='user_speech', content=`{ text }`, user_id 포함)
  - AI 응답 messages INSERT (role='assistant', content_type='ai_turn', content=`{ feedback, next_response }`, user_id 포함)
  - `{ "message_id": uuid, "turn_number": int, "content": { feedback: [...], next_response: string } }` 반환
- `__tests__/conversations.test.js` 작성 (GPT API는 jest.mock으로 대체)

## 테스트 체크리스트 (Jest + Supertest)

- [ ] 유효한 텍스트 전송 → `{ message_id, turn_number, content }` 응답, messages 테이블에 2행 INSERT 확인
- [ ] `is_perfect: true` 응답 시 `original === null && corrected === null` 확인
- [ ] 7번째 턴: LLM에 전달되는 messages_history가 6턴을 초과하지 않음
- [ ] JSON 파싱 실패 mock → 2회 재시도 후 502 `LLM_JSON_PARSE_FAILED`
- [ ] 20회 소진 상태 → POST 시 429 `TURN_LIMIT_EXCEEDED` (messages INSERT 없음 확인)
- [ ] 타인 conversation id로 요청 → 403 또는 404

**완료 기준:** 위 6개 테스트 시나리오 전부 통과

**✅ 완료 (2026-03-22)** — routes/conversations.js POST /:id/messages 구현: auth+turnLimit 미들웨어, buildPrompt, 6-turn 슬라이딩 윈도우, GPT-4o-mini JSON mode, 2회 재시도, Supabase INSERT, __tests__/conversations.test.js 작성 완료.

---

#### Task 015: TTS API 구현 (POST /api/tts) ✅ `@contexttalk-api-architect` + `@api-test-writer`

- `routes/tts.js` 구현:
  - `auth` 미들웨어 적용
  - Request body `{ "text": string }` 수신 및 빈 문자열 검증
  - OpenAI TTS API 호출: `openai.audio.speech.create({ model: 'tts-1', voice: 'nova', input: text, response_format: 'mp3' })`
  - 응답 Content-Type `audio/mpeg` 설정, mp3 binary stream을 응답으로 직접 pipe
  - OpenAI TTS 오류 시 `TTS_FAILED` 502 응답
- `__tests__/tts.test.js` 작성 (TTS API는 jest.mock으로 대체)

## 테스트 체크리스트 (Jest + Supertest)

- [ ] 유효한 텍스트 전송 → `Content-Type: audio/mpeg` 응답, body가 non-empty binary
- [ ] 빈 문자열 전송 → 400 오류
- [ ] 인증 없이 요청 → 401 `UNAUTHORIZED`
- [ ] TTS API mock 오류 주입 → 502 `TTS_FAILED`
- [ ] 응답 binary 데이터가 non-empty임을 확인 (`response.body.length > 0`)

**완료 기준:** 위 5개 테스트 시나리오 전부 통과

**✅ 완료 (2026-03-22)** — routes/tts.js auth 미들웨어, OpenAI TTS (tts-1/nova), mp3 stream pipe, 500자 제한, __tests__/tts.test.js 작성 완료.

---

#### Task 016: 대화 및 표현 CRUD API 구현 `@contexttalk-api-architect` + `@api-test-writer`

- `routes/conversations.js` 나머지 엔드포인트 구현:
  - `POST /api/conversations` — conversations INSERT, `{ id, topic_id, topic_label, created_at }` 반환
  - `GET /api/conversations` — 본인 대화 목록 (updated_at 역순), turn_count(해당 conversation의 user_speech 행 수) 포함
  - `GET /api/conversations/:id/messages` — turn_number 오름차순 전체 메시지 반환
- `routes/expressions.js` 구현:
  - `POST /api/expressions` — `{ conversation_id, message_id, expression_text, source_block, user_memo? }` 검증 및 INSERT, `{ id, created_at }` 반환 (source_block 미포함 시 400 오류)
  - `GET /api/expressions` — source_block 기준 3분기 CASE SQL로 source_sentence 계산, created_at 역순
  - `DELETE /api/expressions/:id` — RLS 검증 후 삭제, `{ success: true }` 반환
- `routes/auth.js` 구현:
  - `POST /api/auth/verify` — JWT 검증 → `{ valid: true/false }` 반환
- `__tests__/crud.test.js` 작성

## 테스트 체크리스트 (Jest + Supertest)

- [ ] 대화 생성 → 목록 조회(turn_count=0) → 메시지 추가 → 목록 재조회(turn_count=1) 순서 플로우
- [ ] GET /api/expressions: source_block='feedback' → source_sentence = feedback[0].corrected 값 확인
- [ ] GET /api/expressions: source_block='response' → source_sentence = next_response 값 확인
- [ ] GET /api/expressions: source_block='user_speech' → source_sentence = content.text 값 확인
- [ ] POST /api/expressions: source_block 미포함 → 400 오류
- [ ] DELETE /api/expressions/:id: 타인 표현 삭제 시도 → RLS 차단 (403/404)
- [ ] DELETE /api/expressions/:id: 본인 표현 삭제 → `{ success: true }` + DB 행 삭제 확인

**완료 기준:** 위 7개 테스트 시나리오 전부 통과

---

#### Task 017: 백엔드 통합 테스트 `@api-test-writer`

- `__tests__/integration.test.js` 작성: 전체 대화 플로우 E2E 시나리오
  1. 대화 생성 → STT(텍스트 직접 주입) → LLM 응답 수신 → 표현 저장 → 표현 목록 조회
  2. 같은 플로우 6회 반복 후 7번째 메시지: LLM context 6턴 슬라이딩 윈도우 확인
- 일일 20턴 제한 전체 시나리오: 20회 전송 성공 → 21번째 → 429 확인
- 에러 코드 7종 전부 의도적 트리거 및 `{ error: { code, message } }` 포맷 일관성 검증
- KST 자정 기준 턴 카운터 리셋: `created_at`을 어제 날짜로 수동 설정 후 당일 카운트 0 확인
- `npm test` 전체 실행 (Task 012~017 테스트 파일 총합) — 모두 통과

**완료 기준:** `npm test` 실행 시 모든 테스트 통과. 에러 응답 포맷 `{ error: { code, message } }` 일관성 확인. Phase 3 완료 → Phase 4 착수 가능

---

### Phase 4: 프론트엔드-백엔드 연동

> Phase 2의 더미 데이터를 실제 API 호출로 교체한다.

---

#### Task 018: 소셜 로그인 (Google/Apple) 실제 연동 `@rn-expo-frontend`

- **필수 패키지 확인:** Task 004에서 설치한 `expo-apple-authentication`, `expo-web-browser`, `expo-auth-session` 동작 확인
- `mobile-app/utils/supabase.ts` Supabase 클라이언트 초기화 완성 (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` 환경변수 연결)
- **Google OAuth 연동:**
  ```javascript
  // expo-web-browser + expo-auth-session 활용 (Supabase OAuth WebBrowser 리다이렉트 방식)
  const { data } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: makeRedirectUri() }
  })
  await WebBrowser.openAuthSessionAsync(data.url, makeRedirectUri())
  ```
- **Apple Sign In 연동:**
  ```javascript
  // expo-apple-authentication 활용 (네이티브 Sign In with Apple)
  const credential = await AppleAuthentication.signInAsync({ ... })
  await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken })
  ```
- 로그인 성공 콜백:
  - `useAppStore`의 `setSession()` 호출 (user, session 전역 상태 저장)
  - Supabase `users` 테이블 upsert (id, email, display_name, last_login_at)
  - 홈 화면으로 이동
- 앱 시작 시 `supabase.auth.getSession()` → 유효 세션 시 Store에 복원 → 홈, 무효 시 온보딩/로그인
- 모든 API 요청에 `Authorization: Bearer <token>` 헤더 자동 첨부 (fetch wrapper 또는 axios interceptor)

**완료 기준:** EAS Dev Client에서 Google/Apple 로그인 완료 후 홈 화면 진입. `useAppStore.user` 에 사용자 정보 저장 확인. JWT가 API 요청 헤더에 포함됨 확인. 앱 재실행 시 로그인 유지됨 확인

---

#### Task 019: API 추상화 레이어 구현 (chat.js) `@rn-expo-frontend`

- `mobile-app/api/chat.js` 전체 함수 실제 구현:
  ```javascript
  // ① STT: 오디오 URI → FormData 생성 → POST /api/stt → { text } 반환
  export async function transcribeAudio(audioUri) { ... }

  // ② LLM: POST /api/conversations/:id/messages → { message_id, turn_number, content } 반환
  export async function sendMessage(conversationId, text) { ... }

  // ③ 메시지 조회: GET /api/conversations/:id/messages
  export async function fetchMessages(conversationId) { ... }

  // ④ 표현 저장: POST /api/expressions (source_block 포함)
  export async function saveExpression(payload) { ... }

  // ⑤ TTS 재생: mp3 binary → base64 → FileSystem 임시파일 → expo-av 재생
  //    _currentSound 모듈 변수로 재생 중단 메커니즘 구현
  let _currentSound = null;
  export async function playTTS(text) { ... }
  ```
- `mobile-app/api/conversations.js` 구현: `createConversation`, `fetchConversations`
- API 에러 코드별 공통 처리:
  - `TURN_LIMIT_EXCEEDED` → `useAppStore`의 `setTodayTurnCount(20)` 호출 (isTurnLimitReached 자동 true)
  - `UNAUTHORIZED` → `supabase.auth.refreshSession()` 자동 갱신 시도 → 실패 시 `clearSession()` + 로그인 화면 이동

**완료 기준:**
- `transcribeAudio` 실제 m4a 파일로 호출 → `{ text }` 수신
- `sendMessage` 호출 → AI 응답 JSON 수신, `useAppStore.incrementTurnCount()` 호출 확인
- `playTTS` 연속 탭 시: 이전 오디오 즉시 중단 후 새 오디오 재생 (`_currentSound` 동작 확인)
- `saveExpression` payload에 source_block 포함 → DB 저장 확인

---

#### Task 020: STT 녹음 + 2-Step 호출 흐름 연동 `@rn-expo-frontend`

- `expo-av` Audio.Recording PTT 구현:
  - `pressIn` → `Audio.Recording.createAsync()` 시작
  - Android MPEG_4/AAC 코덱 명시 설정 (PRD F-01 코드 블록 그대로 적용)
  - `pressOut` → `recording.stopAndUnloadAsync()` → URI 획득 → `handleRecordingStop(uri)` 호출
- 30초 타이머: `setTimeout(30000)` 후 자동 녹음 종료 + `Haptics.notificationAsync()` 진동 피드백
- 마이크 권한 요청 (`Audio.requestPermissionsAsync()`), 거부 시 설정 앱 이동 유도
- **2-Step 호출 흐름 구현 (handleRecordingStop):**
  ```javascript
  const { text } = await transcribeAudio(audioUri);
  appendUserBubble(text);            // 사용자 말풍선 즉시 표시
  useAppStore.setTypingIndicator(true);
  const { message_id, content } = await sendMessage(conversationId, text);
  useAppStore.setTypingIndicator(false);
  appendAIBubble(message_id, content);
  ```
- 텍스트 직접 입력 모드 (키보드 아이콘 탭 시 전환)
- `TURN_LIMIT_EXCEEDED` 수신 시 Store 업데이트 → RecordButton 자동 비활성화

**완료 기준:**
- iOS/Android 양 플랫폼에서 m4a 녹음 → STT 결과 말풍선 표시 **3초 이내**
- STT 말풍선 표시 직후 TypingIndicator 등장, AI 응답 수신 후 제거
- AI 응답 수신 **8초 이내** (STT 표시 시점 기준)
- Android에서 m4a Whisper 정상 변환 확인 (MPEG_4/AAC 설정 적용)

---

#### Task 021: TTS 재생 연동 (expo-av + _currentSound 중단 메커니즘) `@rn-expo-frontend`

- Task 019의 `playTTS` 함수를 모든 🔊 버튼에 연결:
  - UserBubble 🔊: `content.text` 전달
  - FeedbackBlock 🔊: `feedback[].corrected` 전달 (`is_perfect = false` 항목만 버튼 렌더링)
  - AI 응답 블록 🔊: `next_response` 전달
  - 학습장 ExpressionCard 🔊: `expression_text` 전달
- TTSButton 컴포넌트에 `isPlaying` 상태 연결 (재생 중: 정지 아이콘, 완료/중단: 🔊 아이콘)
- 재생 중 다른 🔊 탭: `_currentSound.stopAsync()` 즉시 중단 후 새 텍스트 재생
- `TTS_FAILED` 수신 시 `useAppStore.showToast('발음 듣기에 실패했어요.')` 호출
- 오프라인 상태 시 `useAppStore.showToast('음성을 불러올 수 없습니다')` 호출

**완료 기준:**
- 채팅창/학습장 모든 위치의 🔊 버튼에서 Nova 음성 재생
- `is_perfect = true` 항목에 🔊 버튼 미표시
- 연속 🔊 탭 시 이전 오디오 즉시 중단 후 새 오디오 재생
- DB messages / expressions 테이블에 TTS URL 저장 없음 확인

---

#### Task 022: 표현 저장 및 학습장 탭 전체 연동 `@rn-expo-frontend`

- 채팅 화면 롱프레스 SavePopup: 블록 종류별 초기 텍스트 + source_block 값 결정:

  | 롱프레스 대상 | 초기 텍스트 | source_block |
  |-------------|-----------|-------------|
  | 피드백 블록 | `feedback[].corrected` | `'feedback'` |
  | 대화 응답 블록 | `next_response` | `'response'` |
  | 내 발화 말풍선 | `content.text` | `'user_speech'` |

- 저장 버튼 → `saveExpression({ conversation_id, message_id, expression_text, source_block, user_memo })` 호출
- 저장 완료: `showToast('표현이 저장되었습니다!')` + 해당 말풍선에 북마크 아이콘 표시
- 학습장 탭: `GET /api/expressions` 호출 → ExpressionCard 목록 렌더링 (created_at 역순)
- 표현 상세 화면: `GET /api/conversations/:id/messages` → 원본 대화 문맥 렌더링, 해당 `ai_turn` 블록 하이라이트
- 표현 삭제 팝업 → `DELETE /api/expressions/:id` → 목록 갱신

**완료 기준:**
- 피드백 블록 / 응답 블록 / 내 발화 3가지 경로로 표현 저장 후 학습장에서 확인
- DB `expressions.source_block` 값 3종 정확성 확인
- 학습장 → 표현 탭 → 원본 대화 문맥 → `ai_turn` 블록 하이라이트 확인

---

### Phase 5: 완성도 및 최종 검증

---

#### Task 023: 에러 핸들링 및 UX 폴리싱 `@rn-expo-frontend`

- 전역 Toast 컴포넌트를 `useAppStore.toastMessage` 구독으로 완성 (에러 코드별 메시지 매핑 테이블 적용)
- 네트워크 오프라인 감지 (`NetInfo`) → `showToast()` + 입력 비활성화 → 재연결 시 자동 복구
- `UNAUTHORIZED` 수신 시 `supabase.auth.refreshSession()` 자동 갱신 → 성공 시 원래 요청 재시도, 실패 시 `clearSession()` + 로그인 화면 이동
- 접근성 최소 기준 적용:
  - 모든 텍스트 폰트 크기 14sp 이상
  - 마이크 버튼 / 🔊 버튼 터치 영역 최소 44×44pt
- 빈 상태 화면 완성 (홈: 대화 없을 때, 학습장: 표현 없을 때)
- STT 실패(`STT_FAILED`) 시 "다시 말하기" 버튼 표시 → 재녹음 허용
- 마이크 권한 거부 시 설정 이동 안내 팝업

**완료 기준:** 오프라인 전환 시 토스트 즉시 표시. 401 수신 시 자동 토큰 갱신 시도. STT 실패 시 "다시 말하기" 버튼 노출. 마이크/🔊 버튼 터치 영역 44pt 이상

---

#### Task 024: MVP 시드 데이터 기반 전체 통합 테스트 `[Developer]`

- PRD 시드 데이터 3개 시나리오를 실제 디바이스(iOS + Android)에서 전체 플로우 수동 테스트:

  | 시나리오 | 발화 | 검증 포인트 |
  |----------|------|------------|
  | `airport_immigration` | "I am visit America for vacation and staying in New York for one week." | 교정 피드백 확인, corrected 롱프레스 팝업 원문 확인, source_block='feedback' DB 저장 확인 |
  | `hotel_checkin` | "I has reservation under the name Kim. Can I checking in early?" | feedback[] 배열 2개 원소 생성 확인 |
  | `cafe_order` | "I want a flat white with oat milk and can I get it to go?" | is_perfect=true 처리 확인, 🔊 버튼 미표시 확인 |

- 일일 20턴 도달 → 입력 잠금 → KST 자정 이후 해제 (`npm test`의 Jest 단위 테스트로 로직 검증)
- 표현 저장 → 학습장 탭 전환 → 카드 확인 → 원본 대화 문맥 전체 플로우
- TTS 연속 탭 중단 메커니즘: 재생 중 다른 🔊 탭 → 이전 오디오 즉시 중단 확인
- 백엔드 전체 테스트 최종 실행: `npm test` (모든 Jest + Supertest 테스트 통과 확인)
- DB 최종 확인: messages 테이블에 TTS URL 없음, expressions.source_block 값 정확성

**완료 기준:**
- 3개 시드 시나리오 iOS/Android 양 플랫폼에서 에러 없이 완주
- 전체 핵심 루프 (말하기 → AI 피드백 → 표현 저장 → 문맥 복습) 동작 확인
- is_perfect 처리 양 방향(true/false) 모두 화면에서 검증
- `npm test` 최종 전체 통과
- **Phase 5 완료 = MVP 출시 준비 완료**

---

## Phase별 진행 상황 요약

| Phase | 작업 수 | 상태 |
|-------|---------|------|
| Phase 0: 개발 환경 선행 설정 | 1 | ✅ 완료 |
| Phase 1: 프로젝트 골격 구축 | 5 | ✅ 완료 |
| Phase 2: UI/UX 완성 (더미 데이터) | 5 | ✅ 완료 |
| Phase 3: 백엔드 API 구현 | 6 | ⬜ 대기 |
| Phase 4: 프론트엔드-백엔드 연동 | 5 | ⬜ 대기 |
| Phase 5: 완성도 및 최종 검증 | 2 | ⬜ 대기 |
| **합계** | **24** | |

## Task 전체 목록

| Task | Phase | 설명 | 담당 에이전트 | 상태 |
|------|-------|------|--------------|------|
| Task 001 | 0 | EAS Build 및 외부 서비스 초기 설정 | `[Developer]` | ✅ |
| Task 002 | 1 | Supabase DB 스키마, RLS, 트리거, 인덱스 설정 | `[Developer]` | ✅ |
| Task 003 | 1 | 백엔드 Express 서버 프로젝트 구조 설정 | `@contexttalk-api-architect` | ✅ |
| Task 004 | 1 | 모바일 앱 Expo 프로젝트 구조 및 내비게이션 골격 | `@rn-expo-frontend` | ✅ |
| Task 005 | 1 | TypeScript 타입 및 인터페이스 전체 정의 | `@rn-expo-frontend` | ✅ |
| Task 006 | 1 | 전역 상태 관리 Store 뼈대 구축 (Zustand) | `@rn-expo-frontend` | ✅ |
| Task 007 | 2 | 공통 UI 컴포넌트 라이브러리 구현 | `@rn-expo-frontend` | ✅ |
| Task 008 | 2 | 온보딩 및 소셜 로그인 화면 UI | `@rn-expo-frontend` | ✅ |
| Task 009 | 2 | 홈 화면 및 주제 선택 화면 UI | `@rn-expo-frontend` | ✅ |
| Task 010 | 2 | 채팅 화면 UI (더미 데이터) | `@rn-expo-frontend` | ✅ |
| Task 011 | 2 | 표현 학습장 탭 UI (더미 데이터) | `@rn-expo-frontend` | ✅ |
| Task 012 | 3 | 인증 미들웨어 및 KST 일일 턴 제한 미들웨어 | `@contexttalk-api-architect` + `@api-test-writer` | ✅ |
| Task 013 | 3 | STT API 구현 (POST /api/stt) | `@contexttalk-api-architect` + `@api-test-writer` | ✅ |
| Task 014 | 3 | LLM API 구현 (POST /api/conversations/:id/messages) | `@contexttalk-api-architect` + `@api-test-writer` | ✅ |
| Task 015 | 3 | TTS API 구현 (POST /api/tts) | `@contexttalk-api-architect` + `@api-test-writer` | ✅ |
| Task 016 | 3 | 대화 및 표현 CRUD API 구현 | `@contexttalk-api-architect` + `@api-test-writer` | ⬜ |
| Task 017 | 3 | 백엔드 통합 테스트 (Jest + Supertest) | `@api-test-writer` | ⬜ |
| Task 018 | 4 | 소셜 로그인 (Google/Apple) 실제 연동 | `@rn-expo-frontend` | ⬜ |
| Task 019 | 4 | API 추상화 레이어 구현 (chat.js) | `@rn-expo-frontend` | ⬜ |
| Task 020 | 4 | STT 녹음 + 2-Step 호출 흐름 연동 | `@rn-expo-frontend` | ⬜ |
| Task 021 | 4 | TTS 재생 연동 (expo-av + _currentSound) | `@rn-expo-frontend` | ⬜ |
| Task 022 | 4 | 표현 저장 및 학습장 탭 전체 연동 | `@rn-expo-frontend` | ⬜ |
| Task 023 | 5 | 에러 핸들링 및 UX 폴리싱 | `@rn-expo-frontend` | ⬜ |
| Task 024 | 5 | MVP 시드 데이터 기반 전체 통합 테스트 | `[Developer]` | ⬜ |

---

## 백엔드 API 테스트 시나리오 (Jest + Supertest)

Phase 3 전체 테스트 커버리지 요약 (`npm test` 기준):

| 시나리오 | 대상 | 테스트 파일 |
|----------|------|------------|
| JWT 인증 성공/실패 | auth 미들웨어 | middleware.test.js |
| KST 턴 카운터 20회 제한 + 자정 리셋 | turnLimit 미들웨어 | middleware.test.js |
| 유효한 m4a → STT 텍스트 반환 | POST /api/stt | stt.test.js |
| 비m4a 포맷 → 400 INVALID_AUDIO_FORMAT | POST /api/stt | stt.test.js |
| LLM 응답 JSON 구조 + is_perfect=true | POST /api/conversations/:id/messages | conversations.test.js |
| 6턴 슬라이딩 윈도우 + 20턴 제한 | POST /api/conversations/:id/messages | conversations.test.js |
| TTS mp3 binary stream 응답 | POST /api/tts | tts.test.js |
| CRUD 전체 플로우 + RLS 차단 | conversations, expressions | crud.test.js |
| source_block 3분기 source_sentence | GET /api/expressions | crud.test.js |
| 전체 대화 E2E 플로우 | 전체 API | integration.test.js |

---

*이 ROADMAP은 PRD v1.7 기준으로 작성된 살아있는 문서입니다. 개발 진행에 따라 지속적으로 업데이트하세요.*
*Task 완료 시 ⬜ → ✅, Phase 전체 완료 시 Phase 제목에 ✅ 표시*
