import { useRef, useState } from 'react';
import { playTTS, stopTTS } from '@/api/chat';
import { useAppStore } from '@/store/useAppStore';

export function useTTSButton(text: string) {
  const showToast = useAppStore((s) => s.showToast);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function handlePress() {
    if (isPlaying || isLoading) {
      abortRef.current?.abort();
      stopTTS();
      setIsPlaying(false);
      setIsLoading(false);
      return;
    }
    abortRef.current = new AbortController();
    setIsLoading(true);
    try {
      await playTTS(text, () => setIsPlaying(false), abortRef.current.signal);
      setIsPlaying(true);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setIsPlaying(false);
      const code = (err as { error?: { code?: string } })?.error?.code;
      if (code === 'TTS_FAILED') {
        showToast('발음 듣기에 실패했어요.');
      } else {
        showToast('음성을 불러올 수 없습니다');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return { isLoading, isPlaying, handlePress };
}
