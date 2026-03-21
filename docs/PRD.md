# PRD: 문맥(Context) 기반 영어 말하기 연습 앱

> **버전:** 1.7.0 (진짜 최종 마감 버전)
> **최초 작성일:** 2026-03-21
> **최종 업데이트:** 2026-03-21
> **작성자:** Solo Developer
> **상태:** ✅ Final — 즉시 개발 착수 승인 (기술 검증 7회 완료, Critical/Major/Minor 이슈 전무)

### 변경 이력

| 버전 | 날짜 | 주요 변경 사항 |
|------|------|---------------|
| 1.0.0 | 2026-03-21 | 최초 작성 |
| 1.1.0 | 2026-03-21 | DB 스키마 확정(jsonb/turn_number), OpenAI API 통일, 성능 목표 현실화, 비용 방어 정책, KPI 신설 |
| 1.2.0 | 2026-03-21 | Major/Minor 이슈 전면 해소: 편집 팝업 원문 정의, KST 턴 리셋, users.last_login_at 추가, expressions TTS 정책 확정, Phase 0(EAS Build) 신설, Phase 1 API 추상화 지침, Phase 3 배포 요건 추가 |
| 1.3.0 | 2026-03-21 | TTS 전면 캐싱 포기(messages.tts_audio_url 삭제, /api/tts mp3 binary stream 통일), 내 발화 🔊 버튼 추가, 교정문 문장별 🔊 버튼 명세 추가, 대화 종료→홈 이동 AC 추가, STT 타이밍 통일(< 3초), D7 SQL 근사치 주석, API 에러 코드 표 신설 |
| 1.4.0 | 2026-03-21 | TTS React Native 구현 지침 명시(expo-file-system 임시 파일), Android m4a 녹음 설정 추가, 2-Step API 호출 흐름 확정(stt→messages), is_perfect JSON 구조 확정(null), is_perfect 🔊 숨김 규칙, Supabase 트리거 명시(updated_at), 시스템 프롬프트 필수 구성 섹션 신설, UI 디테일 확정(끝내기 버튼 위치/턴 수 계산/하이라이트 단위) |
| 1.5.0 | 2026-03-21 | API 추상화 전면 수정(transcribeAudio+sendMessage 2함수 분리, 콜백 방식 금지), playTTS 중단 메커니즘 코드 추가(_currentSound), API 응답 바디 명시(message_id+turn_number), source_sentence SQL CASE 수정(user_speech null 방지), User Flow "2~3초"→"<3초 이내" 통일, _base.txt 임포트 방식 명확화(fs.readFileSync 문자열 연결), 일일 턴 카운트 scope 명시(사용자 전체 합산) |
| 1.6.0 | 2026-03-21 | DB 스키마 수정(messages.user_id 컬럼 추가 — 턴 카운트 쿼리 오류 수정, expressions.source_block 컬럼 추가 — source_sentence 3분기 정확화), 표현 복습 SQL CASE source_block 기준 재작성, AUDIO_TOO_LONG 에러 발생 조건 명확화(백엔드 2차 방어선), TTS 오프라인 폴백 현실화(expo-speech Phase 2 이관) |
| 1.7.0 | 2026-03-21 | messages 복합 인덱스 생성 SQL 명시(idx_messages_user_turn_count), F-03 롱프레스 테이블에 source_block 매핑 열 추가, Phase 1 1-1/1-8 완료 기준 보완 |

---

## 목차

1. [제품 요약](#1-제품-요약)
2. [타겟 유저 및 해결하는 문제](#2-타겟-유저-및-해결하는-문제)
3. [성공 지표 (KPI)](#3-성공-지표-kpi)
4. [핵심 사용자 여정 (User Flow)](#4-핵심-사용자-여정-user-flow)
5. [상세 기능 요구사항](#5-상세-기능-요구사항)
6. [비기능 요구사항](#6-비기능-요구사항)
7. [데이터베이스 스키마 설계](#7-데이터베이스-스키마-설계)
8. [단계별 개발 로드맵](#8-단계별-개발-로드맵)

---

## 1. 제품 요약

### 한 줄 정의
> "말하고 싶은 게 생각났는데 어떻게 말하는지 모를 때, 부담 없이 연습하고, 나중에 문맥과 함께 다시 꺼내보는 영어 말하기 앱"

### 제품 개요

| 항목 | 내용 |
|------|------|
| **제품명** | (미정) — 예: ContextTalk, SpeakInContext |
| **플랫폼** | iOS / Android (React Native + Expo) |
| **핵심 가치** | 비동기 AI 대화 + 문맥 연동 표현 저장 |
| **차별점 (USP)** | 표현 저장 시 해당 대화의 전체 맥락이 세트로 묶여 저장됨 |
| **MVP 타겟 규모** | 지인 포함 최대 10명 (초기 API 비용 방어 목적) |

### 확정된 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| **Frontend** | React Native (Expo) | EAS Build Dev Client 필수 (Expo Go 제한) |
| **Backend** | Node.js (Express) | REST API 서버 |
| **Database** | Supabase (PostgreSQL) | Auth + DB + Storage 통합 |
| **STT** | OpenAI Whisper API | `whisper-1` 모델, m4a 포맷 |
| **LLM** | OpenAI GPT-4o-mini | 피드백 + 대화 응답 생성 |
| **TTS** | OpenAI TTS API | `tts-1` 모델, `nova` 보이스 (미국식 en-US 여성) |

> **API 통일 원칙:** STT, LLM, TTS를 모두 OpenAI API로 일원화하여 인증 관리, 대금 청구, 레이트 리밋 정책을 단일 대시보드에서 관리한다.

> **⚠️ Expo 환경 주의:** Apple Sign In 및 마이크 권한 테스트는 Expo Go 앱에서 동작하지 않는다. **EAS Build Dev Client** 빌드 환경이 필수이며, 개발 착수 전 Phase 0을 먼저 완료해야 한다. (8장 로드맵 참조)

### 기획 배경 및 문제 정의

기존 영어 학습 앱들은 다음 두 가지 한계를 가진다.

- **단어/표현 암기 앱:** 표현을 저장해 두어도 "이게 어떤 상황에서 쓰는 말이었더라?"라는 문맥 단절 문제 발생
- **실시간 전화 영어:** 즉각적인 응답 압박으로 학습보다 긴장감이 앞섬

본 앱은 **비동기(녹음 전송) 방식의 AI 대화**로 심리적 부담을 낮추고, **저장된 표현과 당시 대화 문맥을 항상 함께 보여주는** 방식으로 기억의 단절 문제를 근본적으로 해결한다.

---

## 2. 타겟 유저 및 해결하는 문제

### 타겟 유저 페르소나

**Primary Persona: "직장인 지민" (25~35세)**
- 업무상 영어 이메일은 쓰지만 스피킹에 자신이 없음
- 영어 학원이나 전화 영어를 등록했다가 부담감으로 며칠 만에 포기한 경험 있음
- 새로운 표현을 노트앱에 저장하지만 복습 시 맥락이 없어 외우지 못함
- 출퇴근 시간 10~20분 정도 짬을 내서 꾸준히 공부하고 싶음

**Secondary Persona: "영어 공부 재시작러 수현" (20대 후반~40대)**
- 영어를 배웠지만 실제 회화에서 막히는 경험 반복
- "배운 표현을 실제로 써보는 기회"가 없다고 느낌
- 발음이 맞는지 원어민 발음과 비교해 보고 싶음

### 해결하는 핵심 문제

| # | 문제 | 해결 방식 |
|---|------|-----------|
| 1 | 실시간 대화 압박 | 비동기 녹음 전송 방식 → 내 페이스대로 생각하고 말하기 |
| 2 | 문장 교정 피드백 부재 | 메시지 전송마다 AI가 문장별 교정 코멘트 제공 |
| 3 | 저장 표현의 문맥 단절 | 표현 저장 시 `conversation_id`로 원본 대화 전체가 자동 연결됨 |
| 4 | 원어민 발음 비교 불가 | 모든 영어 텍스트에 TTS 재생 버튼 제공 (OpenAI Nova 보이스) |

---

## 3. 성공 지표 (KPI)

> MVP 완료 시점(Phase 1 종료 후 2주)에 아래 지표를 기준으로 제품 지속 여부를 판단한다.

| 지표 | MVP 목표값 | 측정 기준 | 측정 방법 |
|------|-----------|-----------|-----------|
| **대화 완료율** | > **60%** | `content_type = 'user_speech'` 행이 3개 이상인 대화 비율 (사용자 발화 기준 3회 이상) | `COUNT(c) WHERE user_speech_count >= 3 / COUNT(c) * 100` |
| **표현 저장 전환율** | > **0.5개/대화** | 대화 1회당 평균 표현 저장 수 | `COUNT(expressions) / COUNT(conversations)` |
| **D7 리텐션** | > **20%** | 첫 사용 후 7일 이내 재방문 비율 | `users.last_login_at`과 `users.created_at` 기준 쿼리 |
| **AI JSON 파싱 에러율** | < **2%** | `content_type = 'ai_turn'` 저장 실패율 | 서버 로그 내 `error_type: 'json_parse_failure'` 발생 횟수 / 전체 AI 요청 수 |

---

## 4. 핵심 사용자 여정 (User Flow)

### 4-1. 전체 플로우 (인증 포함)

```
[앱 첫 실행]
    │
    ▼
[온보딩 화면 3장] ──── 슬라이드로 핵심 기능 소개
    │
    ▼
[소셜 로그인 강제] ──── Google / Apple (게스트 모드 없음)
    │
    ▼
[홈 화면] ─────────────────────── [표현 학습장 탭]
    │                                     │
    ▼                                     ▼
[주제 선택 → 대화 시작 / 기존 대화 재개]  [저장된 표현 목록]
    │                                     │
    ▼                                     ▼
[마이크 버튼(최대 30초) → 영어로 말하기]  [표현 클릭 → 원본 대화 문맥 보기]
    │
    ▼
[STT 변환 (< 3초 이내) → 채팅창에 텍스트 즉시 표시]
    │
    ▼
["AI가 문장을 교정하고 있어요 ✍️" 로딩 UI 표시]
    │
    ▼
[AI 응답 수신 (목표: STT 포함 전체 8초 이내)]
 ① 피드백 블록 (교정 내용 한국어)
 ② 다음 대화 블록 (영어)
    │
    ├─ [말풍선 블록 롱프레스] → [편집 팝업 → 텍스트 수정 후 저장]
    │
    └─ [스피커 아이콘 탭] → [TTS 재생 (Nova 보이스)]
```

### 4-2. 핵심 시나리오: 표현 저장 플로우 (확정 UX)

```
AI 응답 말풍선 수신 (피드백 블록 + 대화 응답 블록)
    │
    ▼
사용자가 저장하고 싶은 블록을 롱프레스
 ┌─ [피드백 블록 롱프레스] → 팝업에 corrected 텍스트 자동 채워짐
 └─ [대화 응답 블록 롱프레스] → 팝업에 next_response 텍스트 자동 채워짐
    │
    ▼
[편집 팝업 등장]
 - 텍스트 입력창에 원문이 자동으로 채워짐
 - 사용자가 불필요한 단어를 직접 지우고 핵심 표현만 남김
 - 예) "Oh, that's a great point, isn't it?" → "That's a great point."
 - 메모 입력란 (optional)
    │
    ▼
[저장 버튼 탭]
 - expressions 테이블에 expression_text + conversation_id + message_id 저장
    │
    ▼
[학습장 탭] → 표현 클릭 → 원본 대화창 형태로 복습
```

---

## 5. 상세 기능 요구사항

---

### F-01: 비동기 말하기 연습 (Chat UI)

**Description**
사용자가 타이핑 대신 음성으로 영어를 입력하는 비동기 채팅 인터페이스. 실시간 통화가 아니므로 생각할 시간을 가지고 자연스럽게 말할 수 있다.

**세부 동작**
- 화면 하단 마이크 버튼을 누르고 있는 동안 녹음 진행 (Push-to-talk 방식)
- **최대 녹음 시간: 30초.** 30초 초과 시 자동으로 녹음 종료 + 진동 피드백 후 STT 전송
- 버튼을 떼면 녹음이 종료되고 Whisper API로 오디오 전송 (m4a 포맷)
- **STT 변환 결과(내 텍스트)는 3초 이내에 채팅창 오른쪽 말풍선으로 즉시 표시**
- STT 표시 직후 **"AI가 문장을 교정하고 있어요 ✍️"** 타이핑 인디케이터가 왼쪽에 표시되며 AI 응답 대기
- 텍스트 직접 입력 모드도 보조 수단으로 제공 (키보드 아이콘으로 전환)
- 대화는 주제(Topic)별 세션으로 관리되며, 사용자가 직접 주제를 선택하거나 자유 대화 선택 가능

**클라이언트-서버 2-Step 호출 흐름 (확정)**

STT 결과를 AI 응답보다 먼저 화면에 표시하기 위해, 단일 API 호출이 아닌 **2단계 순차 호출** 방식을 사용한다:

```
① POST /api/stt   ← 오디오(m4a) 전송
   → 응답: { text: "I went to the store." }  (3초 이내)
   → [클라이언트] 사용자 말풍선 즉시 렌더링 + 타이핑 인디케이터 표시

② POST /api/conversations/:id/messages   ← { "text": "I went to the store." } 전송
   → 응답: { content: { feedback: [...], next_response: "..." } }  (8초 이내)
   → [클라이언트] AI 응답 블록 렌더링, 타이핑 인디케이터 제거
```

> **중요:** `POST /api/conversations/:id/messages`는 오디오가 아닌 **텍스트**를 수신한다. STT는 항상 ①단계에서 분리 처리한다.

**⚠️ Android m4a 녹음 설정 (필수)**

`expo-av`의 Android 기본 녹음 포맷은 m4a가 아니므로, Whisper API 오류(`invalid file format`) 방지를 위해 아래 설정을 **명시적으로 적용해야 한다:**

```javascript
await Audio.Recording.createAsync({
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
});
```

**일일 사용량 제한**
- 유저당 일일 대화 턴(Turn) **최대 20회** 제한
- **턴 카운트 범위:** 특정 대화 세션(conversation)과 무관하게, 해당 사용자의 하루 전체 `user_speech` 전송 횟수를 합산한다. 신규 대화든 기존 대화 재개든 동일한 카운터를 공유한다.
- 턴 카운터는 **한국 시간(KST) 기준 자정(00:00)에 리셋** (서버에서 UTC+9 환산 처리)
- 서버 미들웨어의 턴 카운트 쿼리: `SELECT COUNT(*) FROM messages WHERE user_id = :uid AND content_type = 'user_speech' AND created_at >= :kst_today_start`
- 20회 소진 시 "오늘의 연습을 모두 완료했어요! 내일 다시 만나요 🎉" 메시지 표시 후 입력 잠금

**Acceptance Criteria**
- [ ] 마이크 버튼을 누르면 녹음 시작 인디케이터(파형 애니메이션)가 표시된다
- [ ] 녹음 시간이 30초에 도달하면 자동 전송되고 진동 피드백이 제공된다
- [ ] `/api/stt` 응답 수신 후 3초 이내에 STT 결과가 오른쪽 말풍선으로 표시된다
- [ ] STT 말풍선 표시 직후 타이핑 인디케이터가 나타나고 `/api/conversations/:id/messages` 호출이 시작된다
- [ ] AI 응답 수신 후 타이핑 인디케이터가 사라지고 AI 응답 블록이 렌더링된다
- [ ] STT 변환 실패(`STT_FAILED`) 시 "다시 말하기" 버튼이 표시된다
- [ ] 변환된 내 텍스트는 오른쪽, AI 응답은 왼쪽 말풍선으로 구분된다
- [ ] 마이크 사용 권한이 없을 경우 권한 요청 팝업이 표시된다
- [ ] 일일 20턴 소진 시 입력 UI가 비활성화되고 안내 메시지가 표시된다
- [ ] KST 자정이 지나면 턴 카운터가 리셋되고 입력 UI가 다시 활성화된다
- [ ] 내 발화 말풍선 우측에 🔊 TTS 버튼이 표시되며, 탭 시 해당 텍스트를 Nova 보이스로 재생한다

---

### F-02: AI 문장별 피드백 및 대화 진행

**Description**
사용자 메시지 수신 시, AI는 즉시 대화를 이어가지 않고 **먼저 사용자의 발화에 대한 교정 피드백**을 제공한 뒤, **자연스러운 대화 응답**을 이어간다.

**AI 응답 구조 (화면 표시)**
```
┌─────────────────────────────────────────┐
│ [피드백 블록] (배경색 구분)               │
│                                         │
│ ✏️ "I am go to the store yesterday."   │
│ ✅  "I went to the store yesterday." 🔊 │  ← 교정문마다 개별 🔊
│ 💬 동사 'go'는 과거형 'went'로 써야 해요!│
│                                         │
│ ✏️ "I buyed some apples."              │
│ ✅  "I bought some apples."          🔊 │  ← 교정문마다 개별 🔊
│ 💬 buy의 과거형은 bought이에요!          │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ [대화 응답 블록] (일반 말풍선)            │
│                                         │
│ Oh, what did you buy at the store?      │
│                                    🔊   │
└─────────────────────────────────────────┘
```

> **🔊 버튼 배치 원칙:**
> - `feedback[].is_perfect = false` 항목: `corrected` 텍스트 옆에 각각 🔊 버튼 1개
> - `feedback[].is_perfect = true` 항목: 🔊 버튼 **미표시** (corrected가 null이므로)
> - `next_response`: 블록 우측에 🔊 버튼 1개
>
> 즉, 오류 교정이 N개이고 완벽 항목이 M개이면 🔊 버튼 수 = **N + 1개** (내 발화 🔊 제외)

**LLM 응답 포맷 명세 (확정)**

LLM은 반드시 아래 JSON 구조로 응답해야 한다. 백엔드는 시스템 프롬프트에 JSON 응답 강제 지시(`response_format: { type: "json_object" }`)를 포함한다.

```json
{
  "feedback": [
    {
      "original": "I am go to the store yesterday.",
      "corrected": "I went to the store yesterday.",
      "comment": "동사 'go'는 과거형 'went'로 써야 해요. 어제 일어난 일이니까요!",
      "is_perfect": false
    }
  ],
  "next_response": "Oh, what did you buy at the store?"
}
```

> **필드 규칙:**
> - `feedback`: 사용자 발화 문장 수만큼 배열 원소 생성
> - `feedback[].is_perfect = true` 일 때: **`original`과 `corrected`는 반드시 `null`로 설정**하고, `comment`는 칭찬 문구로 채운다. 클라이언트는 `corrected === null`을 조건으로 교정문 영역을 숨기고 칭찬 코멘트만 표시한다.
>
>   ```json
>   // is_perfect = true 예시
>   { "original": null, "corrected": null, "comment": "완벽한 문장이에요! 👏", "is_perfect": true }
>   ```
>
> - `feedback[].is_perfect = true` 항목에는 **🔊 버튼을 표시하지 않는다.** 교정문이 없으므로 재생할 텍스트가 없다. 사용자는 내 발화 말풍선의 🔊 버튼으로 원문을 청취할 수 있다.
> - `next_response`: AI의 다음 대화 발화 (항상 영어)
> - JSON 파싱 실패 시 최대 2회 재시도. 재시도 최종 실패 시 "AI 응답 생성에 실패했어요. 다시 시도해 주세요." 토스트 표시 후 입력 활성화
> - 서버는 파싱 실패 시 `error_type: 'json_parse_failure'`를 로그에 기록하여 KPI 에러율 측정에 활용

**LLM 컨텍스트 전송 정책 (비용 방어)**

```
[시스템 프롬프트 (topic_id 기반)]
 + [최근 6턴 대화 이력: 사용자 3회 + AI 3회]  ← 엄격한 슬라이딩 윈도우
 + [현재 사용자 발화]
```

> 대화가 6턴을 초과하면 가장 오래된 턴부터 제거한다. 7턴 이상 이전 내용은 LLM에 전달되지 않는다.

**피드백 정책**
- 사용자가 말한 모든 문장에 피드백 제공 (문장이 2개 이상이면 각각 따로)
- 문법 오류, 어색한 표현, 더 자연스러운 대안 표현 제시
- 완벽한 문장은 칭찬으로 자신감 강화
- 피드백은 한국어로, AI 대화 응답은 영어로 제공

**Acceptance Criteria**
- [ ] AI 응답 메시지는 피드백 블록과 대화 응답 블록이 시각적으로 구분된다 (배경색 또는 구분선)
- [ ] 피드백은 원문(취소선) → 교정문(강조) → 코멘트 순서로 표시된다
- [ ] 사용자 문장이 완벽할 경우 "Perfect!" 형태의 긍정 피드백이 표시된다
- [ ] STT 결과 표시부터 AI 전체 응답 표시까지 8초 이내에 완료된다 (Phase 1 목표)
- [ ] AI 대기 중에는 타이핑 인디케이터가 표시된다
- [ ] JSON 파싱 최종 실패 시 에러 토스트와 함께 입력이 활성화된다
- [ ] `feedback[].is_perfect = false` 항목의 `corrected` 텍스트 옆에 개별 🔊 버튼이 표시된다
- [ ] `feedback[].is_perfect = true` 항목에는 🔊 버튼이 표시되지 않고 칭찬 코멘트만 표시된다
- [ ] 대화 응답 블록(`next_response`) 우측에 🔊 버튼이 표시된다

**LLM 시스템 프롬프트 필수 구성 요소 (확정)**

`ai-server/prompts/{topic_id}.txt`에 작성하는 시스템 프롬프트는 반드시 아래 4개 구성 요소를 포함해야 한다. 누락 시 JSON 파싱 에러율 KPI가 악화될 수 있다.

| # | 구성 요소 | 프롬프트 지시 예시 |
|---|-----------|------------------|
| ① | **역할/상황 부여** | "You are a US immigration officer at JFK airport..." |
| ② | **JSON 형식 강제** | "You MUST respond ONLY with a valid JSON object in this exact format: `{ \"feedback\": [...], \"next_response\": \"...\" }`. Do not include any text outside the JSON." |
| ③ | **피드백 한국어 지시** | "All `comment` fields in the feedback array MUST be written in Korean." |
| ④ | **문장별 분리 교정 + is_perfect 처리** | "Split the user's message into individual sentences and provide feedback for each. If a sentence is grammatically perfect and natural, set `is_perfect: true`, `original: null`, `corrected: null`, and write an encouraging comment in Korean." |

> **프롬프트 조립 방식 (확정):** 각 `topic_id.txt` 파일은 ①(역할/상황)만 다르고, ②③④(JSON 강제/한국어/문장분리)는 모든 주제에서 동일한 내용을 공유한다. 공통 지시사항은 `ai-server/prompts/_base.txt`에 작성한다. Node.js 백엔드에서 `fs.readFileSync`로 두 파일을 읽어 **문자열 연결(concatenation)** 하여 시스템 프롬프트를 조립한다:
>
> ```javascript
> // ai-server/utils/buildPrompt.js
> const fs = require('fs');
> const path = require('path');
>
> function buildSystemPrompt(topicId) {
>   const base = fs.readFileSync(path.join(__dirname, '../prompts/_base.txt'), 'utf-8');
>   const topic = fs.readFileSync(path.join(__dirname, `../prompts/${topicId}.txt`), 'utf-8');
>   return `${topic}\n\n${base}`;  // 역할 먼저, 공통 지시 나중
> }
> ```

---

### F-03: 문맥 연동 표현 저장 ★ (핵심 USP)

**Description**
채팅 화면의 말풍선 블록을 롱프레스하면 편집 팝업이 열리고, 사용자가 텍스트를 수정하여 핵심 표현만 추출해 저장할 수 있다. 이때 해당 표현이 등장한 **대화 전체 문맥이 `conversation_id`를 통해 자동으로 연결**된다.

**확정된 저장 UX 프로세스**

1. 저장하고 싶은 말풍선의 **특정 블록**을 롱프레스
2. 블록 종류에 따라 팝업 원문과 저장되는 `source_block` 값이 자동으로 결정됨:

   | 롱프레스 대상 | 팝업에 채워지는 원문 | `source_block` 저장값 |
   |--------------|---------------------|-----------------------|
   | 피드백 블록 (교정문 영역) | `feedback[].corrected` 텍스트 | `'feedback'` |
   | 대화 응답 블록 | `next_response` 텍스트 | `'response'` |
   | 내 발화 말풍선 | `content.text` 텍스트 | `'user_speech'` |

3. 사용자가 팝업 텍스트 입력창에서 불필요한 부분을 직접 지우고 핵심 표현만 남김
   - 예) `"Oh, that's a great point, isn't it?"` → `"That's a great point."`
4. 메모 입력란에 선택적 메모 추가 (예: "동의할 때 쓰는 표현")
5. 저장 버튼 탭 → DB 저장 완료

**저장 데이터 구조**
- `expressions` 테이블에 `expression_text` + `conversation_id` + `message_id` + `source_block` 저장
- 동일 `conversation_id`에서 N개의 표현을 저장해도 `conversations` 레코드는 1건만 존재

**Acceptance Criteria**
- [ ] 피드백 블록 롱프레스 시 팝업에 `corrected` 텍스트가 자동으로 채워진다
- [ ] 대화 응답 블록 롱프레스 시 팝업에 `next_response` 텍스트가 자동으로 채워진다
- [ ] 사용자 발화 말풍선 롱프레스 시 팝업에 `content.text` 텍스트가 자동으로 채워진다
- [ ] 사용자가 팝업 내 텍스트를 직접 수정할 수 있다
- [ ] 저장 완료 시 토스트 메시지로 성공 피드백이 표시된다
- [ ] 이미 저장된 표현이 있는 말풍선에는 북마크 아이콘이 표시된다
- [ ] 동일 대화에서 3개의 표현을 저장해도 DB에는 `conversation_id` 참조 1개만 추가된다
- [ ] 저장 출처 블록(`source_block`)이 올바르게 기록된다 (피드백 블록=`'feedback'` / 대화 응답 블록=`'response'` / 내 발화=`'user_speech'`)

---

### F-04: 표현 리뷰 학습장 (Expression Study Tab)

**Description**
저장된 모든 표현을 카드 형태로 모아볼 수 있는 별도 탭. 표현 클릭 시 해당 표현이 처음 등장한 원본 대화 문맥을 대화창 형태로 다시 보여준다.

**표현 카드 구성**
```
┌─────────────────────────────────────┐
│  "That's a great point."            │
│  💬 저장된 대화: "미국 입국 심사"    │
│  📅 2026-03-21                      │
│  🔊 [발음 듣기]                      │
│  📝 내 메모: 동의할 때 쓰는 표현     │
└─────────────────────────────────────┘
```

**클릭 후 상세 화면 구성**
- 상단: 저장한 표현 강조 표시
- 중간: 해당 표현이 등장한 원본 대화 문맥 (채팅 UI 형태, 읽기 전용)
  - 해당 표현이 있는 말풍선은 하이라이트 처리
- 하단: AI 생성 추가 예문 2~3개 (선택적 로드 — "예문 더 보기" 버튼)

**Acceptance Criteria**
- [ ] 표현 학습장 탭에서 저장된 표현이 저장일 역순으로 표시된다
- [ ] 표현 카드 탭 시 원본 대화 문맥이 채팅창 형태로 열린다
- [ ] 원본 대화에서 해당 표현이 포함된 **`ai_turn` 블록 전체**가 강조(하이라이트)된다 (feedback 항목 단위 하이라이트는 Phase 2 이후 고려)
- [ ] 표현 삭제 기능이 있으며, 삭제 전 확인 팝업이 표시된다
- [ ] "예문 더 보기" 버튼 탭 시 AI가 같은 표현을 쓴 예문 2~3개를 생성해서 보여준다
- [ ] ~~학습장 내 검색 기능~~ → **Phase 2로 이관** (MVP 범위 외)

---

### F-05: 원어민 발음 듣기 (TTS)

**Description**
앱 내 모든 영어 텍스트에 TTS 재생 버튼을 제공. OpenAI TTS API의 `nova` 보이스(미국식 en-US)를 기본값으로 고정한다.

**TTS 적용 대상 및 캐싱 정책**

| 위치 | 텍스트 출처 | 캐싱 방식 |
|------|------------|-----------|
| 채팅창 — AI 교정문 | `feedback[].corrected` (항목별) | **캐싱 없음. 🔊 탭 시 매번 `/api/tts` 호출** |
| 채팅창 — AI 대화 응답 | `next_response` | **캐싱 없음. 🔊 탭 시 매번 `/api/tts` 호출** |
| 채팅창 — 내 발화 | `content.text` | **캐싱 없음. 🔊 탭 시 매번 `/api/tts` 호출** |
| 학습장 — 저장된 표현 | `expression_text` | **캐싱 없음. 🔊 탭 시 매번 `/api/tts` 호출** |
| 학습장 — 추가 예문 | AI 생성 텍스트 | **캐싱 없음. 🔊 탭 시 매번 `/api/tts` 호출** |

> **전면 캐싱 포기 근거 (v1.3에서 확정, v1.4 유지):**
> - `messages.tts_audio_url` 단일 컬럼으로는 피드백 배열 내 N개 교정문의 TTS URL을 모두 저장할 수 없음 (1열 vs N URL 구조적 불일치)
> - Supabase Storage URL 관리(만료, 404 재생성), 컬럼 관리 복잡도를 감안하면 MVP 10인 규모에서 캐싱의 비용 절감 효과가 복잡도 비용보다 작음
> - 따라서 **모든 TTS는 캐싱 없이 `/api/tts`를 매번 호출**하며, 응답은 **mp3 binary stream (Content-Type: audio/mpeg)** 으로 직접 반환한다. DB에 URL을 저장하지 않는다.

**`/api/tts` 응답 명세 및 클라이언트 구현 지침 (확정)**

- 요청: `POST /api/tts` — body `{ "text": "..." }`
- 응답: **mp3 binary stream** (Content-Type: `audio/mpeg`) — URL 반환 없음

> **⚠️ React Native 구현 필수 지침:** `expo-av`는 URI 기반으로만 오디오를 재생할 수 있어 HTTP binary response를 직접 재생할 수 없다. 반드시 아래 순서로 구현해야 한다. 또한 F-05의 "재생 중 다른 🔊 탭 시 즉시 중지" 요구사항을 위해 **모듈 레벨 변수 `_currentSound`로 재생 상태를 추적**하는 중단 메커니즘을 포함해야 한다:
>
> ```javascript
> // mobile-app/api/chat.js — playTTS 구현 예시 (중단 메커니즘 포함)
> import * as FileSystem from 'expo-file-system';
> import { Audio } from 'expo-av';
>
> // 모듈 레벨: 현재 재생 중인 사운드 객체 추적
> let _currentSound = null;
>
> export async function playTTS(text) {
>   // ① 기존 재생 중인 오디오가 있으면 즉시 중단
>   if (_currentSound) {
>     await _currentSound.stopAsync();
>     await _currentSound.unloadAsync();
>     _currentSound = null;
>   }
>
>   const response = await fetch(`${API_BASE}/api/tts`, {
>     method: 'POST',
>     headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
>     body: JSON.stringify({ text }),
>   });
>   // ② binary → base64 변환
>   const blob = await response.blob();
>   const reader = new FileReader();
>   const base64 = await new Promise((resolve) => {
>     reader.onloadend = () => resolve(reader.result.split(',')[1]);
>     reader.readAsDataURL(blob);
>   });
>   // ③ FileSystem.cacheDirectory에 임시 파일 저장
>   const fileUri = FileSystem.cacheDirectory + `tts_${Date.now()}.mp3`;
>   await FileSystem.writeAsStringAsync(fileUri, base64, {
>     encoding: FileSystem.EncodingType.Base64,
>   });
>   // ④ 저장된 URI로 expo-av 재생 + 모듈 변수에 등록
>   const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
>   _currentSound = sound;
>   await sound.playAsync();
>   // ⑤ 재생 완료 후 정리
>   sound.setOnPlaybackStatusUpdate((status) => {
>     if (status.didJustFinish) {
>       sound.unloadAsync();
>       FileSystem.deleteAsync(fileUri, { idempotent: true });
>       _currentSound = null;
>     }
>   });
> }
> ```
>
> 필요 패키지: `expo-file-system`, `expo-av` (모두 Expo SDK 기본 포함)

**세부 동작**
- 스피커 아이콘(🔊) 탭 → 해당 문장 재생
- 재생 중 아이콘은 활성화 상태로 변경 (정지 아이콘으로 전환)
- 재생 중 다른 TTS 버튼 탭 시 현재 재생 중지 후 새 문장 재생
- 디바이스 볼륨 설정을 따름

**Acceptance Criteria**
- [ ] AI 교정문(`feedback[].corrected`) 항목마다 스피커 아이콘이 표시된다
- [ ] AI 대화 응답(`next_response`) 우측에 스피커 아이콘이 표시된다
- [ ] 내 발화 말풍선 우측에 스피커 아이콘이 표시된다
- [ ] 학습장 표현 카드의 스피커 아이콘이 표시된다
- [ ] 모든 스피커 아이콘 탭 시 `/api/tts`를 호출하여 mp3를 `FileSystem.cacheDirectory`에 임시 저장하고 `expo-av`로 재생한다
- [ ] TTS 재생 중에는 아이콘이 시각적으로 활성화 상태로 표시된다
- [ ] 재생 완료 후 아이콘이 비활성화 상태로 자동 복귀한다
- [ ] 재생 중 다른 🔊 버튼 탭 시 현재 재생을 즉시 중지하고 새 문장을 재생한다
- [ ] TTS API 오류 시 에러 토스트를 표시한다

---

### F-06: 대화 주제 선택 및 세션 관리

**Description**
사용자가 대화 시작 시 주제를 선택할 수 있으며, 대화는 세션(conversation) 단위로 저장된다. 각 주제는 LLM 시스템 프롬프트의 `scenario` 필드로 주입된다.

**확정된 주제 목록 (초기 MVP)**

| # | topic_id | topic_label | AI 시스템 프롬프트 도입부 예시 |
|---|----------|-------------|-------------------------------|
| 1 | `free_talk` | 자유 대화 | "You are a friendly English conversation partner. Chat naturally." |
| 2 | `cafe_order` | 호주 카페에서 커피 주문하기 | "You are a barista at a Sydney café. The user wants to order coffee." |
| 3 | `airport_immigration` | 미국 공항 입국 심사 | "You are a US immigration officer at JFK airport. Interview the user." |
| 4 | `hotel_checkin` | 캐나다 호텔 체크인 | "You are a front desk agent at a Vancouver hotel. Help the user check in." |
| 5 | `small_talk` | 직장 동료와 스몰톡 | "You are a friendly coworker. Make casual conversation about daily life." |
| 6 | `opinion` | 의견 말하기 | "You are a conversation partner. Ask the user's opinions on everyday topics." |

> 시스템 프롬프트 파일은 `ai-server/prompts/{topic_id}.txt`에서 관리한다.

**Acceptance Criteria**
- [ ] 새 대화 시작 시 주제 선택 화면이 표시된다
- [ ] 홈 화면에서 이전 대화 목록을 확인하고 탭 시 이어서 진행할 수 있다
- [ ] 홈 화면의 FAB(+) 버튼으로 새 대화를 시작할 수 있다
- [ ] 대화 목록에는 `topic_label`, 마지막 대화 시간, 대화 턴 수가 표시된다
- [ ] "대화 끝내기" 버튼은 **채팅 화면 헤더 우상단**에 위치한다
- [ ] "대화 끝내기" 탭 시 확인 팝업 없이 즉시 홈 화면으로 이동한다 (대화 데이터는 이미 턴마다 DB에 저장되므로 별도 저장 로직 불필요)
- [ ] 대화 목록의 "대화 턴 수"는 해당 conversation의 `content_type = 'user_speech'` 행의 개수로 계산한다

---

### F-07: 온보딩 및 소셜 로그인

**Description**
앱 첫 실행 시 핵심 기능을 소개하는 온보딩 화면을 보여준 뒤 소셜 로그인을 강제한다. **게스트 모드는 제공하지 않는다.**

**온보딩 슬라이드 (3장)**
1. "AI 선생님과 부담 없이 영어로 대화해요" (비동기 채팅 이미지)
2. "틀린 표현은 즉시 교정! 완벽하면 칭찬!" (피드백 UI 이미지)
3. "배운 표현은 대화 문맥과 함께 저장" (학습장 이미지)

**Acceptance Criteria**
- [ ] 앱 첫 실행 시 온보딩 슬라이드 3장이 표시된다
- [ ] 슬라이드 마지막 페이지에 "Google로 시작하기" / "Apple로 시작하기" 버튼이 표시된다
- [ ] 로그인 없이는 홈 화면 진입이 불가능하다
- [ ] 재실행 시(로그인 유지 상태) 온보딩을 건너뛰고 홈 화면으로 직행한다
- [ ] 로그인 성공 시 `users.last_login_at`이 현재 시각으로 업데이트된다

---

## 6. 비기능 요구사항

### 6-1. 성능 목표

| 항목 | Phase 1 (MVP) 목표 | Phase 2 목표 | 측정 기준 |
|------|-------------------|-------------|-----------|
| STT 변환 표시 | < **3초** | < 2초 | 버튼 뗀 시점 ~ 말풍선 표시 |
| AI 전체 응답 완료 | < **8초** | < 3초 (스트리밍) | STT 표시 시점 ~ AI 말풍선 완전 표시 |
| TTS 재생 시작 | < **3초** | < 2초 | 버튼 탭 시점 ~ 오디오 재생 시작 (캐싱 없음, 항상 API 호출) |
| 표현 저장 완료 | < **1초** | < 1초 | 저장 버튼 탭 ~ 토스트 표시 |
| 앱 콜드 스타트 | < **3초** | < 3초 | 앱 아이콘 탭 ~ 홈 화면 표시 |

> **Phase 1 UX 전략:** 스트리밍 없이도 체감 속도를 높이기 위해, STT 결과를 AI 응답과 분리하여 먼저 표시하고 타이핑 인디케이터로 대기 시간을 시각화한다. 스트리밍 적용은 Phase 2에서 구현한다.

### 6-2. 모바일 권한 요구사항

| 권한 | 용도 | 요청 시점 |
|------|------|-----------|
| 마이크 (Microphone) | STT 녹음 | 첫 대화 시작 시 |
| 인터넷 (Network) | API 통신 | 앱 실행 시 |
| 오디오 재생 | TTS 출력 | 기본 권한, 별도 요청 불필요 |

- 권한 거부 시: 해당 기능 비활성화 + 안내 메시지 + 설정 이동 버튼 제공
- 마이크 권한 없이도 텍스트 직접 입력 모드로 앱 사용 가능 (폴백)

### 6-3. 오프라인 처리

| 상황 | 처리 방식 |
|------|-----------|
| 대화 중 네트워크 끊김 | 토스트 알림 + 입력 비활성화 (재연결 시 자동 복구) |
| 표현 학습장 오프라인 조회 | 기존 저장 데이터는 로컬 캐시로 열람 가능 |
| TTS 오프라인 | "음성을 불러올 수 없습니다" 토스트 알림 표시. (expo-speech를 활용한 내장 TTS 폴백은 Phase 2로 이관) |

### 6-4. 보안 및 인증

- Supabase Auth 사용 (Google / Apple 소셜 로그인)
- JWT 기반 API 인증, 토큰 만료 시 자동 갱신 (`supabase.auth.getUser(token)` 서버사이드 검증)
- 사용자는 자신의 대화와 표현 데이터만 접근 가능 (Row Level Security 적용)
- **원본 녹음 오디오 파일은 STT 변환 후 즉시 폐기, 서버에 저장하지 않음**
- TTS 합성 결과물(AI가 생성한 음성)은 DB나 Storage에 저장하지 않음 (매번 신규 생성, binary stream 반환)

### 6-5. API 비용 방어 정책

| 정책 | 내용 |
|------|------|
| 일일 턴 제한 | 유저당 **20회/일**, KST 자정 리셋 (서버 미들웨어에서 검증) |
| MVP 초대 제한 | 최대 **10명** (초대 코드 또는 화이트리스트 방식) |
| LLM 컨텍스트 제한 | 최근 **6턴** (토큰 상한 방어) |
| 최대 녹음 시간 | **30초** (긴 오디오로 인한 Whisper 비용 방어) |
| 비용 경보 | OpenAI 대시보드에서 월 $20 초과 시 이메일 경보 설정 |

### 6-6. 접근성

- 최소 폰트 크기: 14sp (텍스트 가독성 확보)
- 컬러 대비: WCAG AA 기준 이상
- 스피커 버튼, 마이크 버튼 터치 영역 최소 44×44pt 확보

---

## 7. 데이터베이스 스키마 설계

### 핵심 설계 원칙

> 1. **AI 응답 1회 = DB 1행.** AI 응답의 피드백 배열과 다음 대화 텍스트는 `jsonb` 타입의 단일 `content` 컬럼에 저장한다.
> 2. **사용자 발화 1회 = DB 1행.** 여러 문장을 말해도 1번의 전송은 1개 행으로 저장된다.
> 3. **문맥은 `conversation_id`로 공유.** 같은 대화에서 N개의 표현을 저장해도 대화 데이터는 1건만 존재하며 `expressions`가 `conversation_id`로 참조한다.
> 4. **TTS는 전면 캐싱 없음.** `messages` 및 `expressions` 어디에도 TTS URL 컬럼을 두지 않는다. 모든 🔊 탭은 `/api/tts`를 호출하고, 클라이언트는 mp3를 `expo-file-system` 임시 파일로 저장 후 `expo-av`로 재생한다.

### ERD 개념도

```
users (last_login_at 포함)
  │
  ├──< conversations (1:N)
  │       │  topic_id + topic_label
  │       │
  │       └──< messages (1:N)
  │               │  turn_number(순서), content(jsonb)
  │               │
  │               └──< expressions (1:N) ← message_id + conversation_id 참조
  │
  └──< expressions (via user_id)
```

### 테이블 정의

#### `users`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid PK | Supabase Auth UID와 동기화 |
| `email` | text | 로그인 이메일 |
| `display_name` | text | 앱 내 표시 이름 |
| `created_at` | timestamptz | 가입일 |
| `last_login_at` | timestamptz | 마지막 로그인 시각 (로그인 성공 시 업데이트, D7 리텐션 KPI 측정용) |

---

#### `conversations`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid PK | 대화 세션 ID |
| `user_id` | uuid FK → users | 소유자 |
| `topic_id` | text NOT NULL | 주제 식별자 (예: `airport_immigration`) |
| `topic_label` | text NOT NULL | 표시명 (예: `미국 공항 입국 심사`) |
| `created_at` | timestamptz | 대화 시작 시간 |
| `updated_at` | timestamptz | 마지막 메시지 시간 (**Supabase 트리거로 자동 갱신** — 아래 트리거 명세 참조) |

> **`updated_at` 자동 갱신 트리거:** 홈 화면의 대화 목록을 "마지막 대화 시간" 기준으로 정렬하려면 메시지 추가 시 이 값이 자동으로 갱신되어야 한다. 백엔드 코드에서 명시적으로 UPDATE하는 대신 **Supabase Database Trigger**를 사용한다:
>
> ```sql
> -- Supabase SQL Editor에서 1회 실행
> CREATE OR REPLACE FUNCTION update_conversation_timestamp()
> RETURNS TRIGGER AS $$
> BEGIN
>   UPDATE conversations
>   SET updated_at = NOW()
>   WHERE id = NEW.conversation_id;
>   RETURN NEW;
> END;
> $$ LANGUAGE plpgsql;
>
> CREATE TRIGGER trigger_update_conversation_on_message
> AFTER INSERT ON messages
> FOR EACH ROW
> EXECUTE FUNCTION update_conversation_timestamp();
> ```
>
> Phase 1 step 1-1 완료 기준에 이 트리거 실행 확인을 포함한다.

---

#### `messages`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid PK | 메시지 ID |
| `conversation_id` | uuid FK → conversations | 소속 대화 |
| `user_id` | uuid FK → users | 메시지 소유자 (일일 턴 카운트 직접 조회용, JOIN 없이 단순 WHERE 조건으로 처리 가능. 비정규화 허용) |
| `turn_number` | int NOT NULL | 대화 순서 (1부터 증가, 순서 보장용) |
| `role` | enum('user', 'assistant') | 발화 주체 |
| `content` | jsonb NOT NULL | 메시지 본문 (아래 구조 참조) |
| `content_type` | enum('user_speech', 'ai_turn') | 메시지 종류 |
| `created_at` | timestamptz | 전송 시간 |

**`content` jsonb 구조:**

```json
// content_type = 'user_speech' (사용자 발화)
{
  "text": "I am go to the store yesterday."
}

// content_type = 'ai_turn' (AI 응답 1턴 전체)
{
  "feedback": [
    {
      "original": "I am go to the store yesterday.",
      "corrected": "I went to the store yesterday.",
      "comment": "동사 'go'는 과거형 'went'로 써야 해요!",
      "is_perfect": false
    }
  ],
  "next_response": "Oh, what did you buy at the store?"
}
```

> **설계 근거:** `content_type = 'ai_turn'` 단일 행에 피드백 배열과 대화 응답을 함께 저장함으로써, F-03 표현 저장 시 `message_id` 참조가 명확해지고, LLM 컨텍스트 재구성 시 단순 쿼리로 처리 가능해진다. TTS는 전면 캐싱 없이 매번 API를 호출하므로 messages 테이블에 TTS URL 컬럼이 존재하지 않는다. `user_id` 컬럼은 일일 턴 카운트 미들웨어가 `JOIN` 없이 직접 조회할 수 있도록 비정규화로 추가하며, `(user_id, content_type, created_at)` 복합 인덱스로 매 요청 성능을 최적화한다.

> **복합 인덱스 생성 (Supabase SQL Editor에서 1회 실행):**
>
> ```sql
> CREATE INDEX idx_messages_user_turn_count
> ON messages (user_id, content_type, created_at);
> ```
>
> 이 인덱스가 없으면 일일 턴 카운트 미들웨어가 매 API 요청마다 messages 테이블 full scan을 실행한다. Phase 1 step 1-1 완료 기준에 이 인덱스 생성 확인을 포함한다.

---

#### `expressions`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid PK | 표현 ID |
| `user_id` | uuid FK → users | 소유자 |
| `conversation_id` | uuid FK → conversations | 문맥 연결 (핵심) |
| `message_id` | uuid FK → messages | 표현이 등장한 메시지 |
| `expression_text` | text NOT NULL | 저장한 표현 (팝업에서 사용자가 편집한 최종본) |
| `source_block` | text NOT NULL | 저장 출처 블록: `'user_speech'` / `'feedback'` / `'response'` — 복습 탭 source_sentence 정확 분기용 |
| `user_memo` | text nullable | 사용자 메모 |
| `created_at` | timestamptz | 저장 시간 |

> **TTS 캐싱 없음:** `expression_text`는 사용자가 편집한 텍스트로 원본 메시지와 다를 수 있어 `messages.tts_audio_url` 재사용 불가. 학습장 TTS는 매번 API를 새로 호출하는 방식으로 구현 복잡도를 최소화한다. `source_block`은 저장 시 클라이언트가 전달하며(`'user_speech'` / `'feedback'` / `'response'`), 복습 탭의 source_sentence SQL이 이 값을 기준으로 정확한 원문을 3분기하여 반환한다.

---

### 표현 복습 시 데이터 조회 흐름

```sql
-- 1. 사용자의 표현 목록 조회 (학습장 탭)
-- source_sentence: expressions.source_block 기준으로 원문을 3분기하여 정확히 반환
--   'user_speech' → 사용자 발화 원문(content.text)
--   'feedback'    → AI 교정문(feedback[0].corrected) ⚠️ 근사치: feedback 배열 첫 번째 항목 고정.
--                   다중 피드백에서 정확한 항목 특정이 필요하면 Phase 2에서 expressions.feedback_index 컬럼 추가 검토
--   'response'    → AI 대화 응답(content.next_response)
SELECT
  e.id,
  e.expression_text,
  e.source_block,
  e.user_memo,
  e.created_at,
  c.topic_label,
  CASE e.source_block
    WHEN 'user_speech' THEN m.content->>'text'
    WHEN 'feedback'    THEN m.content->'feedback'->0->>'corrected'
    WHEN 'response'    THEN m.content->>'next_response'
    ELSE                    m.content->>'text'
  END AS source_sentence
FROM expressions e
JOIN conversations c ON e.conversation_id = c.id
JOIN messages m ON e.message_id = m.id
WHERE e.user_id = auth.uid()
ORDER BY e.created_at DESC;

-- 2. 특정 표현 클릭 시: 원본 대화 전체 메시지 로드
SELECT
  id,
  turn_number,
  role,
  content,
  content_type
FROM messages
WHERE conversation_id = :conversation_id
ORDER BY turn_number ASC;

-- 3. D7 리텐션 KPI 측정 (개발자용)
-- ⚠️ 근사치 주의: last_login_at은 "마지막" 로그인 시각이므로, 가입 후 7일 이내에
-- 재방문했지만 그 이후에도 계속 사용한 유저는 last_login_at이 7일을 초과하여
-- D7 리텐션에서 누락될 수 있다. MVP 10인 규모에서는 수작업 보완이 가능하나,
-- 정확한 코호트 측정은 Phase 2에서 별도 login_events 테이블 도입을 검토한다.
SELECT
  COUNT(*) FILTER (
    WHERE last_login_at >= created_at + INTERVAL '1 day'
    AND last_login_at <= created_at + INTERVAL '7 days'
  ) * 100.0 / COUNT(*) AS d7_retention_pct
FROM users;
```

---

### RLS (Row Level Security) 정책

```sql
-- conversations: 본인 것만 접근
CREATE POLICY "own conversations only"
ON conversations FOR ALL
USING (user_id = auth.uid());

-- messages: 본인 대화의 메시지만 접근
CREATE POLICY "own messages only"
ON messages FOR ALL
USING (
  conversation_id IN (
    SELECT id FROM conversations WHERE user_id = auth.uid()
  )
);

-- expressions: 본인 것만 접근
CREATE POLICY "own expressions only"
ON expressions FOR ALL
USING (user_id = auth.uid());
```

---

## 8. 단계별 개발 로드맵

---

### Phase 0: 개발 환경 선행 설정 (개발 착수 전 필수)

> **⚠️ 이 단계를 완료하지 않으면 Phase 1의 소셜 로그인(Apple Sign In)과 마이크 권한 테스트가 불가능하다.**

| 순서 | 작업 | 완료 기준 |
|------|------|-----------|
| 0-1 | EAS Build 계정 설정 및 `eas.json` 구성 | `eas build --profile development` 명령 성공 |
| 0-2 | EAS Dev Client 빌드 생성 (iOS + Android) | 실제 디바이스에서 Dev Client 앱 실행 확인 |
| 0-3 | Apple Developer 계정 — Sign In with Apple 서비스 ID 설정 | Supabase Auth → Apple 공급자 연동 확인 |
| 0-4 | Google OAuth 클라이언트 설정 (iOS/Android 각각) | Supabase Auth → Google 공급자 연동 확인 |
| 0-5 | OpenAI API 키 발급 및 환경 변수 설정 | `process.env.OPENAI_API_KEY` 서버에서 참조 확인 |

---

### Phase 1: MVP — 핵심 루프 완성 (예상: 4~6주)

**목표:** 말하기 → AI 피드백 → 표현 저장 → 문맥 복습이 하나의 루프로 동작

> **Phase 1 개발 지침 — API 클라이언트 추상화 (필수):**
> Phase 1의 모든 API 통신 코드는 반드시 추상화된 함수 레이어로 구현해야 한다.
> Phase 2에서 일반 JSON 응답 방식을 SSE(스트리밍) 방식으로 전환할 때, 클라이언트 컴포넌트 코드를 건드리지 않고 아래 함수 내부만 교체할 수 있도록 설계한다.
>
> **⚠️ 함수 설계 원칙: STT와 LLM은 반드시 별개 함수로 분리한다. 콜백 방식 금지.**
>
> STT 결과(텍스트)를 AI 응답보다 먼저 UI에 표시하기 위해, 단일 `sendMessage(audioUri)` 함수 안에서 STT + LLM을 모두 처리하면 안 된다. 컴포넌트가 두 함수를 **순차 호출**하는 구조로 구현해야 한다:
>
> ```javascript
> // mobile-app/api/chat.js — 확정된 추상화 함수 목록
>
> // ① STT 전용: 오디오 → 텍스트 변환 (POST /api/stt)
> export async function transcribeAudio(audioUri) {
>   // 반환: { text: string }
> }
>
> // ② LLM 전용: 텍스트 → AI 응답 (POST /api/conversations/:id/messages)
> export async function sendMessage(conversationId, text) {
>   // 반환: { message_id: string, turn_number: number, content: { feedback: [...], next_response: string } }
> }
>
> export async function fetchMessages(conversationId) { ... }
> export async function saveExpression(payload) { ... }
> export async function playTTS(text) { ... }   // 중단 메커니즘 포함 — F-05 구현 지침 참조
> ```
>
> **컴포넌트에서의 올바른 호출 패턴:**
> ```javascript
> // ChatScreen.jsx — 마이크 버튼 릴리즈 핸들러
> const handleRecordingStop = async (audioUri) => {
>   // ① STT 호출 → 텍스트 즉시 렌더링
>   const { text } = await transcribeAudio(audioUri);
>   appendUserBubble(text);          // 사용자 말풍선 즉시 표시
>   showTypingIndicator(true);       // AI 대기 인디케이터
>
>   // ② LLM 호출 → AI 응답 렌더링
>   const { message_id, content } = await sendMessage(conversationId, text);
>   showTypingIndicator(false);
>   appendAIBubble(message_id, content);  // 피드백 블록 + 응답 블록 렌더링
> };
> ```
>
> 컴포넌트에서 fetch/axios를 직접 호출하지 않는다. 모든 API 호출은 위 추상 함수를 통해서만 이루어진다.

| 순서 | 작업 | 완료 기준 |
|------|------|-----------|
| 1-1 | Supabase 프로젝트 세팅 + 스키마(v1.7) 생성 + RLS 3개 정책 + updated_at 트리거 설정 + messages 복합 인덱스 생성 | 4개 테이블 생성(messages.user_id 컬럼 포함, expressions.source_block 컬럼 포함), Auth 동작, updated_at 트리거 동작 확인(메시지 추가 시 conversations.updated_at 갱신 확인), `idx_messages_user_turn_count` 인덱스 생성 확인 |
| 1-2 | Express API 서버 기본 구조 (라우팅, JWT 미들웨어, KST 기반 일일 턴 제한 미들웨어) | `/health` 엔드포인트 + 인증 검증 + 턴 카운터 리셋 로직 확인 |
| 1-3 | Expo 프로젝트 세팅 + 탭 네비게이션 뼈대 + 온보딩/로그인 화면 | EAS Dev Client에서 Google/Apple 로그인 완료 후 홈 화면 진입 |
| 1-4 | 채팅 UI 구현 (정적 목업: 말풍선, 타이핑 인디케이터, 블록별 롱프레스 편집 팝업) | 모든 UI 컴포넌트 렌더링 확인 |
| 1-5 | STT 연동 (Whisper API: 마이크 녹음 m4a 30초 제한 → 텍스트 변환, **Android MPEG_4/AAC 코덱 명시 설정**) | iOS/Android 양쪽에서 m4a 포맷으로 녹음된 파일이 Whisper API에서 정상 변환되고 3초 이내에 채팅창에 출력됨 확인 |
| 1-6 | LLM 연동 (GPT-4o-mini: JSON 응답 강제, 6턴 슬라이딩 윈도우, json_parse_failure 에러 로깅) | AI 응답이 jsonb 구조로 DB 저장 + 에러 로그 확인 |
| 1-7 | 대화 저장 API + UI 연동 (turn_number 순서 보장, KST 턴 카운터 적용) | 대화가 DB에 저장되고 홈 목록에 표시, 20회 제한 동작 확인 |
| 1-8 | 표현 저장 기능 (블록 롱프레스 → 원문 자동 채우기 → 편집 팝업 → DB 저장) | 피드백 블록 = corrected / 응답 블록 = next_response 원문 채우기 확인, DB `expressions.source_block` 값이 블록 종류에 따라 `'feedback'` / `'response'` / `'user_speech'`로 정확히 저장됨 확인 |
| 1-9 | 표현 학습장 탭 (카드 목록 + 원본 대화 문맥 뷰) | 저장된 표현 탭 시 원본 대화창 노출, 하이라이트 확인 |
| 1-10 | TTS 연동 (`/api/tts` mp3 binary stream → `expo-file-system` 임시 파일 → `expo-av` 재생, 전체 캐싱 없음) | 채팅창/학습장 모든 🔊 버튼 탭 시 Nova 음성 재생, `is_perfect: true` 항목 🔊 미표시, DB URL 저장 없음 확인 |

**MVP 테스트 시드 데이터 (실전 시나리오 기준)**

| 시나리오 | 테스트 발화 예시 | 검증 포인트 |
|----------|-----------------|-------------|
| `airport_immigration` | "I am visit America for vacation and staying in New York for one week." | 문법 교정(`am visit` → `am visiting`) + feedback jsonb 저장 + corrected 롱프레스 시 팝업 원문 확인 |
| `hotel_checkin` | "I has reservation under the name Kim. Can I checking in early?" | 복수 오류 교정 + feedback[] 배열 2개 원소 생성 확인 |
| `cafe_order` | "I want a flat white with oat milk and can I get it to go?" | `is_perfect: true` 처리 + 모든 🔊 버튼 탭 시 TTS API 신규 호출 확인 |

**MVP 완료 시 동작 가능 기능:**
소셜 로그인 → 주제 선택 → 음성 입력(m4a) → STT 표시 → AI 피드백/대화 응답 → 블록별 표현 저장(편집) → 학습장 문맥 복습 → TTS 재생 (모든 위치, 캐싱 없음, mp3 binary stream)

---

### Phase 2: UX 고도화 및 완성도 향상 (예상: 3~4주)

**목표:** 실제 배포 가능한 수준의 완성도 및 성능

| 작업 | 세부 내용 |
|------|-----------|
| 2-1 스트리밍 응답 | `sendMessage()` 함수 내부를 SSE 방식으로 교체. 피드백 블록 실시간 타이핑 효과 구현 → AI 응답 목표 3초 이내로 단축 |
| 2-2 학습장 검색 | 표현 텍스트 키워드 검색 (Supabase `ilike` 쿼리, `expression_text`에 GIN 인덱스 추가) |
| 2-3 추가 예문 생성 | 표현 상세 화면 "예문 더 보기" 탭 시 GPT-4o-mini 추가 예문 2~3개 생성 |
| 2-4 오프라인 캐시 | React Query + 로컬 스토리지 기반 학습장 오프라인 열람 |
| 2-5 TTS 악센트 선택 | 설정 화면에서 미국식(Nova) / 영국식(Fable) 선택 옵션 추가 |
| 2-6 푸시 알림 | "오늘 영어 연습 하셨나요?" 리마인더 (Expo Notifications) |
| 2-7 KPI 모니터링 | D7 리텐션 / 대화 완료율 / 표현 저장 전환율 계산 Supabase SQL 쿼리 작성 및 주간 리뷰 |

---

### Phase 3: 성장, 확장 및 배포 준비 (예상: 추후 결정)

**목표:** 정식 출시 준비 및 리텐션 강화 기능

| 기능 | 설명 |
|------|------|
| 3-1 학습 통계 대시보드 | 주간 대화 횟수, 저장 표현 수, 연속 학습 일수(streak) |
| 3-2 SRS 기반 복습 알림 | 망각 곡선 기반으로 표현 복습 타이밍 푸시 알림 |
| 3-3 난이도 자동 조정 | `turn_number` 및 `is_perfect` 비율을 기반으로 AI 대화 난이도 조절 |
| 3-4 소셜 / 공유 기능 | 저장한 표현 카드를 이미지로 저장하여 SNS 공유 |
| 3-5 발음 평가 | ⚠️ **주의:** OpenAI Whisper API의 신뢰도 점수(`logprob`)는 음성 인식 신뢰도이며 실제 **발음 정확도**와 다름. 해당 기능 구현 전 **Azure Cognitive Services Pronunciation Assessment** 등 발음 평가 전용 API 검토 필요. |
| 3-6 초대 코드 확장 | MVP 10명 제한 해제 후 초대 링크 기반 사용자 확장 |
| **3-7 앱 스토어 배포 준비** | **Privacy Policy(개인정보처리방침) 웹페이지 작성 및 URL 확보** (App Store 제출 필수 요건 / 소셜 로그인 사용으로 더욱 엄격히 요구됨). 앱 이름 확정, 카테고리 설정, 연령 등급 결정, 스크린샷 제작, TestFlight 공개 베타 → 정식 심사 제출 순서로 진행. |

---

## 부록: API 엔드포인트 초안

> **STT-first 2-Step 호출 흐름 요약:**
> 클라이언트는 단일 API 호출로 STT + LLM을 처리하지 않는다. 사용자 말풍선을 AI 응답보다 먼저 표시하기 위해 반드시 ①②를 순차 호출한다:
> **① POST `/api/stt`** → 텍스트 수신 → 말풍선 렌더링 → **② POST `/api/conversations/:id/messages`** → AI 응답 수신

| Method | Endpoint | Request Body | Response Body | 설명 | 인증 | 비고 |
|--------|----------|-------------|--------------|------|------|------|
| `POST` | `/api/auth/verify` | — | `{ valid: bool }` | JWT 토큰 검증 | - | |
| `POST` | `/api/conversations` | `{ topic_id, topic_label }` | `{ id, topic_id, topic_label, created_at }` | 새 대화 세션 생성 | ✅ | |
| `GET` | `/api/conversations` | — | `[{ id, topic_label, updated_at, turn_count }]` | 사용자 대화 목록 조회 (updated_at 역순) | ✅ | |
| `GET` | `/api/conversations/:id/messages` | — | `[{ id, turn_number, role, content, content_type }]` | 특정 대화의 전체 메시지 조회 (turn_number 순) | ✅ | |
| `POST` | `/api/conversations/:id/messages` | **`{ "text": string }`** | **`{ "message_id": uuid, "turn_number": int, "content": { "feedback": [...], "next_response": string } }`** | STT 변환 텍스트를 받아 LLM 호출 → AI 응답 반환 (KST 턴 제한 미들웨어) | ✅ | ⚠️ 오디오 아닌 **텍스트** 수신. `message_id`는 표현 저장 시 사용. Phase 2에서 SSE 전환 예정 |
| `POST` | `/api/expressions` | `{ conversation_id, message_id, expression_text, source_block, user_memo? }` | `{ id, created_at }` | 표현 저장 | ✅ | `source_block`: `'user_speech'` / `'feedback'` / `'response'` |
| `GET` | `/api/expressions` | — | `[{ id, expression_text, user_memo, created_at, topic_label, source_sentence }]` | 저장된 표현 목록 조회 | ✅ | |
| `DELETE` | `/api/expressions/:id` | — | `{ success: true }` | 표현 삭제 | ✅ | |
| `GET` | `/api/expressions/:id/examples` | — | `{ examples: [string] }` | 특정 표현의 추가 예문 AI 생성 | ✅ | Phase 2 구현 |
| `POST` | `/api/stt` | `multipart/form-data` (audio, **m4a 포맷 고정**) | `{ "text": string }` | 오디오 → 텍스트 변환 (Whisper) | ✅ | 2-Step 흐름의 ①단계 |
| `POST` | `/api/tts` | `{ "text": string }` | **mp3 binary stream** (Content-Type: audio/mpeg) | 텍스트 → mp3 binary stream 직접 반환 (캐싱 없음) | ✅ | 클라이언트는 expo-file-system 임시 파일로 저장 후 expo-av로 재생 |

---

### API 에러 코드 표

서버는 에러 응답 시 HTTP 상태 코드와 함께 아래 JSON 구조를 반환한다:

```json
{ "error": { "code": "TURN_LIMIT_EXCEEDED", "message": "일일 20턴을 모두 소진했습니다." } }
```

| 에러 코드 | HTTP 상태 | 발생 조건 | 클라이언트 처리 |
|-----------|----------|-----------|----------------|
| `TURN_LIMIT_EXCEEDED` | 429 | 일일 20턴 소진 | 입력 UI 비활성화 + "오늘의 연습을 모두 완료했어요!" 안내 |
| `AUDIO_TOO_LONG` | 400 | 오디오 파일이 30초 초과. 클라이언트 30초 타이머가 1차 차단하며, 본 에러는 악의적 요청을 막기 위한 백엔드 2차 방어선 | "30초 이하로 다시 말해주세요" 토스트 |
| `STT_FAILED` | 502 | Whisper API 오류 또는 음성 인식 실패 | "다시 말하기" 버튼 표시 |
| `LLM_JSON_PARSE_FAILED` | 502 | GPT 응답이 JSON 형식이 아님 (2회 재시도 후 최종 실패) | "AI 응답 생성에 실패했어요. 다시 시도해 주세요." 토스트 + 입력 활성화 |
| `TTS_FAILED` | 502 | OpenAI TTS API 오류 | "발음 듣기에 실패했어요." 토스트 |
| `UNAUTHORIZED` | 401 | JWT 토큰 없음 또는 만료 | 자동 토큰 갱신 시도 → 실패 시 로그인 화면 이동 |
| `INVALID_AUDIO_FORMAT` | 400 | m4a 외 포맷 전송 | 클라이언트 측 포맷 검증으로 사전 차단 (이 에러가 오면 버그) |

---

*이 문서는 살아있는 문서(Living Document)입니다. 개발 진행에 따라 지속적으로 업데이트하세요.*
*PRD v1.7 — 기술 검증 7회 완료, Critical 0 / Major 0 / Minor 0, 진짜 최종 마감 버전 — 즉시 개발 착수 승인*
