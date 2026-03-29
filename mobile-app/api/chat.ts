import { Audio } from 'expo-av';
import type {
  TranscribeResponse,
  SendMessageResponse,
  TTSResponse,
  Message,
  Expression,
  APIError,
} from '@/types';
import { apiFetch } from '@/utils/apiFetch';
import { useAppStore } from '@/store/useAppStore';

// 현재 재생 중인 사운드 (모듈 변수 — 연속 탭 시 이전 오디오 즉시 중단용)
let _currentSound: Audio.Sound | null = null;
let _currentOnEnd: (() => void) | null = null;

async function handleError(res: Response): Promise<never> {
  const data = (await res.json()) as APIError;
  const code = data.error?.code;

  if (code === 'TURN_LIMIT_EXCEEDED') {
    useAppStore.getState().setTodayTurnCount(20);
  }
  throw data;
}

// ① STT: 오디오 URI → FormData → POST /api/stt → { text }
export async function transcribeAudio(audioUri: string): Promise<TranscribeResponse> {
  const form = new FormData();
  form.append('audio', {
    uri: audioUri,
    name: 'recording.m4a',
    type: 'audio/mp4',
  } as unknown as Blob);
  const res = await apiFetch('/api/stt', {
    method: 'POST',
    body: form as unknown as BodyInit,
  });
  if (!res.ok) return handleError(res);
  return res.json();
}

// ② LLM: POST /api/conversations/:id/messages → { message_id, user_message_id, turn_number, content }
export async function sendMessage(
  conversationId: string,
  text: string,
): Promise<SendMessageResponse> {
  const res = await apiFetch(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return handleError(res);
  const data: SendMessageResponse = await res.json();
  useAppStore.getState().incrementTurnCount();
  return data;
}

// ③ 메시지 조회: GET /api/conversations/:id/messages
export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const res = await apiFetch(`/api/conversations/${conversationId}/messages`);
  if (!res.ok) return handleError(res);
  return res.json();
}

// ④ 표현 저장: POST /api/expressions
export async function saveExpression(
  payload: Pick<Expression, 'expression_text' | 'source_block'> & {
    conversation_id: string;
    message_id: string;
    user_memo?: string;
  },
): Promise<{ id: string; created_at: string }> {
  const res = await apiFetch('/api/expressions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) return handleError(res);
  return res.json();
}

// ⑤ 표현 목록 조회: GET /api/expressions
export async function fetchExpressions(): Promise<Expression[]> {
  const res = await apiFetch('/api/expressions');
  if (!res.ok) return handleError(res);
  return res.json();
}

// ⑥ 표현 삭제: DELETE /api/expressions/:id
export async function deleteExpression(id: string): Promise<void> {
  const res = await apiFetch(`/api/expressions/${id}`, { method: 'DELETE' });
  if (!res.ok) return handleError(res);
}

// ⑦ TTS 재생: POST /api/tts → { url } → Audio.Sound.createAsync
export async function playTTS(text: string, onEnd?: () => void, signal?: AbortSignal): Promise<void> {
  // 이전 버튼 아이콘 즉시 리셋 후 기존 재생 중단
  _currentOnEnd?.();
  _currentOnEnd = null;
  if (_currentSound) {
    try {
      await _currentSound.stopAsync();
      await _currentSound.unloadAsync();
    } catch {
      // 이미 언로드된 경우 무시
    }
    _currentSound = null;
  }

  const res = await apiFetch('/api/tts', {
    method: 'POST',
    body: JSON.stringify({ text }),
    signal,
  });
  if (!res.ok) return handleError(res);

  const { url } = (await res.json()) as TTSResponse;

  // 오디오 재생 모드 설정
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
  });

  // 새 사운드 시작 직전 onEnd 등록
  _currentOnEnd = onEnd ?? null;

  // expo-av로 재생 (Signed URL 또는 data URI 모두 직접 사용 가능)
  const { sound } = await Audio.Sound.createAsync(
    { uri: url },
    { shouldPlay: true },
  );
  _currentSound = sound;

  // 재생 완료 시 정리
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      _currentOnEnd?.();
      _currentOnEnd = null;
      sound.unloadAsync().catch(() => {});
      if (_currentSound === sound) _currentSound = null;
    }
  });
}

// 수동 중단 (TTSButton 토글 또는 화면 언마운트 시 호출)
export function stopTTS(): void {
  _currentOnEnd?.();
  _currentOnEnd = null;
  if (_currentSound) {
    _currentSound.stopAsync().catch(() => {});
    _currentSound.unloadAsync().catch(() => {});
    _currentSound = null;
  }
}
