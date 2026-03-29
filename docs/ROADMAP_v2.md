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
