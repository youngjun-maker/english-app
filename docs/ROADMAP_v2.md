# 섀도잉 기능 개발 로드맵 (v2)

> "원어민의 말을 듣고, 멈추고, 따라 말하며 억양과 리듬을 몸에 새기는 집중 훈련"

## 개요

기존 AI 대화 연습 앱(ROADMAP.md, Task 001~024)에 **섀도잉(Shadowing) 기능**을 추가합니다.
영준님이 직접 엄선한 1~2분 영상 클립에 타임스탬프 스크립트를 붙여, 1문장 → 3문장 → 전체의 점진적 확장 방식으로 학습합니다.

**핵심 기능:**
- **점진적 섀도잉**: 1문장 Auto-pause → 3문장 블록 → 전체 통문장 3단계 모드
- **루프 반복**: 입에 붙을 때까지 특정 문장 구간 무한 반복
- **보조 도구**: 속도 0.75x / 자막 블라인드 2단계 / 마이크 녹음 → 원어민과 비교 재생
- **콘텐츠 관리**: Whisper API로 영상 오디오 → 타임스탬프 JSON 자동 추출

## 기술 스택 (신규 추가)

| 영역 | 기술 | 비고 |
|------|------|------|
| **영상 재생** | expo-video | Expo SDK 54 권장 영상 플레이어 |
| **타임스탬프 추출** | OpenAI Whisper (`verbose_json`) | `word`-level 타임스탬프 포함 응답 |
| **녹음** | expo-av (기존) | 섀도잉 구간 녹음 후 비교 재생 |
| **애니메이션** | react-native-reanimated (기존) | 완료 애니메이션, 마이크 pulse |

## 디렉토리 구조 (신규)

```
mobile-app/
├── app/
│   ├── (tabs)/
│   │   └── shadowing.tsx          ← 콘텐츠 목록 탭 (신설)
│   └── shadowing/
│       └── [id].tsx               ← 섀도잉 플레이어 화면
└── components/
    └── shadowing/
        ├── ContentCard.tsx        ← 목록 카드
        ├── VideoPlayer.tsx        ← expo-video 래퍼
        ├── ScriptArea.tsx         ← 하이라이트 자동스크롤
        ├── ModeTab.tsx            ← 1문장/3문장/전체 탭
        └── ControlBar.tsx        ← 하단 컨트롤 바

ai-server/
└── routes/
    └── shadowing.js               ← 섀도잉 전용 라우터
```

## 개발 워크플로우

1. **Phase 1 → Phase 2 → Phase 3** 순서로 진행. 각 Task 완료 후 ✅ 표시
2. **데이터 우선**: DB + API → 화면 → 인터랙션 순서로 구현하여 더미 없이 실데이터로 개발
3. **테스트**: Task 028 API 완료 후 Jest + Supertest로 엔드포인트 검증 필수
4. **콘텐츠 준비**: Task 027에서 Whisper 추출 도구 완성 후 실제 영상 데이터 삽입

---

## 개발 단계

### Phase 1: 백엔드 기반 구축

---

#### Task 025: DB 마이그레이션 — 섀도잉 테이블 3개 생성 `[Playwright MCP]`

**대상 파일:** Supabase SQL Editor (마이그레이션 실행)

**구현 사항:**
- [ ] `shadowing_contents` 테이블 생성 (id, title, description, video_url, thumbnail_url, duration, level, category, is_published, created_at)
- [ ] `shadowing_scripts` 테이블 생성 (id, content_id FK, sentence_index, start_time, end_time, text, translation)
- [ ] `shadowing_sessions` 테이블 생성 (id, user_id FK, content_id FK, completed, created_at)
- [ ] 인덱스 생성 (`idx_shadowing_scripts_content`, `idx_shadowing_sessions_user`)
- [ ] RLS 정책 설정 (contents/scripts: 인증 사용자 SELECT, sessions: 본인 데이터만 INSERT/SELECT)

**스키마 상세:**
```sql
CREATE TABLE shadowing_contents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  description   text,
  video_url     text NOT NULL,
  thumbnail_url text,
  duration      numeric NOT NULL,
  level         text DEFAULT 'medium' CHECK (level IN ('easy', 'medium', 'hard')),
  category      text DEFAULT 'speech' CHECK (category IN ('movie', 'speech', 'ted')),
  is_published  boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE shadowing_scripts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id     uuid REFERENCES shadowing_contents(id) ON DELETE CASCADE,
  sentence_index integer NOT NULL,
  start_time     numeric NOT NULL,
  end_time       numeric NOT NULL,
  text           text NOT NULL,
  translation    text
);

CREATE TABLE shadowing_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE,
  content_id    uuid REFERENCES shadowing_contents(id),
  completed     boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_shadowing_scripts_content ON shadowing_scripts(content_id, sentence_index);
CREATE INDEX idx_shadowing_sessions_user   ON shadowing_sessions(user_id, created_at);
```

**완료 기준:** Supabase 대시보드에서 3개 테이블이 정상 생성되고 RLS가 활성화된 상태

---

#### Task 026: Whisper 타임스탬프 추출 API 구현 `[contexttalk-api-architect]`

**대상 파일:** `ai-server/routes/shadowing.js` (신규), `ai-server/index.js` (라우터 등록)

**구현 사항:**
- [x] `ai-server/routes/shadowing.js` 파일 생성, Express Router 초기화
- [x] `POST /api/shadowing/transcribe` 엔드포인트 구현
  - multer로 오디오 파일 수신 (mp3/m4a/wav, 최대 25MB)
  - OpenAI Whisper `verbose_json` + `response_format: 'verbose_json'` + `timestamp_granularities: ['segment']` 호출
  - 응답에서 `segments` 배열 추출 → `{ index, start, end, text }` 배열로 변환하여 반환
- [x] 관리자 전용 — JWT 검증 후 Supabase에서 사용자 role 확인 (또는 별도 admin 시크릿 헤더)
- [x] `ai-server/index.js`에 `app.use('/api/shadowing', shadowingRouter)` 등록

**응답 형태:**
```json
{
  "segments": [
    { "index": 0, "start": 0.0, "end": 3.5, "text": "Here's to the crazy ones." },
    { "index": 1, "start": 3.8, "end": 7.2, "text": "The misfits. The rebels." }
  ]
}
```

**완료 기준:** 오디오 파일 POST 시 타임스탬프 포함 segments 배열 반환 확인

---

#### Task 027: 테스트 콘텐츠 데이터 삽입 `[Playwright MCP]`

**대상:** Supabase SQL Editor 또는 Storage 업로드

**구현 사항:**
- [x] 테스트용 영상 1개 선정 (1~2분 이내, 명확한 발음) — Steve Jobs Stanford 2005 연설
- [x] 영상 파일을 Supabase Storage `shadowing-videos` 버킷에 업로드 (video_url: PENDING_VIDEO_URL, 실제 업로드 후 갱신 필요)
- [x] Task 026 Whisper API로 오디오 추출 → 타임스탬프 확인 (수동 산정 타임스탬프 적용)
- [x] 한국어 번역 직접 작성 후 `shadowing_scripts`에 INSERT (15문장)
- [x] `shadowing_contents`에 콘텐츠 메타데이터 INSERT, `is_published = true` 설정

**완료 기준:** Supabase에서 콘텐츠 1개 + 스크립트 10개 이상 조회 가능

---

#### Task 028: 콘텐츠 목록 및 상세 API 구현 `[contexttalk-api-architect]` `[api-test-writer]`

**대상 파일:** `ai-server/routes/shadowing.js`

**구현 사항:**
- [x] `GET /api/shadowing/contents` — JWT 인증, `is_published=true` 콘텐츠 목록 반환 (id, title, description, thumbnail_url, duration, level, category)
- [x] `GET /api/shadowing/contents/:id` — 콘텐츠 상세 + 스크립트 전체 반환 (sentence_index ASC 정렬)
- [x] `POST /api/shadowing/sessions` — JWT 인증, user_id + content_id + completed boolean 저장
- [x] 에러 응답 표준화 (기존 `errorResponse.js` 유틸 사용)
- [x] Jest + Supertest로 3개 엔드포인트 기본 테스트 작성 (`ai-server/__tests__/shadowing.test.js`)

**응답 형태 (`GET /api/shadowing/contents/:id`):**
```json
{
  "content": {
    "id": "uuid",
    "title": "Steve Jobs - Stay Hungry Stay Foolish",
    "video_url": "https://...",
    "duration": 87
  },
  "scripts": [
    { "index": 0, "start": 0.0, "end": 3.5, "text": "...", "translation": "..." }
  ]
}
```

**완료 기준:** `npx jest shadowing.test.js` 전체 통과

---

### Phase 2: 프론트엔드 기반 구축

---

#### Task 029: Zustand shadowing 슬라이스 + TypeScript 타입 정의 `[rn-expo-frontend]`

**대상 파일:**
- `mobile-app/store/useAppStore.ts` (슬라이스 추가)
- `mobile-app/types/shadowing.ts` (신규)

**구현 사항:**
- [x] `mobile-app/types/shadowing.ts` 생성
  ```typescript
  export type ShadowingMode = '1' | '3' | 'full';
  export type BlindMode = 0 | 1 | 2;

  export type ShadowingContent = {
    id: string; title: string; description: string | null;
    video_url: string; thumbnail_url: string | null;
    duration: number; level: 'easy' | 'medium' | 'hard';
    category: 'movie' | 'speech' | 'ted';
  };

  export type ShadowingScript = {
    index: number; start: number; end: number;
    text: string; translation: string | null;
  };
  ```
- [x] `useAppStore.ts`에 shadowing 슬라이스 추가
  ```typescript
  // shadowing slice
  shadowingMode: ShadowingMode
  isLooping: boolean
  blindMode: BlindMode       // 0=전체, 1=한국어숨김, 2=영어숨김
  playbackRate: 0.75 | 1.0
  currentSentenceIndex: number
  isRecording: boolean
  setShadowingMode: (mode: ShadowingMode) => void
  setIsLooping: (v: boolean) => void
  setBlindMode: (v: BlindMode) => void
  setPlaybackRate: (v: 0.75 | 1.0) => void
  setCurrentSentenceIndex: (i: number) => void
  setIsRecording: (v: boolean) => void
  resetShadowingState: () => void
  ```

**완료 기준:** TypeScript 컴파일 오류 없음, 슬라이스 import 가능

---

#### Task 030: 섀도잉 탭 신설 + ContentCard + 목록 화면 `[rn-expo-frontend]`

**대상 파일:**
- `mobile-app/app/(tabs)/_layout.tsx` (탭 추가)
- `mobile-app/app/(tabs)/shadowing.tsx` (신규)
- `mobile-app/components/shadowing/ContentCard.tsx` (신규)
- `mobile-app/api/shadowing.ts` (신규 — API 호출 함수)

**구현 사항:**
- [x] `mobile-app/api/shadowing.ts` 생성 — `fetchContents()`, `fetchContentDetail(id)`, `saveSession()` 함수 (PREVIEW_MODE 더미 데이터 포함)
- [x] `ContentCard.tsx` 구현 — 썸네일, 제목, 레벨 뱃지, 재생 시간 표시. NativeWind 스타일, 순백색 배경
- [x] `app/(tabs)/shadowing.tsx` 구현 — FlatList로 콘텐츠 목록, 로딩 상태, 빈 목록 처리
- [x] `(tabs)/_layout.tsx`에 shadowing 탭 추가
- [x] 카드 탭 시 `router.push('/shadowing/[id]')` 이동

**완료 기준:** 탭에서 콘텐츠 목록 카드 렌더링 확인, 탭 이동 정상 동작

---

#### Task 031: 섀도잉 플레이어 기본 틀 + VideoPlayer 컴포넌트 `[rn-expo-frontend]`

**대상 파일:**
- `mobile-app/app/shadowing/[id].tsx` (신규)
- `mobile-app/components/shadowing/VideoPlayer.tsx` (신규)

**전제 조건 (구현 전 필수):**
- [x] Supabase Storage `shadowing-videos` 버킷 생성 (Public ON)
- [x] Steve Jobs Stanford 클립 영상 업로드 (`jobs_stanford_clip.mp4`)
- [x] `shadowing_contents.video_url` 갱신 — SQL Editor에서 실행:
  ```sql
  UPDATE shadowing_contents
  SET video_url = 'https://brjvyzdeyszfhgttybzn.supabase.co/storage/v1/object/public/shadowing-videos/jobs_stanford_clip.mp4'
  WHERE id = 'fea2383e-d8c4-4ac3-b7f9-27eee481c264';
  ```
  > 영상 파일 준비: `yt-dlp --download-sections "*0-105" -f mp4 -o jobs_stanford_clip.mp4 "https://www.youtube.com/watch?v=UF8uR6Z6KLc"`

**구현 사항:**
- [x] `VideoPlayer.tsx` 구현
  - `expo-video` `useVideoPlayer` 훅 사용
  - `VideoView` 16:9 비율 full-width 렌더링
  - progress bar (thin, cobalt blue) — `player.currentTime / duration`으로 계산
  - `playbackRate` prop 반영 (`player.playbackRate`)
  - `onTimeUpdate` 콜백 노출 (부모에서 타임스탬프 감지용)
  - 웹 플랫폼 미지원 처리 (런타임 조건부 import, placeholder 렌더링)
  - `useImperativeHandle`로 `pause / play / seek` 외부 제어 핸들 노출
- [x] `app/shadowing/[id].tsx` 구현
  - 화면 진입 시 `fetchContentDetail(id)` 호출, 스크립트 로드
  - VideoPlayer + ModeTab + ScriptArea + ControlBar 레이아웃 배치 (컴포넌트는 다음 Task에서 구현, 우선 placeholder)
  - 화면 이탈 시 `resetShadowingState()` 호출

**완료 기준:** 영상이 화면에서 정상 재생되고 progress bar가 실시간 업데이트됨

---

#### Task 032: ScriptArea + ModeTab 컴포넌트 `[rn-expo-frontend]`

**대상 파일:**
- `mobile-app/components/shadowing/ScriptArea.tsx` (신규)
- `mobile-app/components/shadowing/ModeTab.tsx` (신규)

**구현 사항:**
- [x] `ModeTab.tsx` 구현 — 알약(pill) 모양 세그먼트 컨트롤, `['1문장', '3문장', '전체']` 탭, 활성 탭 cobalt blue (`bg-blue-500`), 비활성 회색
- [x] `ScriptArea.tsx` 구현
  - `scripts`, `currentIndex`, `blindMode` prop 수신
  - 현재 문장: `text-xl font-bold text-gray-900`
  - 나머지 문장: `opacity-30`
  - 한국어 번역: `text-sm text-gray-400` (blindMode >= 1이면 숨김)
  - 영어 스크립트: blindMode === 2이면 `opacity-0`
  - `ScrollView` + `onLayout` yPositions 배열로 현재 문장 자동 스크롤 (screenHeight/4 오프셋)
- [x] `[id].tsx`에 실제 ModeTab, ScriptArea 연결

**완료 기준:** 모드 탭 전환 시 UI 변경 확인, 문장 인덱스 변경 시 스크롤 이동 확인

---

### Phase 3: 핵심 인터랙션 + 완성

---

#### Task 033: Auto-pause + 루프 + 전체 모드 자동 스크롤 (핵심) `[rn-expo-frontend]`

**대상 파일:** `mobile-app/app/shadowing/[id].tsx`, `mobile-app/components/shadowing/VideoPlayer.tsx`

**구현 사항:**
- [x] `onTimeUpdate` 콜백에서 현재 position으로 `currentSentenceIndex` 업데이트 로직 구현
  ```typescript
  const currentScript = scripts.find(s => position >= s.start && position < s.end);
  if (currentScript) setCurrentSentenceIndex(currentScript.index);
  ```
- [x] **1문장 모드**: position이 현재 문장 `end_time` 초과 시 `player.pause()` 자동 실행
- [x] **3문장 모드**: 3문장 블록 단위 계산 (index를 3으로 나눈 몫으로 블록 결정), 블록 마지막 문장 end_time 초과 시 pause
- [x] **전체 모드**: pause 없이 스크립트만 자동 스크롤
- [x] **루프 기능**: `isLooping=true`이고 position >= 현재 문장 end_time → `player.seek(start_time)`
- [x] 루프 ON 시 Auto-pause 비활성화 (루프가 우선)
- [x] `isPausedRef` 플래그로 auto-pause 중복 실행 방지 (모드 변경 시 자동 리셋)
- [x] `scriptsRef`, `shadowingModeRef`, `isLoopingRef`로 stale closure 방지

**완료 기준:** 1문장 모드에서 문장 끝마다 자동 정지 확인, 루프 ON 시 해당 문장만 반복 확인

---

#### Task 034: ControlBar — 보조 기능 전체 구현 `[rn-expo-frontend]`

**대상 파일:** `mobile-app/components/shadowing/ControlBar.tsx` (신규)

**구현 사항:**
- [x] `ControlBar.tsx` 구현 — 아이콘 5개 배치 (좌2 / 중앙 마이크 / 우2)
  - 좌측: 🐢 속도 토글 (1.0x ↔ 0.75x) / 👁 블라인드 모드 순환 (0→1→2→0)
  - 우측: 📄 전체 스크립트 버튼 (Toast "준비 중" — BottomSheet는 미구현) / 🔁 루프 토글
  - 중앙: 마이크 버튼 (크고 둥근 cobalt blue 원형, `isRecording` 상태 시 red pulse)
- [x] 속도 토글 시 `setPlaybackRate()` + `player.playbackRate` 동기화
- [x] 블라인드 모드 토글 시 `setBlindMode((prev + 1) % 3)` 순환
- [x] 루프 토글 시 `setIsLooping(!isLooping)` + 활성 아이콘 cobalt blue 표시
- [x] 마이크 버튼 Reanimated pulse 애니메이션 (`isRecording` 시 scale 1→1.15→1 반복, 웹 스킵)
- [ ] 📄 전체 스크립트 BottomSheet 구현 (현재 Toast로 대체 중 — Task 036에서 완성)

**완료 기준:** 각 버튼 탭 시 상태 변경 및 UI 반영 확인

---

#### Task 035: 녹음 → 비교 재생 (마이크 기능) `[rn-expo-frontend]`

**대상 파일:** `mobile-app/app/shadowing/[id].tsx`, `mobile-app/components/shadowing/ControlBar.tsx`

> ⚠️ **expo-video seek 주의사항**: `expo-video`의 seek은 Promise를 반환하지 않음 (`expo-av`의 `setPositionAsync`와 다름).
> seek 완료를 `await`로 기다릴 수 없으므로, `onTimeUpdate` 콜백에서 목표 위치 도달을 감지한 후 내 녹음을 재생하는 방식으로 구현.

**구현 사항:**
- [ ] 마이크 버튼 탭 → `expo-av Audio.Recording` 시작, `setIsRecording(true)`
  ```typescript
  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync({
    android: {
      extension: '.m4a',
      outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
      audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
    },
    ios: { extension: '.m4a' },
  });
  await recording.startAsync();
  ```
- [ ] 다시 탭 → 녹음 중지, m4a 임시 URI 저장, `setIsRecording(false)`
- [ ] 비교 재생 시퀀스 — **seek 비동기 처리 방식**:
  1. `isPendingCompareRef = true` 플래그 설정 + `pendingRecordingUriRef`에 URI 저장
  2. `videoRef.current?.seek(script.start)` + `play()` 호출
  3. `handleTimeUpdate`에서 `currentTime >= script.end` 도달 감지 시 영상 pause
  4. `setTimeout(300ms)` 후 `expo-av Sound`로 내 녹음 재생 (버퍼링 여유)
  5. 재생 완료 콜백에서 `Sound.unloadAsync()` + `FileSystem.deleteAsync()` 임시 파일 삭제
- [ ] 비교 재생 중 auto-pause/루프 플래그 충돌 방지 (`isPendingCompareRef` 활성화 중에는 auto-pause 스킵)
- [ ] 화면 이탈 시 cleanup: `recordingRef.current.stopAndUnloadAsync()` + `resetShadowingState()`

**완료 기준:** 마이크 탭 → 녹음 → 원어민 구간 재생 → 300ms 후 내 목소리 재생 → 임시 파일 삭제 시퀀스 전체 동작 확인

---

#### Task 036: 완료 처리 + 세션 저장 + UI 폴리싱 `[rn-expo-frontend]` `[contexttalk-code-auditor]`

**대상 파일:**
- `mobile-app/app/shadowing/[id].tsx`
- `mobile-app/components/shadowing/` (각 컴포넌트 마무리)

**구현 사항:**
- [ ] 전체 모드에서 마지막 문장 재생 완료 감지 (position >= 마지막 scripts.end_time)
- [ ] 완료 시 Reanimated 애니메이션 — "완주했어요! 🎉" 오버레이 scale+fade-in
- [ ] `POST /api/shadowing/sessions` 호출 — `{ content_id, completed: true }` 저장
- [ ] 콘텐츠 목록 화면(`shadowing.tsx`)에서 완료 영상에 완료 뱃지 표시 (sessions 조회)
- [ ] 전체 화면 NativeWind 스타일 폴리싱 (여백, 폰트 크기, 색상 일관성 검토)
- [ ] 화면 전환 애니메이션 (목록 → 플레이어 fade/slide)
- [ ] 엣지 케이스 처리: 네트워크 오류 시 Toast, 영상 로드 실패 시 재시도 버튼

**완료 기준:** 전체 모드 완주 → 완료 애니메이션 → DB 세션 저장 → 목록 뱃지 표시 전체 플로우 동작

---

## Phase 4: 퀴즈 기능

> "저장한 표현으로 실력을 직접 확인하는 자기 채점 퀴즈"

---

#### Task 037: DB 마이그레이션 — 퀴즈 테이블 2개 생성 `[Playwright MCP]`

**대상 파일:** Supabase SQL Editor (마이그레이션 실행)

**구현 사항:**
- [ ] `quiz_sessions` 테이블 생성 (id, user_id FK, total_count, correct_count, created_at)
- [ ] `quiz_questions` 테이블 생성 (id, session_id FK, expression_id FK, expression_text snapshot, example_sentence_en, example_sentence_ko, highlight_text, order_index, is_correct)
- [ ] 인덱스 생성 (`idx_quiz_sessions_user`, `idx_quiz_questions_session`)
- [ ] RLS 정책 설정 (본인 데이터만 SELECT/INSERT/UPDATE)

**스키마 상세:**
```sql
CREATE TABLE quiz_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE,
  total_count   integer NOT NULL DEFAULT 10,
  correct_count integer,       -- NULL = 퀴즈 진행 중, 정수 = 완료
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE quiz_questions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           uuid REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  expression_id        uuid REFERENCES expressions(id),
  expression_text      text NOT NULL,     -- 표현 원문 snapshot
  example_sentence_en  text NOT NULL,
  example_sentence_ko  text NOT NULL,
  highlight_text       text NOT NULL,     -- example_sentence_ko의 부분문자열 (볼드 처리용)
  order_index          integer NOT NULL,
  is_correct           boolean            -- NULL=미응답, true=알았어, false=몰랐어
);

CREATE INDEX idx_quiz_sessions_user     ON quiz_sessions(user_id, created_at DESC);
CREATE INDEX idx_quiz_questions_session ON quiz_questions(session_id, order_index);

ALTER TABLE quiz_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;

-- quiz_sessions RLS
CREATE POLICY "quiz_sessions_select_own" ON quiz_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "quiz_sessions_insert_own" ON quiz_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "quiz_sessions_update_own" ON quiz_sessions FOR UPDATE USING (auth.uid() = user_id);

-- quiz_questions RLS (세션 소유자 조인 확인)
CREATE POLICY "quiz_questions_select_own" ON quiz_questions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM quiz_sessions qs WHERE qs.id = quiz_questions.session_id AND qs.user_id = auth.uid())
  );
CREATE POLICY "quiz_questions_insert_own" ON quiz_questions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM quiz_sessions qs WHERE qs.id = quiz_questions.session_id AND qs.user_id = auth.uid())
  );
CREATE POLICY "quiz_questions_update_own" ON quiz_questions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM quiz_sessions qs WHERE qs.id = quiz_questions.session_id AND qs.user_id = auth.uid())
  );
```

> `ai-server`는 `SUPABASE_SERVICE_ROLE_KEY`로 RLS 우회. RLS는 클라이언트 직접 접근 방어용.

**완료 기준:** Supabase 대시보드에서 2개 테이블 생성 확인, RLS 활성화 상태 확인

---

#### Task 038: Quiz API 4개 구현 `[contexttalk-api-architect]`

**대상 파일:**
- `ai-server/routes/quiz.js` (신규)
- `ai-server/index.js` (라우터 등록 1줄 추가)

**구현 사항:**
- [ ] `ai-server/routes/quiz.js` 생성, `'use strict'` + Express Router 초기화
- [ ] **`POST /api/quiz/generate`** 구현
  - `authMiddleware` 적용
  - Supabase에서 본인 `expressions` 전체 조회 (`.eq('user_id', req.user.id).select('id, expression_text')`)
  - 10개 미만이면 `errorResponse(res, 422, 'NOT_ENOUGH_EXPRESSIONS', '퀴즈를 생성하려면 표현이 10개 이상 필요합니다')` 반환
  - Fisher-Yates 셔플 후 랜덤 10개 선택
  - GPT-4o-mini JSON mode 호출 → `{ "questions": [...] }` 형태로 응답받기 (최상위 배열 직접 반환 불가)
  - 파싱 실패 시 최대 3회 retry (conversations.js 패턴 동일)
  - `quiz_sessions` INSERT → `quiz_questions` 10개 INSERT
  - 201 응답: `{ session: { id, created_at }, questions: [...] }`
- [ ] **`GET /api/quiz/sessions`** 구현
  - `authMiddleware` 적용
  - `quiz_sessions` 조회 (created_at DESC)
  - 200 응답: 세션 배열
- [ ] **`GET /api/quiz/sessions/:id`** 구현
  - `authMiddleware` 적용
  - 세션 + 문제 전체 조회 (order_index ASC)
  - 세션 없거나 타인 세션이면 404 NOT_FOUND
  - 200 응답: `{ session: {...}, questions: [...] }`
- [ ] **`PATCH /api/quiz/sessions/:id`** 구현
  - `authMiddleware` 적용
  - body: `{ correct_count: number }` (0~10 정수 유효성 검사)
  - 업데이트 후 영향 행 없으면 404 NOT_FOUND
  - 200 응답: `{ success: true }`
- [ ] `ai-server/index.js`에 `app.use('/api/quiz', require('./routes/quiz'))` 추가

**GPT 프롬프트 구조:**
```javascript
// system: JSON mode, { "questions": [...] } 형태로 반환 지시
// user: 표현 목록 (numbered list)
// 각 항목: { expression_text, example_sentence_en, example_sentence_ko, highlight_text }
// highlight_text 규칙: example_sentence_ko의 정확한 부분문자열이어야 함
// temperature: 0.7
```

**에러 코드:**

| 코드 | HTTP | 설명 |
|------|------|------|
| `NOT_ENOUGH_EXPRESSIONS` | 422 | 저장 표현 10개 미만 |
| `QUIZ_GENERATION_FAILED` | 502 | GPT 호출 실패 또는 JSON 파싱 3회 실패 |
| `NOT_FOUND` | 404 | 세션 없음 또는 타인 세션 |
| `INVALID_REQUEST` | 400 | correct_count 범위 오류 |
| `INTERNAL_ERROR` | 500 | Supabase 오류 |

**완료 기준:** 4개 엔드포인트 수동 테스트 통과 (200/201/404/422 응답 확인)

---

#### Task 039: Quiz API Jest 테스트 `[api-test-writer]`

**대상 파일:** `ai-server/__tests__/quiz.test.js` (신규)

**구현 사항:**
- [ ] `jest.mock('openai')`, `jest.mock('../utils/supabase')`, `jest.mock('../middleware/auth')` 선언
- [ ] `authMiddleware` mock → `req.user = { id: 'user-123' }` 주입
- [ ] Supabase 체인 mock, `beforeEach(() => jest.resetAllMocks())` 설정
- [ ] GPT `mockChatCreate` — `{ questions: [...10개...] }` 정상 응답 + 파싱 실패 응답 분기

**테스트 케이스 9개:**

| # | 엔드포인트 | 시나리오 | 기대값 |
|---|-----------|---------|-------|
| 1 | `POST /generate` | 표현 10개 이상 → 정상 생성 | 201, `questions.length === 10` |
| 2 | `POST /generate` | 표현 9개 → 부족 | 422, `NOT_ENOUGH_EXPRESSIONS` |
| 3 | `POST /generate` | GPT 3회 파싱 실패 | 502, `QUIZ_GENERATION_FAILED` |
| 4 | `GET /sessions` | 세션 목록 조회 | 200, 배열 반환 |
| 5 | `GET /sessions/:id` | 유효 세션 ID | 200, `{ session, questions }` |
| 6 | `GET /sessions/:id` | 없는 세션 ID | 404, `NOT_FOUND` |
| 7 | `PATCH /sessions/:id` | correct_count: 7 | 200, `{ success: true }` |
| 8 | `PATCH /sessions/:id` | correct_count: 11 (범위 초과) | 400, `INVALID_REQUEST` |
| 9 | `PATCH /sessions/:id` | 타인 세션 | 404, `NOT_FOUND` |

**완료 기준:** `npx jest quiz.test.js` 9개 전체 통과

---

#### Task 040: TypeScript 타입 정의 + API 호출 함수 `[rn-expo-frontend]`

**대상 파일:**
- `mobile-app/types/quiz.ts` (신규)
- `mobile-app/api/quiz.ts` (신규)

**구현 사항:**

`mobile-app/types/quiz.ts`:
- [ ] `QuizQuestion` 타입 (id, session_id, expression_id, expression_text, example_sentence_en, example_sentence_ko, highlight_text, order_index, is_correct: boolean | null)
- [ ] `QuizSession` 타입 (id, user_id, total_count, correct_count: number | null, created_at)
- [ ] `GenerateQuizResponse` 타입 `{ session: QuizSession; questions: QuizQuestion[] }`
- [ ] `QuizSessionDetail` 타입 `{ session: QuizSession; questions: QuizQuestion[] }`

`mobile-app/api/quiz.ts`:
- [ ] `generateQuiz(): Promise<GenerateQuizResponse>` — `POST /api/quiz/generate`
- [ ] `fetchQuizSessions(): Promise<QuizSession[]>` — `GET /api/quiz/sessions`
- [ ] `fetchQuizSessionDetail(sessionId: string): Promise<QuizSessionDetail>` — `GET /api/quiz/sessions/:id`
- [ ] `submitQuizResult(sessionId: string, correctCount: number): Promise<void>` — `PATCH /api/quiz/sessions/:id`
- [ ] 기존 `chat.ts` / `shadowing.ts`와 동일한 에러 핸들링 패턴 적용

**완료 기준:** TypeScript 컴파일 오류 없음, `@/api/quiz` import 가능

---

#### Task 041: 퀴즈 메인 탭 화면 `[rn-expo-frontend]`

**대상 파일:** `mobile-app/app/(tabs)/quiz.tsx` (전면 교체)

**의존성:** Task 040

**구현 사항:**
- [ ] 기존 "준비 중" 껍데기 전체 교체
- [ ] `useEffect`에서 `fetchQuizSessions()` 호출 → `sessions` state
- [ ] **[퀴즈 생성!] 버튼**
  - `isGenerating` state로 로딩 중 비활성화 + `ActivityIndicator`
  - 성공 → `router.push('/quiz/[sessionId]')`
  - 422 `NOT_ENOUGH_EXPRESSIONS` → 인라인 안내 메시지 표시 ("퀴즈를 시작하려면 표현이 10개 이상 필요해요")
  - 그 외 오류 → `showToast`
- [ ] **퀴즈 내역 FlatList** (`QuizSessionCard` 렌더링)
  - 탭 시 `router.push('/quiz/result/[sessionId]')`
  - `correct_count === null` → "진행 중" 배지
- [ ] **Empty State**: 세션 없을 때 "아직 퀴즈 기록이 없어요" 안내

**UI 레이아웃:**
```
┌──────────────────────────────┐
│  퀴즈               (pt-14)  │
│  저장한 표현으로 실력 확인    │
├──────────────────────────────┤
│  [ 🎯 퀴즈 생성! ]  (mx-4)  │
├──────────────────────────────┤
│  이전 퀴즈 기록               │
│  ┌──────────────────────┐   │
│  │ 2026.03.30  8/10  > │   │  ← QuizSessionCard
│  └──────────────────────┘   │
└──────────────────────────────┘
```

**완료 기준:** 탭 진입 시 내역 목록 렌더링, 생성 버튼 탭 후 로딩 → 퀴즈 화면 이동

---

#### Task 042: QuizSessionCard 컴포넌트 `[rn-expo-frontend]`

**대상 파일:** `mobile-app/components/quiz/QuizSessionCard.tsx` (신규)

**의존성:** Task 040

**구현 사항:**
- [ ] Props: `session: QuizSession`, `onPress: () => void`
- [ ] 날짜 포맷: `YYYY.MM.DD`
- [ ] 점수 색상 분기:
  - 8~10 → `text-emerald-600`
  - 5~7 → `text-amber-500`
  - 0~4 → `text-red-500`
  - null → "진행 중" 회색 배지
- [ ] chevron-forward 아이콘 (Ionicons), `active:opacity-70` 터치 피드백

**완료 기준:** 날짜/점수 정상 표시, 색상 분기 동작 확인

---

#### Task 043: QuizQuestion 컴포넌트 — highlight_text 볼드 렌더링 `[rn-expo-frontend]`

**대상 파일:** `mobile-app/components/quiz/QuizQuestion.tsx` (신규)

**의존성:** Task 040

**구현 사항:**
- [ ] Props: `question: QuizQuestion`, `isAnswerRevealed: boolean`
- [ ] **한글 예문 렌더링** (항상 표시):
  - `example_sentence_ko.indexOf(highlight_text)`로 위치 찾기
  - React Native `<Text>` 내부 `<Text>` 중첩으로 인라인 볼드 구현:
    ```typescript
    <Text>{before}<Text className="font-bold text-gray-900">{highlight}</Text>{after}</Text>
    ```
  - `indexOf === -1`이면 예문 전체를 일반 텍스트로 표시 (방어 처리)
- [ ] **답 공개 영역** (`isAnswerRevealed === true` 일 때만):
  - `expression_text` — 큰 폰트, indigo 강조 (`text-indigo-600 text-xl font-bold`)
  - `example_sentence_en` — 보통 크기, 회색
  - 구분선 위에 표시

**완료 기준:** highlight_text 볼드 정상, isAnswerRevealed 토글 시 답 영역 표시/숨김 확인

---

#### Task 044: 퀴즈 플레이어 화면 `[rn-expo-frontend]`

**대상 파일:** `mobile-app/app/quiz/[sessionId].tsx` (신규)

**의존성:** Task 040, 041, 042, 043

**구현 사항:**
- [ ] `useLocalSearchParams<{ sessionId: string }>()`로 세션 ID 수신
- [ ] `useEffect`에서 `fetchQuizSessionDetail(sessionId)` 호출
- [ ] **로컬 state:**
  ```typescript
  questions: QuizQuestion[]
  currentIndex: number        // 0-based
  isAnswerRevealed: boolean
  answers: (boolean | null)[] // 각 문제 채점 결과
  phase: 'playing' | 'result'
  isSubmitting: boolean
  ```
- [ ] **상단 진행률 바**: `currentIndex / questions.length` 비율 (인라인 style width)
- [ ] **`QuizQuestion` 컴포넌트** 렌더링
- [ ] **[답 확인] 버튼**: `isAnswerRevealed === false` → 탭 시 `setIsAnswerRevealed(true)`
- [ ] **[알았어 👍] / [몰랐어 👎] 버튼**: `isAnswerRevealed === true` → 탭 시:
  - `setAnswers([...answers, bool])`
  - 마지막 문제가 아니면: `setCurrentIndex(i+1)` + `setIsAnswerRevealed(false)`
  - 마지막 문제이면: `correctCount` 계산 → `submitQuizResult()` → `setPhase('result')`
- [ ] **결과 화면 인라인** (`phase === 'result'`): `QuizResultSummary` 컴포넌트 렌더링
- [ ] 헤더: 뒤로가기 + "퀴즈" + 진행률 텍스트 (`3 / 10`)

**플로우:**
```
진입 → 로딩 → 한글 예문 표시 (highlight 볼드)
  → [답 확인] → 영어 표현 + 예문 공개
  → [알았어👍 / 몰랐어👎] → 다음 문제
  → (10번 반복 후) → submitQuizResult() → 결과 화면
```

**완료 기준:** 10문제 순차 진행, PATCH API 호출 확인, 결과 화면 전환 확인

---

#### Task 045: QuizResultSummary 컴포넌트 + 결과 상세 화면 `[rn-expo-frontend]`

**대상 파일:**
- `mobile-app/components/quiz/QuizResultSummary.tsx` (신규)
- `mobile-app/app/quiz/result/[sessionId].tsx` (신규)

**의존성:** Task 040, 044

**구현 사항:**

`QuizResultSummary.tsx`:
- [ ] Props: `correctCount: number`, `totalCount: number`, `onReturn: () => void`
- [ ] 점수별 이모지 + 메시지:
  - 9~10 → "🏆 완벽해요!" (emerald)
  - 7~8 → "🎉 잘했어요!" (blue)
  - 5~6 → "💪 조금만 더!" (amber)
  - 0~4 → "📚 더 연습해요" (red)
- [ ] 대형 점수 숫자 + [퀴즈 탭으로 돌아가기] 버튼

`app/quiz/result/[sessionId].tsx`:
- [ ] `fetchQuizSessionDetail(sessionId)` 호출
- [ ] 상단: `QuizResultSummary` 컴포넌트
- [ ] 하단 ScrollView: 전체 문제 목록
  - `is_correct === true` → ✅ (emerald)
  - `is_correct === false` → ❌ (red)
  - `is_correct === null` → ⬜ (미완료)
- [ ] 헤더: 뒤로가기 + "퀴즈 결과"

**완료 기준:** 퀴즈 내역 탭 시 결과 화면 정상 렌더링, 문제별 채점 아이콘 표시

---

#### Task 046: _layout.tsx 라우트 등록 + 전체 플로우 통합 검증 `[rn-expo-frontend]`

**대상 파일:** `mobile-app/app/_layout.tsx`

**의존성:** Task 044, 045

**구현 사항:**
- [ ] `<Stack.Screen name="quiz/[sessionId]" options={{ headerShown: false }} />` 추가
- [ ] `<Stack.Screen name="quiz/result/[sessionId]" options={{ headerShown: false }} />` 추가

**통합 체크리스트:**
- [ ] Quiz 탭 진입 → 내역 목록 / 빈 상태 정상 표시
- [ ] 표현 10개 미만 → 안내 메시지 표시 (생성 불가)
- [ ] [퀴즈 생성!] → 로딩 → 퀴즈 화면 이동
- [ ] 10문제 순차 진행 → 결과 화면 전환
- [ ] [퀴즈 탭으로 돌아가기] → Quiz 탭 복귀 + 새 세션 목록 상단 표시
- [ ] 과거 내역 탭 → 결과 상세 화면 → 뒤로가기 → Quiz 탭 복귀

**완료 기준:** 위 체크리스트 전항목 수동 테스트 통과

---

## Task 의존성 (퀴즈)

```
Task 037 (DB)
  └── Task 038 (Quiz API)
        ├── Task 039 (Jest 테스트) ← mock 기반, 병렬 가능
        └── Task 040 (타입 + API 함수)
              ├── Task 041 (퀴즈 메인 탭)
              ├── Task 042 (QuizSessionCard)
              └── Task 043 (QuizQuestion 컴포넌트)
                    └── Task 044 (퀴즈 플레이어 화면)
                          └── Task 045 (결과 컴포넌트 + 결과 화면)
                                └── Task 046 (라우트 등록 + 통합 검증)
```

---

## 진행 현황

| Task | 설명 | 에이전트 | 상태 |
|------|------|----------|------|
| Task 025 | DB 마이그레이션 (shadowing 테이블 3개) | Playwright MCP | ✅ 완료 |
| Task 026 | Whisper 타임스탬프 추출 API | contexttalk-api-architect | ✅ 완료 |
| Task 027 | 테스트 콘텐츠 데이터 삽입 | Playwright MCP | ✅ 완료 |
| Task 028 | 콘텐츠 목록/상세/세션 API | contexttalk-api-architect + api-test-writer | ✅ 완료 |
| Task 029 | Zustand 슬라이스 + 타입 정의 | rn-expo-frontend | ✅ 완료 |
| Task 030 | 섀도잉 탭 + ContentCard + 목록 화면 | rn-expo-frontend | ✅ 완료 |
| Task 031 | 플레이어 기본 틀 + VideoPlayer | rn-expo-frontend | ✅ 완료 |
| Task 032 | ScriptArea + ModeTab | rn-expo-frontend | ✅ 완료 |
| Task 033 | Auto-pause + 루프 + 자동 스크롤 | rn-expo-frontend | ✅ 완료 |
| Task 034 | ControlBar 보조 기능 전체 | rn-expo-frontend | ✅ 완료 |
| Task 035 | 녹음 → 비교 재생 | rn-expo-frontend | ✅ 완료 |
| Task 036 | 완료 처리 + 세션 저장 + 폴리싱 | rn-expo-frontend + contexttalk-code-auditor | ⬜ 대기 |
| Task 037 | DB 마이그레이션 (quiz 테이블 2개 + RLS) | Playwright MCP | ✅ 완료 |
| Task 038 | Quiz API 4개 구현 (generate / sessions / sessions/:id / PATCH) | contexttalk-api-architect | ✅ 완료 |
| Task 039 | Quiz API Jest 테스트 (9케이스) | api-test-writer | ✅ 완료 |
| Task 040 | TypeScript 타입 정의 + API 호출 함수 | rn-expo-frontend | ✅ 완료 |
| Task 041 | 퀴즈 메인 탭 화면 (생성 버튼 + 내역 목록) | rn-expo-frontend | ✅ 완료 |
| Task 042 | QuizSessionCard 컴포넌트 | rn-expo-frontend | ✅ 완료 |
| Task 043 | QuizQuestion 컴포넌트 (highlight 볼드 렌더링) | rn-expo-frontend | ✅ 완료 |
| Task 044 | 퀴즈 플레이어 화면 (한 문제씩 + 결과 인라인) | rn-expo-frontend | ✅ 완료 |
| Task 045 | QuizResultSummary + 결과 상세 화면 | rn-expo-frontend | ✅ 완료 |
| Task 046 | _layout.tsx 라우트 등록 + 전체 플로우 통합 검증 | rn-expo-frontend | ✅ 완료 |

### 버그 수정 이력 (Task 033 후속)

#### 🐛 ScriptArea 자동 스크롤 미동작 (2026-03-29 수정)

**문제 1 — `timeUpdate` 이벤트 미발화 (Android)**
- `VideoPlayer.tsx`: expo-video `player.addListener('timeUpdate', ...)` 이벤트가 Android 실기기에서 발화되지 않음
- **수정**: 이벤트 구독 제거 → `setInterval` 250ms 폴링으로 교체 (`player.currentTime` 직접 읽기)

**문제 2 — `setCurrentSentenceIndex` 미호출 (gap 구간)**
- `app/shadowing/[id].tsx`: `handleTimeUpdate`에서 정확한 구간 문장(`current`)이 없을 때 (`start <= time < end`를 만족하는 문장 없음) `setCurrentSentenceIndex`가 호출되지 않아 이전 인덱스에 고정
- **수정**: fallback 로직 추가 — `current`가 없으면 현재 시간 이후로 `start`가 가장 가까운 이전 문장 인덱스로 업데이트

#### 🔧 홈화면 Shadowing 버튼 활성화 (2026-03-29)
- `app/(tabs)/index.tsx`: `View` (비활성) → `Pressable` 로 교체, `opacity-50` 제거, `"Soon"` → `"Practice"`, `/(tabs)/shadowing` 탭 이동 연결

---

### 버그 수정 및 개선 이력 (2026-03-29 이후)

#### 🐛 Auto-pause 미동작 — 인덱스 전환 감지 방식으로 전면 교체

**문제:**
- `handleTimeUpdate`의 폴링 기반(`currentTime >= end`) auto-pause 로직이 gap 없는 영상(Jensen Huang)에서 동작하지 않음
- gap 구간에서 `seek()` 호출 시 Android에서 즉시 `playingChange` 이벤트 → 루프/pause 중복 실행 버그

**수정 (`app/shadowing/[id].tsx`):**
- `lastSentenceIndexRef = useRef(-1)` 추가
- `handleTimeUpdate`에서 정확한 문장(`current`) 안에 있을 때만 인덱스를 ref에 기록
- gap 구간은 ref를 건드리지 않고 스크롤(fallback)만 업데이트
- auto-pause: `current.index !== prevIndex` (새 문장 진입) 시점에만 pause — `seek()` 제거
- 루프: 다음 문장으로 넘어가는 순간 이전 문장 `start`로 seek + play

#### 🔧 문장 분리 기준 — 마침표(`./!/? `) 기반으로 통일

**문제:** 이전 Whisper segment 그대로 사용 → 짧은 구간 중간 단어 위치에서 끊김

**수정:**
- `ai-server/routes/shadowing.js` `POST /api/shadowing/transcribe`: segment 병합 로직 추가 — `.?!`로 끝나는 segment에서만 flush
- Jensen Huang DB 데이터 재생성 — 기존 `shadowing_scripts` 삭제 후 마침표 기반으로 재INSERT (8문장 → 6문장)

#### 🗑️ Steve Jobs 영상 삭제

- `shadowing_contents` 및 연관 `shadowing_scripts` 레코드 전체 삭제 (Supabase SQL Editor)
- Supabase Storage `shadowing-videos` 버킷의 영상 파일도 삭제
- 이유: 영상 sync 불일치 및 끊김 현상 해결 불가

#### ➕ 섀도잉 콘텐츠 추가 — `/add-shadowing` 자동화 파이프라인

**새 스크립트:** `scripts/add-shadowing.js`
**새 슬래시 커맨드:** `.claude/commands/add-shadowing.md`

파이프라인 흐름:
1. `yt-dlp` 전체 영상 다운로드 (480p)
2. `ffmpeg -ss/-to -movflags faststart` 구간 컷
3. Supabase Storage 업로드 → public URL 생성
4. OpenAI Whisper `verbose_json` 타임스탬프 추출 + 마침표 병합
5. `shadowing_contents` + `shadowing_scripts` DB 자동 삽입

추가된 콘텐츠:
- **Friends — Unagi (b1fedc75)**: `youtu.be/lkbr5qnYSUU` 0:35 ~ 2:35, medium, speech
- **Anne Hathaway — Harvard Speech (c993a787)**: `youtu.be/wZFblGM42Mw` 2:25 ~ 3:37, medium, speech

#### 🏠 홈화면 UI 개선

**Practice 카드 크기 확대** (`app/(tabs)/index.tsx`):
- 패딩 `p-4 → p-5`, 이모지 `text-2xl → text-3xl`, 제목 `text-xs → text-sm`

**Recent History 5개 제한 + See all 화면 신설**:
- `conversations.slice(0, 5)` 적용, `conversations.length > 5`일 때만 "See all" 노출
- `app/chat/history.tsx` 신규 생성 — 전체 대화 목록 + 상단 Back 헤더

#### 🗣️ Free Talking 직행 — 토픽 선택 화면 제거

**수정 (`app/(tabs)/index.tsx`):**
- `handleFABPress` 및 Free Talking 카드: 기존 `router.push('/chat/new')` (토픽 선택 화면) 제거
- `createConversation('free_talk', 'Free Talking')` 직접 호출 후 채팅방으로 바로 이동

#### 🐻 앱 아이콘 — BearMascot으로 교체

- Playwright로 BearMascot SVG를 1024×1024 PNG 렌더링
- `mobile-app/assets/images/icon.png` 및 Android adaptive 변형 이미지 교체
- 적용: 다음 EAS 빌드 시 반영

---

## AI 프리토킹 — 출시 전 개선 작업 계획

> `/clear` 후에도 컨텍스트 유지를 위해 기록. 코드 검증 기반 분석 결과 (2026-03-28)

### 🔴 1순위 — 출시 전 필수 수정

#### 작업 A: Supabase RPC `process_turn` 생성 (DB 트랜잭션 + 턴 레이스 + userMsgId 동시 해결)

**문제:**
- `conversations.js:177-210` — user INSERT → ai INSERT가 별개 쿼리 → ai INSERT 실패 시 고아 메시지 발생
- `turnLimit.js:16-22` — count 조회 후 INSERT 사이에 동시 요청 끼면 20턴 초과 가능
- `[id].tsx:142` — optimistic UI 턴의 `userMsgId: null` → 사용자 발화 저장 버튼 비활성화

**해결책: Supabase RPC 단일 함수로 세 문제를 동시 해결**

```sql
CREATE OR REPLACE FUNCTION process_turn(
  p_conversation_id uuid,
  p_user_id         uuid,
  p_text            text,
  p_feedback        jsonb,
  p_next_response   text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_today_start     timestamptz;
  v_turn_count      int;
  v_max_turn        int;
  v_user_msg_id     uuid;
  v_ai_msg_id       uuid;
BEGIN
  -- KST 오늘 자정 기준
  v_today_start := date_trunc('day', now() AT TIME ZONE 'Asia/Seoul')
                   AT TIME ZONE 'Asia/Seoul';

  -- 턴 카운트 (트랜잭션 내 원자적 조회)
  SELECT COUNT(*) INTO v_turn_count
  FROM messages
  WHERE user_id = p_user_id
    AND content_type = 'user_speech'
    AND created_at >= v_today_start;

  IF v_turn_count >= 20 THEN
    RETURN jsonb_build_object('error', 'TURN_LIMIT_EXCEEDED');
  END IF;

  -- 현재 최대 turn_number 조회
  SELECT COALESCE(MAX(turn_number), 0) INTO v_max_turn
  FROM messages WHERE conversation_id = p_conversation_id;

  -- user_speech INSERT
  INSERT INTO messages (conversation_id, turn_number, role, content_type, content, user_id)
  VALUES (p_conversation_id, v_max_turn + 1, 'user', 'user_speech',
          jsonb_build_object('text', p_text), p_user_id)
  RETURNING id INTO v_user_msg_id;

  -- ai_turn INSERT
  INSERT INTO messages (conversation_id, turn_number, role, content_type, content, user_id)
  VALUES (p_conversation_id, v_max_turn + 2, 'assistant', 'ai_turn',
          jsonb_build_object('feedback', p_feedback, 'next_response', p_next_response), p_user_id)
  RETURNING id INTO v_ai_msg_id;

  RETURN jsonb_build_object(
    'user_message_id', v_user_msg_id,
    'ai_message_id',   v_ai_msg_id,
    'turn_number',     v_max_turn + 2
  );
END;
$$;
```

**백엔드 변경 (`conversations.js`):**
- `turnLimitMiddleware` 제거 (RPC 내부에서 처리)
- `POST /:id/messages` — GPT 호출 후 `supabase.rpc('process_turn', {...})` 단일 호출로 교체
- 응답에 `user_message_id` 포함: `{ message_id, user_message_id, turn_number, content }`

**프론트엔드 변경 (`[id].tsx` + `api/chat.ts`):**
- `sendMessage` 응답 타입에 `user_message_id: string` 추가
- `fetchAIResponse`에서 받은 `user_message_id`로 optimistic 턴의 `userMsgId` 업데이트

---

#### 작업 B: Supabase RPC `get_conversations_with_turns` 생성 (N+1 쿼리 해결)

**문제:** `conversations.js:29-38` — 대화 목록 조회 시 conversation 개수만큼 개별 count 쿼리 발생

**해결책:**

```sql
CREATE OR REPLACE FUNCTION get_conversations_with_turns(p_user_id uuid)
RETURNS TABLE (
  id          uuid,
  topic_id    text,
  topic_label text,
  updated_at  timestamptz,
  created_at  timestamptz,
  turn_count  bigint
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT c.id, c.topic_id, c.topic_label, c.updated_at, c.created_at,
         COUNT(m.id) FILTER (WHERE m.content_type = 'user_speech') AS turn_count
  FROM conversations c
  LEFT JOIN messages m ON m.conversation_id = c.id
  WHERE c.user_id = p_user_id
  GROUP BY c.id
  ORDER BY c.updated_at DESC;
$$;
```

**백엔드 변경:** `GET /api/conversations` — `Promise.all` N+1 → `supabase.rpc('get_conversations_with_turns', { p_user_id })` 단일 호출

---

#### 작업 C: `buildPrompt.js` 동기 I/O 제거

**문제:** `buildPrompt.js:13-21` — 매 LLM 요청마다 `readFileSync` 2번 호출 → Node.js 이벤트 루프 블로킹

**해결책:** 모듈 로드 시점에 전체 프롬프트 파일을 Map에 프리로드

```javascript
// 모듈 상단 — 서버 구동 시 1회만 읽음
const promptCache = new Map();
const promptDir = path.join(__dirname, '../prompts');
const base = fs.readFileSync(path.join(promptDir, '_base.txt'), 'utf-8');
for (const file of fs.readdirSync(promptDir)) {
  if (file === '_base.txt') continue;
  const topicId = path.basename(file, '.txt');
  promptCache.set(topicId, fs.readFileSync(path.join(promptDir, file), 'utf-8'));
}

function buildPrompt(topicId) {
  const topic = promptCache.get(topicId) ?? '';
  return `${topic}\n\n${base}`.trim();
}
```

---

### 🟡 2순위 — UX 개선

#### 작업 D: TTS 로딩 상태 분리

**문제:** `useTTSButton.ts` — `isPlaying`이 "로딩 중"과 "재생 중"을 구분하지 않음. API 응답 전 1~2초 무반응처럼 보임

**해결책:** `useTTSButton.ts`에 `isLoading` 상태 추가, `TTSButton.tsx`에 스피너 분기

```typescript
// useTTSButton.ts
const [isLoading, setIsLoading] = useState(false);
const [isPlaying, setIsPlaying] = useState(false);

async function handlePress() {
  if (isPlaying || isLoading) { stopTTS(); setIsPlaying(false); return; }
  setIsLoading(true);
  try {
    await playTTS(text, () => setIsPlaying(false));
    setIsPlaying(true);
  } finally {
    setIsLoading(false);
  }
}
return { isPlaying, isLoading, handlePress };
```

---

### 🟢 3순위 — 추후 고도화 (MVP 이후)

| 항목 | 설명 | 시점 |
|------|------|------|
| TTS 캐싱 | Supabase Storage에 `{message_id}.mp3` 저장, 재탭 시 URL 직접 재생 | 실사용 비용 확인 후 |
| GPT-4o-Audio 통합 | STT+LLM 단일 호출로 응답 속도 개선 | 서비스 안정화 후 |

---

### 작업 순서 요약

| 순서 | 작업 | 대상 파일 | 에이전트 | 우선순위 | 상태 |
|------|------|-----------|----------|----------|------|
| 1 | Supabase RPC `process_turn` 생성 (마이그레이션) | Supabase SQL Editor | `contexttalk-api-architect` | 🔴 | ✅ 완료 |
| 2 | Supabase RPC `get_conversations_with_turns` 생성 | Supabase SQL Editor | `contexttalk-api-architect` | 🔴 | ✅ 완료 |
| 3 | `conversations.js` 리팩토링 (RPC 호출로 교체, turnLimitMiddleware 제거) | `ai-server/routes/conversations.js`, `ai-server/middleware/turnLimit.js` | `contexttalk-api-architect` | 🔴 | ✅ 완료 |
| 4 | `buildPrompt.js` 프리로드 방식으로 수정 | `ai-server/utils/buildPrompt.js` | `contexttalk-api-architect` | 🔴 | ✅ 완료 |
| 5 | 프론트엔드 `user_message_id` 수신 및 적용 | `mobile-app/api/chat.ts`, `mobile-app/app/chat/[id].tsx` | `rn-expo-frontend` | 🟡 | ✅ 완료 |
| 6 | TTS 로딩 UI 개선 + AbortController | `mobile-app/hooks/useTTSButton.ts`, `mobile-app/components/common/TTSButton.tsx` | `rn-expo-frontend` | 🟡 | ✅ 완료 |
| 7 | TTS 캐싱 (Supabase Storage) | `ai-server/routes/tts.js`, Supabase Storage | `contexttalk-api-architect` | 🟢 | ✅ 완료 |
| 8 | GPT-4o-Audio 통합 | `ai-server/routes/conversations.js` | `contexttalk-api-architect` | 🟢 | ⏸ 보류 — m4a 미지원(wav/mp3만 지원), UX 역체감 확인. GPT-4o-Audio GA 전환 후 재검토 |

---

## Phase 5: 고도화 & 리텐션 기능

> "핵심 MVP 완성 이후, 유저 재방문율과 학습 효과를 높이는 7가지 기능"

작업 순서: Task 035(마이크) → Task 047(Situation) → Task 048~050(망각 곡선) → Task 051(표현 유도) → Task 052~053(푸시 알림) → Task 054~056(주간 리포트) → Task 057~059(미션 상황극)

---

### Phase 5-A: 섀도잉 완성 (Task 035 선행)

> Task 035는 위 Phase 3에 정의되어 있음. expo-video seek 비동기 처리 방식으로 구현 (⚠️ 주의사항 참고).

---

### Phase 5-B: Situation 상황 선택 분리

---

#### Task 047: Situation 상황 선택 분리 `[rn-expo-frontend]`

**대상 파일:**
- `mobile-app/constants/situations.ts` (신규)
- `mobile-app/app/chat/topic-select.tsx` (신규)
- `mobile-app/app/(tabs)/index.tsx`

**배경:**
현재 홈 화면의 Situation 카드가 Free Talking과 동일하게 `createConversation('free_talk', 'Free Talking')`을 호출함.
`ai-server/prompts/` 폴더에 상황별 프롬프트 파일이 이미 모두 존재하므로 백엔드 변경 없이 프론트엔드만 수정하면 됨.

**구현 사항:**

`constants/situations.ts` 생성:
```typescript
export type Situation = {
  id: string;
  label: string;
  emoji: string;
  desc: string;
};

export const SITUATIONS: Situation[] = [
  { id: 'cafe_order',          emoji: '☕', label: '카페 주문',     desc: '음료 주문, 커스텀 요청, 픽업 안내' },
  { id: 'airport_immigration', emoji: '✈️', label: '공항 입국심사', desc: '비자, 방문 목적, 체류 기간 설명' },
  { id: 'hotel_checkin',       emoji: '🏨', label: '호텔 체크인',   desc: '예약 확인, 룸 요청, 어메니티 문의' },
  { id: 'small_talk',          emoji: '💬', label: '스몰토크',       desc: '날씨, 주말 이야기, 가벼운 일상' },
  { id: 'opinion',             emoji: '💭', label: '의견 말하기',    desc: '찬반 토론, 논리적 설득, 제안' },
];
```

`app/chat/topic-select.tsx` 신규 생성:
- [x] `SITUATIONS` 배열을 FlatList로 렌더링 (카드 형태, 이모지 + 제목 + 설명)
- [x] 카드 탭 → `createConversation(situation.id, situation.label)` 호출 → `/chat/[id]` 이동
- [x] 로딩 중 선택한 카드에 `ActivityIndicator` 표시 (중복 탭 방지)
- [x] 상단 헤더: 뒤로가기 + "상황 선택"

`app/(tabs)/index.tsx` 수정:
- [x] Situation 카드의 `onPress` → `router.push('/chat/topic-select')`로 변경 (기존 `handleFABPress` 제거)
- [x] `app/_layout.tsx`에 `<Stack.Screen name="chat/topic-select" options={{ headerShown: false }} />` 추가

**백엔드 변경:** 없음 (`buildPrompt.js`가 `topic_id`로 프롬프트 파일 자동 매핑)

**완료 기준:** Situation 카드 탭 → 상황 선택 화면 → 상황 선택 → 해당 프롬프트로 채팅 시작 확인

---

### Phase 5-C: 망각 곡선 퀴즈 (Spaced Repetition)

---

#### Task 048: 망각 곡선 퀴즈 — DB 마이그레이션 `[Playwright MCP]`

**대상:** Supabase SQL Editor

**구현 사항:**
- [ ] `expressions` 테이블에 컬럼 2개 추가
  ```sql
  ALTER TABLE expressions
    ADD COLUMN next_review_date date    DEFAULT CURRENT_DATE,
    ADD COLUMN review_interval  integer DEFAULT 1;
  -- next_review_date: 다음 복습 예정일 (YYYY-MM-DD)
  -- review_interval:  현재 복습 간격(일). 1→2→4→8→16→30 상한
  ```
- [ ] 인덱스 추가
  ```sql
  CREATE INDEX idx_expressions_review ON expressions(user_id, next_review_date);
  ```
- [ ] 기존 rows 기본값 확인 (DEFAULT로 자동 채워짐)

**완료 기준:** Supabase 대시보드에서 컬럼 2개 추가 확인, 기존 표현 rows에 `next_review_date = CURRENT_DATE` 적용 확인

---

#### Task 049: 망각 곡선 퀴즈 — API 업데이트 `[contexttalk-api-architect]`

**대상 파일:** `ai-server/routes/quiz.js`

**구현 사항:**

`POST /api/quiz/generate` — 문제 선택 로직 변경:
- [ ] `expressions` 조회 시 `next_review_date` 컬럼 추가 선택
  ```javascript
  .select('id, expression_text, next_review_date, review_interval')
  ```
- [ ] 복습 예정 표현 우선 선택 (날짜 오래된 순 — 가장 시급한 것 먼저)
  ```javascript
  const today = new Date().toISOString().split('T')[0];

  const due = expressions
    .filter(e => e.next_review_date <= today)
    .sort((a, b) => new Date(a.next_review_date) - new Date(b.next_review_date));

  const rest = shuffleArray(
    expressions.filter(e => e.next_review_date > today)
  );

  // due >= 10이면 rest 불필요, due < 10이면 rest로 채우기
  const selected = [...due, ...rest].slice(0, 10);
  ```

`PATCH /api/quiz/sessions/:id` — 채점 후 복습 날짜 갱신 추가:
- [ ] Request body 확장: `{ correct_count: number, answers: Array<{ expression_id: string, is_correct: boolean }> }`
- [ ] `answers` 배열 유효성 검사 (선택적 필드 — 없으면 기존 동작 유지)
- [ ] 각 answer로 expressions 업데이트:
  ```javascript
  if (Array.isArray(answers) && answers.length > 0) {
    for (const answer of answers) {
      const { data: expr } = await supabase
        .from('expressions')
        .select('review_interval')
        .eq('id', answer.expression_id)
        .single();

      const newInterval = answer.is_correct
        ? Math.min((expr?.review_interval ?? 1) * 2, 30)
        : 1;

      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + newInterval);

      await supabase.from('expressions')
        .update({
          review_interval: newInterval,
          next_review_date: nextDate.toISOString().split('T')[0],
        })
        .eq('id', answer.expression_id);
    }
  }
  ```

**에러 코드 추가 없음** (answers는 선택적, 없어도 correct_count 업데이트는 정상 동작)

**완료 기준:** `/generate` 호출 시 오버듀 표현이 우선 선택됨 확인, `/sessions/:id` PATCH 후 expressions의 `next_review_date` 갱신 확인

---

#### Task 050: 망각 곡선 퀴즈 — 프론트엔드 업데이트 `[rn-expo-frontend]`

**대상 파일:**
- `mobile-app/api/quiz.ts`
- `mobile-app/app/quiz/[sessionId].tsx`

**구현 사항:**

`api/quiz.ts` — `submitQuizResult` 함수 확장:
- [ ] `answers` 파라미터 추가
  ```typescript
  export async function submitQuizResult(
    sessionId: string,
    correctCount: number,
    answers: Array<{ expression_id: string; is_correct: boolean }>
  ): Promise<void>
  ```
- [ ] PATCH body에 `answers` 배열 포함하여 전송

`app/quiz/[sessionId].tsx` — 채점 수집 로직 추가:
- [ ] `answers` 로컬 state를 `boolean[]` → `Array<{ expression_id: string; is_correct: boolean }>` 로 변경
- [ ] 👍/👎 탭 시 현재 문제의 `expression_id` + `is_correct` 함께 수집
  ```typescript
  function handleAnswer(isCorrect: boolean) {
    const currentQ = questions[currentIndex];
    const newAnswers = [
      ...answers,
      { expression_id: currentQ.expression_id, is_correct: isCorrect }
    ];
    setAnswers(newAnswers);
    // ... 기존 로직
  }
  ```
- [ ] 마지막 문제에서 `submitQuizResult(sessionId, correctCount, newAnswers)` 호출

**완료 기준:** 퀴즈 완료 후 틀린 표현의 `next_review_date`가 내일로, 맞은 표현이 interval * 2일 뒤로 갱신됨 확인

---

### Phase 5-D: 저장 표현으로 대화 유도

---

#### Task 051: 저장 표현으로 대화 유도 — 백엔드 프롬프트 개인화 `[contexttalk-api-architect]`

**대상 파일:** `ai-server/routes/conversations.js`

**배경:**
유저가 Learn 탭에 저장한 최근 표현들을 GPT 시스템 프롬프트에 주입해, 대화 중 자연스럽게 해당 표현을 쓸 수 있는 문맥을 유도함. 몰입 유지를 위해 연습 중임을 AI가 명시하지 않도록 강제.

**구현 사항:**

`POST /api/conversations/:id/messages` 내 시스템 프롬프트 생성 부분:
- [ ] `buildPrompt(topic_id)` 호출 후 유저 표현 조회 추가
  ```javascript
  let systemPrompt = buildPrompt(conversation.topic_id);

  const { data: recentExpressions } = await supabase
    .from('expressions')
    .select('expression_text')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (recentExpressions?.length > 0) {
    const list = recentExpressions
      .map(e => `- "${e.expression_text}"`)
      .join('\n');

    systemPrompt +=
      `\n\nThe learner recently saved these expressions:\n${list}\n\n` +
      `Naturally steer the conversation so the learner has an opportunity ` +
      `to use these expressions in context. ` +
      `Never explicitly mention that you are practicing them. ` +
      `Do not break character. Just guide the context naturally.`;
  }
  ```
- [ ] 표현이 없거나 조회 실패 시 기존 프롬프트 그대로 사용 (에러 전파 없음)

**성능 고려:** DB 조회 1건 추가. `expressions` 테이블은 소량 데이터이므로 응답 시간 영향 없음.

**완료 기준:** 대화 시작 후 AI가 저장된 표현과 유사한 문맥을 자연스럽게 제시하는지 수동 확인

---

### Phase 5-E: 푸시 알림

---

#### Task 052: 푸시 알림 — 유틸리티 + Settings 탭 활성화 `[rn-expo-frontend]`

**대상 파일:**
- `mobile-app/utils/notifications.ts` (신규)
- `mobile-app/app/(tabs)/settings.tsx`

**구현 사항:**

`utils/notifications.ts` 생성:
- [ ] 고정 알림 ID 상수 정의
  ```typescript
  export const NOTIFICATION_IDS = {
    STREAK: 'streak-daily-reminder',
    REVIEW: 'review-daily-reminder',
  } as const;
  ```
- [ ] `requestPermission(): Promise<boolean>` — 알림 권한 요청, granted 여부 반환
- [ ] `scheduleStreakReminder()` — 매일 저녁 8시 반복 알림 스케줄
  ```typescript
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_IDS.STREAK,
    content: {
      title: '오늘 영어 대화 하셨나요? 🐻',
      body: '곰돌이가 기다리고 있어요! 5분만 대화해볼까요?',
    },
    trigger: { hour: 20, minute: 0, repeats: true },
  });
  ```
- [ ] `scheduleReviewReminder()` — 매일 오전 10시 반복 알림 스케줄 (망각 곡선 연동)
  ```typescript
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_IDS.REVIEW,
    content: {
      title: '오늘 복습할 표현이 있어요 📚',
      body: '퀴즈 탭에서 확인해보세요!',
    },
    trigger: { hour: 10, minute: 0, repeats: true },
  });
  ```
- [ ] `cancelTodayStreakReminder()` — 오늘 치 스트릭 알림 취소 후 내일 알림 재스케줄
  ```typescript
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.STREAK);
  // 내일 저녁 8시 1회성 재스케줄
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(20, 0, 0, 0);
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_IDS.STREAK,
    content: { title: '오늘 영어 대화 하셨나요? 🐻', body: '곰돌이가 기다리고 있어요!' },
    trigger: { date: tomorrow },
  });
  ```
- [ ] `disableAllNotifications()` — `Notifications.cancelAllScheduledNotificationsAsync()`

`app/(tabs)/settings.tsx` 수정:
- [ ] `notificationsEnabled` 로컬 state 추가 (`AsyncStorage`에서 초기값 로드)
- [ ] Notifications 메뉴 항목 → `Switch` 컴포넌트로 교체 또는 탭 핸들러 추가
  ```typescript
  async function handleNotificationToggle() {
    if (!notificationsEnabled) {
      const granted = await requestPermission();
      if (!granted) {
        showToast('설정에서 알림 권한을 허용해주세요.');
        return;
      }
      await scheduleStreakReminder();
      await scheduleReviewReminder();
      await AsyncStorage.setItem('notifications_enabled', 'true');
      setNotificationsEnabled(true);
    } else {
      await disableAllNotifications();
      await AsyncStorage.setItem('notifications_enabled', 'false');
      setNotificationsEnabled(false);
    }
  }
  ```

**완료 기준:** Settings에서 알림 ON → 권한 요청 → 알림 스케줄 등록 확인, OFF → 전체 취소 확인

---

#### Task 053: 푸시 알림 — 취소 로직 연동 `[rn-expo-frontend]`

**대상 파일:**
- `mobile-app/app/chat/[id].tsx`
- `mobile-app/app/(tabs)/index.tsx`

**배경:**
유저가 이미 대화를 시작했거나 20턴 목표를 달성한 경우, 저녁 8시 알림이 울리면 오히려 UX를 해침. 두 시점에서 오늘 치 알림을 취소해야 함.

**구현 사항:**

`app/chat/[id].tsx` — 첫 발화 전송 시 취소:
- [ ] `handleRecordingStop` / `handleTextSend` 내부 최초 실행 시점 감지
  ```typescript
  // turns.length === 0 이면 오늘 첫 대화
  if (turns.length === 0) {
    cancelTodayStreakReminder().catch(() => {});
  }
  ```

`app/(tabs)/index.tsx` — 20턴 달성 시 취소:
- [ ] `isTurnLimitReached` 상태 변화 감지 `useEffect` 추가
  ```typescript
  useEffect(() => {
    if (isTurnLimitReached) {
      cancelTodayStreakReminder().catch(() => {});
    }
  }, [isTurnLimitReached]);
  ```

**완료 기준:** 대화 시작 후 예약된 스트릭 알림이 취소됨 확인 (`Notifications.getAllScheduledNotificationsAsync()`로 검증)

---

### Phase 5-F: AI 주간 약점 분석 리포트

---

#### Task 054: 주간 리포트 — DB 마이그레이션 `[Playwright MCP]`

**대상:** Supabase SQL Editor

**구현 사항:**
- [ ] `weekly_reports` 테이블 생성
  ```sql
  CREATE TABLE weekly_reports (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
    week_start date NOT NULL,
    content    jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, week_start)
  );

  ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "weekly_reports_own" ON weekly_reports
    FOR ALL USING (auth.uid() = user_id);

  CREATE INDEX idx_weekly_reports_user ON weekly_reports(user_id, week_start DESC);
  ```

**완료 기준:** Supabase 대시보드에서 테이블 생성 및 RLS 활성화 확인

---

#### Task 055: 주간 리포트 — API 구현 `[contexttalk-api-architect]`

**대상 파일:**
- `ai-server/routes/reports.js` (신규)
- `ai-server/index.js`

**구현 사항:**

`routes/reports.js` 생성:
- [ ] `GET /api/reports/weekly` 엔드포인트
  1. **캐시 확인** — 이번 주 리포트가 이미 존재하면 GPT 호출 없이 즉시 반환 (`cached: true`)
     ```javascript
     const weekStart = getMonday(new Date()); // 이번 주 월요일 (YYYY-MM-DD)

     const { data: cached } = await supabase
       .from('weekly_reports')
       .select('content, created_at')
       .eq('user_id', req.user.id)
       .eq('week_start', weekStart)
       .single();

     if (cached) return res.json({ report: cached.content, cached: true });
     ```
  2. **데이터 수집** — 지난 7일 ai_turn 메시지에서 `is_perfect: false` 피드백 추출
     ```javascript
     const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
     const { data: messages } = await supabase
       .from('messages')
       .select('content, created_at')
       .eq('user_id', req.user.id)
       .eq('content_type', 'ai_turn')
       .gte('created_at', sevenDaysAgo);

     const corrections = (messages || []).flatMap(m =>
       (m.content.feedback || []).filter(fb => !fb.is_perfect)
     );
     const totalTurns = messages?.length ?? 0;

     if (corrections.length === 0) {
       return res.json({ report: null, totalTurns, message: '이번 주 교정 내역이 없어요!' });
     }
     ```
  3. **GPT-4o-mini 리포트 생성** — JSON mode, temperature 0.5
     ```javascript
     // 시스템 프롬프트 (아래 JSON 형식 강제)
     // {
     //   "summary": "이번 주 한 줄 총평 (한국어)",
     //   "total_turns": number,
     //   "weak_points": [
     //     { "category": "문법 카테고리", "count": number,
     //       "examples": [{ "original": "원문", "corrected": "교정문" }] }
     //   ],  // 최대 3개
     //   "praise": "잘한 점 (한국어)",
     //   "next_goal": "다음 주 목표 (한국어)"
     // }
     ```
  4. **DB upsert** — 같은 주에 재요청해도 덮어쓰기
     ```javascript
     await supabase.from('weekly_reports')
       .upsert({ user_id: req.user.id, week_start: weekStart, content: report });
     ```
  5. **응답** — `{ report, cached: false }`

- [ ] `ai-server/index.js`에 `app.use('/api/reports', require('./routes/reports'))` 추가

**에러 코드:**

| 코드 | HTTP | 설명 |
|------|------|------|
| `NO_DATA` | 200 (report: null) | 이번 주 교정 내역 없음 |
| `REPORT_GENERATION_FAILED` | 502 | GPT 호출 실패 |
| `INTERNAL_ERROR` | 500 | Supabase 오류 |

**완료 기준:** 첫 요청 → GPT 생성 + DB 저장, 재요청 → 캐시 즉시 반환 (`cached: true`) 확인

---

#### Task 056: 주간 리포트 — 프론트엔드 `[rn-expo-frontend]`

**대상 파일:**
- `mobile-app/api/reports.ts` (신규)
- `mobile-app/app/(tabs)/index.tsx`

**구현 사항:**

`api/reports.ts` 생성:
- [ ] `fetchWeeklyReport(): Promise<WeeklyReportResponse>` — `GET /api/reports/weekly`
  ```typescript
  type WeeklyReport = {
    summary: string;
    total_turns: number;
    weak_points: Array<{
      category: string;
      count: number;
      examples: Array<{ original: string; corrected: string }>;
    }>;
    praise: string;
    next_goal: string;
  };

  type WeeklyReportResponse = {
    report: WeeklyReport | null;
    cached: boolean;
    totalTurns?: number;
    message?: string;
  };
  ```

`app/(tabs)/index.tsx` 수정:
- [ ] 스트릭 카드 아래 "📊 이번 주 리포트 보기" 버튼 추가 (리포트가 null이면 비표시)
- [ ] 버튼 탭 → `fetchWeeklyReport()` 호출 → 결과를 모달로 표시
- [ ] **로딩 상태** — GPT 응답 대기 중 순환 문구 표시 (500ms 간격 교체)
  ```typescript
  const LOADING_MSGS = [
    '일주일치 대화를 열심히 분석하고 있어요... 🤖',
    '틀린 패턴을 찾고 있어요... 🔍',
    '선생님이 꼼꼼히 살펴보는 중이에요... 📝',
  ];
  ```
- [ ] **결과 모달** 구성
  ```
  ┌────────────────────────────────┐
  │  📊 이번 주 학습 리포트         │
  │  summary (한 줄 총평)           │
  ├────────────────────────────────┤
  │  약점 TOP 3                     │
  │  • 과거시제 (3번)               │
  │    원: "I go there"             │
  │    교: "I went there"           │
  ├────────────────────────────────┤
  │  👍 praise                      │
  │  🎯 next_goal                   │
  ├────────────────────────────────┤
  │  [닫기]                         │
  └────────────────────────────────┘
  ```
- [ ] `cached: true`이면 즉시 모달 표시 (로딩 스피너 없음)

**완료 기준:** 버튼 탭 → 로딩 문구 → 리포트 모달 표시, 재탭 시 캐시된 내용 즉시 표시 확인

---

### Phase 5-G: 미션 달성형 상황극

---

#### Task 057: 미션 달성형 상황극 — 상수 정의 + 타입 확장 `[rn-expo-frontend]`

**대상 파일:**
- `mobile-app/constants/missions.ts` (신규)
- `mobile-app/types/index.ts`

**구현 사항:**

`types/index.ts` 타입 확장:
- [ ] `AITurnContent`에 선택적 `goal_achieved` 필드 추가
  ```typescript
  export type AITurnContent = {
    feedback: FeedbackItem[];
    next_response: string;
    goal_achieved?: boolean; // 미션 모드에서만 등장, undefined = 일반 대화
  };
  ```

`constants/missions.ts` 생성:
- [ ] `Mission` 타입 + `MISSIONS` 배열 정의
  ```typescript
  export type Mission = {
    id: string;
    situationId: string;   // 연결된 situation (프롬프트 파일 ID)
    label: string;
    desc: string;
    missionBar: string;    // 채팅 화면 상단 고정 텍스트
    successPrompt: string; // GPT 달성 조건 — 구체적으로 서술
  };

  export const MISSIONS: Mission[] = [
    {
      id: 'cafe_return',
      situationId: 'cafe_order',
      label: '☕ 차가운 커피 환불받기',
      desc: '주문한 뜨거운 커피가 차갑게 나왔어요. 예의 바르게 환불을 받아내세요!',
      missionBar: '미션: 차가운 커피 환불받기 ☕',
      successPrompt:
        `Always include "goal_achieved": false in every response by default. ` +
        `Set "goal_achieved": true ONLY IF the customer explicitly requested a refund ` +
        `OR replacement AND provided a valid reason (wrong temperature, wrong order, etc.). ` +
        `If the customer only complained without a clear request, keep false. ` +
        `Initially resist citing store policy, but yield if the argument is logical and polite.`,
    },
    {
      id: 'hotel_upgrade',
      situationId: 'hotel_checkin',
      label: '🏨 룸 업그레이드 요청하기',
      desc: '체크인할 때 정중하게 더 좋은 룸으로 업그레이드를 요청해보세요!',
      missionBar: '미션: 룸 업그레이드 성공하기 🏨',
      successPrompt:
        `Always include "goal_achieved": false by default. ` +
        `Set "goal_achieved": true ONLY IF the guest explicitly asked for an upgrade ` +
        `AND gave a persuasive reason (special occasion, loyalty status, etc.). ` +
        `Keep false for vague requests without justification.`,
    },
    {
      id: 'airport_explain',
      situationId: 'airport_immigration',
      label: '✈️ 입국 심사 통과하기',
      desc: '입국 심사관의 까다로운 질문을 모두 통과해 도장을 받으세요!',
      missionBar: '미션: 입국 심사 통과하기 ✈️',
      successPrompt:
        `Always include "goal_achieved": false by default. ` +
        `Act as a strict immigration officer. Ask at least 3 questions (purpose, duration, accommodation). ` +
        `Set "goal_achieved": true ONLY IF the traveler answered all questions clearly and consistently. ` +
        `If any answer is vague or contradictory, keep false and ask follow-up questions.`,
    },
  ];
  ```

**완료 기준:** TypeScript 컴파일 오류 없음, `@/constants/missions` import 가능

---

#### Task 058: 미션 달성형 상황극 — 백엔드 프롬프트 주입 `[contexttalk-api-architect]`

**대상 파일:**
- `ai-server/routes/conversations.js`
- `ai-server/constants/missions.js` (신규 — 서버 사이드 미션 상수)

**배경:**
미션 달성 조건을 GPT 시스템 프롬프트에 주입하고, GPT 응답 JSON에 `goal_achieved` 필드를 포함시키는 작업.

**구현 사항:**

`ai-server/constants/missions.js` 생성:
- [ ] 프론트엔드의 `missions.ts`와 동일한 `MISSIONS` 배열 (CommonJS) — `successPrompt`만 필요
  ```javascript
  'use strict';
  const MISSIONS = [
    { id: 'cafe_return',     situationId: 'cafe_order',          successPrompt: '...' },
    { id: 'hotel_upgrade',   situationId: 'hotel_checkin',       successPrompt: '...' },
    { id: 'airport_explain', situationId: 'airport_immigration', successPrompt: '...' },
  ];
  module.exports = { MISSIONS };
  ```

`POST /api/conversations` (대화 생성) 수정:
- [ ] Request body에 `mission_id?: string` 선택적 필드 수신
- [ ] `conversations` 테이블에 `mission_id` 컬럼 추가 (마이그레이션 필요)
  ```sql
  ALTER TABLE conversations ADD COLUMN mission_id text;
  ```
- [ ] INSERT 시 `mission_id` 함께 저장

`POST /api/conversations/:id/messages` 수정:
- [ ] 대화 조회 시 `mission_id` 포함
- [ ] `mission_id`가 있으면 GPT 시스템 프롬프트에 미션 조건 주입
  ```javascript
  const mission = MISSIONS.find(m => m.id === conversation.mission_id);
  if (mission) {
    systemPrompt +=
      `\n\nMISSION MODE — Additional instructions:\n${mission.successPrompt}`;
  }
  ```
- [ ] GPT 응답 JSON 파싱 시 `goal_achieved` 필드 추출 (없으면 `false`로 기본값)
- [ ] API 응답에 `goal_achieved` 포함: `{ message_id, user_message_id, turn_number, content }` — `content.goal_achieved` 로 전달

**완료 기준:** 미션 모드 대화에서 GPT 응답 JSON에 `goal_achieved` 포함 확인, 조건 미달 시 `false` 유지 확인

---

#### Task 059: 미션 달성형 상황극 — 프론트엔드 UI `[rn-expo-frontend]`

**대상 파일:**
- `mobile-app/app/chat/topic-select.tsx` (Task 047에서 생성)
- `mobile-app/app/chat/[id].tsx`
- `mobile-app/api/conversations.ts`

**구현 사항:**

`api/conversations.ts` — `createConversation` 함수에 `missionId` 파라미터 추가:
- [ ] `POST /api/conversations` body에 `mission_id` 선택적 포함

`app/chat/topic-select.tsx` 수정 — 미션 선택 UI 추가:
- [ ] 상황 선택 후 "그냥 대화하기" / "미션 도전!" 버튼 분기
- [ ] "미션 도전!" 탭 → 해당 상황의 MISSIONS 목록 표시 → 미션 선택 → `createConversation(situationId, label, missionId)` 호출

`app/chat/[id].tsx` 수정:

미션 바 (상단 고정):
- [ ] `params.missionBar`가 있으면 헤더 아래에 미션 바 렌더링
  ```typescript
  {missionBar && (
    <View className="bg-amber-50 border-b border-amber-100 px-4 py-2">
      <Text className="text-amber-700 text-xs font-semibold text-center">
        {missionBar}
      </Text>
    </View>
  )}
  ```

`goal_achieved` 감지 → 폭죽 + 모달:
- [ ] `react-native-confetti-cannon` 라이브러리 추가 (`npm install react-native-confetti-cannon`)
- [ ] `fetchAIResponse` 내 응답 처리 부분에서 감지
  ```typescript
  if (content.goal_achieved) {
    confettiRef.current?.start();
    setMissionCleared(true);
  }
  ```
- [ ] 미션 클리어 모달 (`missionCleared === true` 시 표시)
  ```
  ┌──────────────────────────────┐
  │           🎯                 │
  │      미션 클리어!             │
  │  완벽하게 해냈어요!           │
  │  실전에서도 충분히 통할        │
  │  실력이에요.                  │
  │                              │
  │  [홈으로 돌아가기]            │
  └──────────────────────────────┘
  ```
- [ ] `router.replace('/(tabs)')` 로 홈 복귀

**완료 기준:** 미션 선택 → 채팅 화면 상단 미션 바 표시 → 달성 시 폭죽 + 클리어 모달 표시 → 홈 복귀 전체 플로우 동작 확인

---

## Phase 5 진행 현황

| Task | 설명 | 에이전트 | 상태 |
|------|------|----------|------|
| Task 035 | 섀도잉 마이크 녹음 → 비교 재생 (expo-video seek 방식) | rn-expo-frontend | ✅ 완료 |
| Task 047 | Situation 상황 선택 분리 | rn-expo-frontend | ✅ 완료 |
| Task 048 | 망각 곡선 퀴즈 DB 마이그레이션 | Playwright MCP | ⬜ 대기 |
| Task 049 | 망각 곡선 퀴즈 API 업데이트 | contexttalk-api-architect | 🔄 부분 완료 |
| Task 050 | 망각 곡선 퀴즈 프론트엔드 업데이트 | rn-expo-frontend | ⬜ 대기 |
| Task 051 | 저장 표현으로 대화 유도 (백엔드 프롬프트 개인화) | contexttalk-api-architect | ⬜ 대기 |
| Task 052 | 푸시 알림 유틸리티 + Settings 탭 활성화 | rn-expo-frontend | ⬜ 대기 |
| Task 053 | 푸시 알림 취소 로직 연동 | rn-expo-frontend | ⬜ 대기 |
| Task 054 | 주간 리포트 DB 마이그레이션 | Playwright MCP | ⬜ 대기 |
| Task 055 | 주간 리포트 API 구현 | contexttalk-api-architect | ⬜ 대기 |
| Task 056 | 주간 리포트 프론트엔드 | rn-expo-frontend | ⬜ 대기 |
| Task 057 | 미션 상황극 상수 정의 + 타입 확장 | rn-expo-frontend | ⬜ 대기 |
| Task 058 | 미션 상황극 백엔드 프롬프트 주입 | contexttalk-api-architect | ⬜ 대기 |
| Task 059 | 미션 상황극 프론트엔드 UI | rn-expo-frontend | ⬜ 대기 |

## Phase 5 Task 의존성

```
Task 035 (섀도잉 마이크) ← 독립

Task 047 (Situation 분리) ← 독립
  └── Task 057 (미션 상수 + 타입)
        ├── Task 058 (미션 백엔드)
        └── Task 059 (미션 프론트엔드)
              └── (Task 047, 058 완료 후)

Task 048 (망각곡선 DB)
  └── Task 049 (망각곡선 API)
        └── Task 050 (망각곡선 프론트엔드)

Task 051 (표현 유도) ← 독립

Task 052 (알림 유틸) ← 독립
  └── Task 053 (알림 취소 연동)

Task 054 (리포트 DB)
  └── Task 055 (리포트 API)
        └── Task 056 (리포트 프론트엔드)
```

---

## 작업 이력 (2026-04-04)

### 🚀 Railway 배포 완료 (ai-server)

- Railway 프로젝트: `tranquil-nature` → `english-app` 서비스
- Root Directory: `/ai-server` 설정 (Railpack 빌드 오류 해결)
- 환경변수 등록: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Public URL: `https://english-app-production-a08d.up.railway.app`
- `mobile-app/.env`에 `EXPO_PUBLIC_API_BASE_URL` 설정 완료
- **이제 어디서든 앱 사용 가능 (새 빌드 설치 후)**

### 🔄 Task 047 — Situation 상황 선택 분리 (진행 중)

- `mobile-app/constants/situations.ts` 신규 생성 — `Situation` 타입 + `SITUATIONS` 배열 (5개 상황)
- `mobile-app/app/chat/topic-select.tsx` — `TOPICS` → `SITUATIONS` 교체, `SituationCard` 리팩토링, 개별 로딩 상태(`loadingId`), `desc` 텍스트 표시
- `mobile-app/app/(tabs)/index.tsx` — Situation 카드 → `/chat/topic-select` 직접 라우팅
- `mobile-app/app/(tabs)/study.tsx` — `useEffect` → `useFocusEffect` (포커스 시 자동 갱신)

### 🔄 Task 049 — 망각 곡선 퀴즈 API (부분 완료)

- `ai-server/routes/quiz.js`
  - `isShortExpression()` — 6단어 이하 PHRASE / 이상 SENTENCE 분류
  - GPT 프롬프트: PHRASE는 새 예문 생성, SENTENCE는 원문 그대로 사용
  - 퀴즈 생성 시 `next_review_date` 기준 복습 기한 도래 항목 우선 선택
  - `PATCH /sessions/:id` — `answers` 배열 수신, 맞으면 interval×2(최대 30일), 틀리면 1일 리셋

### ♻️ API 직접 Supabase 호출 전환

- `mobile-app/api/conversations.ts` — `fetchConversations`: ai-server → `supabase.rpc('get_conversations_with_turns')`
- `mobile-app/api/shadowing.ts` — `fetchContents`, `fetchContentDetail`: ai-server → Supabase 직접 쿼리 (네트워크 홉 감소)

### 📱 EAS 빌드

- Android development 빌드 완료
- Build ID: `120d186e-1627-4154-a833-862304dd920b`
