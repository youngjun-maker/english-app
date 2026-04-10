import { useEffect, useRef, useState } from 'react';
import { playTTS, stopTTS } from '@/api/chat';
import { useAppStore } from '@/store/useAppStore';

export function useTTSButton(text: string) {
  const showToast = useAppStore((s) => s.showToast);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // 언마운트 시 재생 중단 + state 업데이트 차단
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      stopTTS();
    };
  }, []);

  async function handlePress() {
    if (isPlaying || isLoading) {
      abortRef.current?.abort();
      stopTTS();
      if (mountedRef.current) {
        setIsPlaying(false);
        setIsLoading(false);
      }
      return;
    }
    abortRef.current = new AbortController();
    if (mountedRef.current) setIsLoading(true);
    try {
      await playTTS(
        text,
        () => { if (mountedRef.current) setIsPlaying(false); },
        abortRef.current.signal,
      );
      if (mountedRef.current) setIsPlaying(true);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      if (mountedRef.current) setIsPlaying(false);
      const code = (err as { error?: { code?: string } })?.error?.code;
      if (code === 'TTS_FAILED') {
        showToast('발음 듣기에 실패했어요.');
      } else {
        showToast('음성을 불러올 수 없습니다');
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }

  return { isLoading, isPlaying, handlePress };
}
