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
- [ ] `mobile-app/types/shadowing.ts` 생성
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
- [ ] `useAppStore.ts`에 shadowing 슬라이스 추가
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
- [ ] `mobile-app/api/shadowing.ts` 생성 — `fetchContents()`, `fetchContentDetail(id)`, `saveSession()` 함수
- [ ] `ContentCard.tsx` 구현 — 썸네일, 제목, 레벨 뱃지, 재생 시간 표시. NativeWind 스타일, 순백색 배경
- [ ] `app/(tabs)/shadowing.tsx` 구현 — FlatList로 콘텐츠 목록, 로딩 상태, 빈 목록 처리
- [ ] `(tabs)/_layout.tsx`에 shadowing 탭 추가 (아이콘: `play.circle` 또는 유사 outline 아이콘)
- [ ] 카드 탭 시 `router.push('/shadowing/[id]')` 이동

**완료 기준:** 탭에서 콘텐츠 목록 카드 렌더링 확인, 탭 이동 정상 동작

---

#### Task 031: 섀도잉 플레이어 기본 틀 + VideoPlayer 컴포넌트 `[rn-expo-frontend]`

**대상 파일:**
- `mobile-app/app/shadowing/[id].tsx` (신규)
- `mobile-app/components/shadowing/VideoPlayer.tsx` (신규)

**전제 조건 (구현 전 필수):**
- [ ] Supabase Storage `shadowing-videos` 버킷 생성 (Public ON)
- [ ] Steve Jobs Stanford 클립 영상 업로드 (`jobs_stanford_clip.mp4`)
- [ ] `shadowing_contents.video_url` 갱신 — SQL Editor에서 실행:
  ```sql
  UPDATE shadowing_contents
  SET video_url = 'https://brjvyzdeyszfhgttybzn.supabase.co/storage/v1/object/public/shadowing-videos/jobs_stanford_clip.mp4'
  WHERE id = 'fea2383e-d8c4-4ac3-b7f9-27eee481c264';
  ```
  > 영상 파일 준비: `yt-dlp --download-sections "*0-105" -f mp4 -o jobs_stanford_clip.mp4 "https://www.youtube.com/watch?v=UF8uR6Z6KLc"`

**구현 사항:**
- [ ] `VideoPlayer.tsx` 구현
  - `expo-video` `useVideoPlayer` 훅 사용
  - `VideoView` 16:9 비율 full-width 렌더링
  - progress bar (thin, cobalt blue) — `player.currentTime / duration`으로 계산
  - `playbackRate` prop 반영 (`player.playbackRate`)
  - `onTimeUpdate` 콜백 노출 (부모에서 타임스탬프 감지용)
- [ ] `app/shadowing/[id].tsx` 구현
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
- [ ] `ModeTab.tsx` 구현 — 알약(pill) 모양 세그먼트 컨트롤, `['1문장', '3문장', '전체']` 탭, 활성 탭 cobalt blue (`bg-blue-500`), 비활성 회색
- [ ] `ScriptArea.tsx` 구현
  - `scripts`, `currentIndex`, `blindMode` prop 수신
  - 현재 문장: `text-xl font-bold text-gray-900`
  - 나머지 문장: `opacity-30`
  - 한국어 번역: `text-sm text-gray-400` (blindMode >= 1이면 숨김)
  - 영어 스크립트: blindMode === 2이면 `opacity-0`
  - `ScrollView` + `scrollToIndex` 방식으로 현재 문장 자동 스크롤
- [ ] `[id].tsx`에 실제 ModeTab, ScriptArea 연결

**완료 기준:** 모드 탭 전환 시 UI 변경 확인, 문장 인덱스 변경 시 스크롤 이동 확인

---

### Phase 3: 핵심 인터랙션 + 완성

---

#### Task 033: Auto-pause + 루프 + 전체 모드 자동 스크롤 (핵심) `[rn-expo-frontend]`

**대상 파일:** `mobile-app/app/shadowing/[id].tsx`, `mobile-app/components/shadowing/VideoPlayer.tsx`

**구현 사항:**
- [ ] `onTimeUpdate` 콜백에서 현재 position으로 `currentSentenceIndex` 업데이트 로직 구현
  ```typescript
  const currentScript = scripts.find(s => position >= s.start && position < s.end);
  if (currentScript) setCurrentSentenceIndex(currentScript.index);
  ```
- [ ] **1문장 모드**: position이 현재 문장 `end_time` 초과 시 `player.pause()` 자동 실행
- [ ] **3문장 모드**: 3문장 블록 단위 계산 (index를 3으로 나눈 몫으로 블록 결정), 블록 마지막 문장 end_time 초과 시 pause
- [ ] **전체 모드**: pause 없이 스크립트만 자동 스크롤
- [ ] **루프 기능**: `isLooping=true`이고 position >= 현재 문장 end_time → `player.seek(start_time)`
- [ ] 루프 ON 시 Auto-pause 비활성화 (루프가 우선)

**완료 기준:** 1문장 모드에서 문장 끝마다 자동 정지 확인, 루프 ON 시 해당 문장만 반복 확인

---

#### Task 034: ControlBar — 보조 기능 전체 구현 `[rn-expo-frontend]`

**대상 파일:** `mobile-app/components/shadowing/ControlBar.tsx` (신규)

**구현 사항:**
- [ ] `ControlBar.tsx` 구현 — 아이콘 5개 배치 (좌2 / 중앙 마이크 / 우2)
  - 좌측: 🐢 속도 토글 (1.0x ↔ 0.75x) / 👁 블라인드 모드 순환 (0→1→2→0)
  - 우측: 📄 전체 스크립트 BottomSheet / 🔁 루프 토글
  - 중앙: 마이크 버튼 (크고 둥근 cobalt blue 원형, `isRecording` 상태 시 red pulse)
- [ ] 속도 토글 시 `setPlaybackRate()` + `player.playbackRate` 동기화
- [ ] 블라인드 모드 토글 시 `setBlindMode((prev + 1) % 3)` 순환
- [ ] 루프 토글 시 `setIsLooping(!isLooping)` + 활성 아이콘 cobalt blue 표시
- [ ] 마이크 버튼 Reanimated pulse 애니메이션 (`isRecording` 시 scale 1→1.15→1 반복)

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
