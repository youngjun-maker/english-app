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

**구현 사항:**
- [ ] 마이크 버튼 탭 → expo-av `Audio.Recording` 시작, `setIsRecording(true)`
- [ ] 다시 탭 → 녹음 중지, m4a 임시 파일 URI 저장, `setIsRecording(false)`
- [ ] 비교 재생 시퀀스 자동 실행:
  1. 현재 문장의 `start_time`으로 영상 seek → 재생
  2. `end_time` 도달 시 영상 pause
  3. 저장된 m4a 파일 `expo-av Sound` 로 재생
  4. 재생 완료 후 임시 파일 삭제 (`expo-file-system deleteAsync`)
- [ ] 녹음 중 상태에서 화면 이탈 시 녹음 자동 중지 처리 (cleanup)

**완료 기준:** 마이크 버튼 탭 → 녹음 → 원어민 구간 재생 → 내 목소리 재생 시퀀스 동작 확인

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
| Task 035 | 녹음 → 비교 재생 | rn-expo-frontend | ⬜ 대기 |
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
