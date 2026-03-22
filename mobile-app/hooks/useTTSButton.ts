import { useState } from 'react';
import { playTTS, stopTTS } from '@/api/chat';
import { useAppStore } from '@/store/useAppStore';

export function useTTSButton(text: string) {
  const showToast = useAppStore((s) => s.showToast);
  const [isPlaying, setIsPlaying] = useState(false);

  async function handlePress() {
    if (isPlaying) {
      stopTTS();
      setIsPlaying(false);
      return;
    }
    setIsPlaying(true);
    try {
      await playTTS(text, () => setIsPlaying(false));
    } catch (err: unknown) {
      setIsPlaying(false);
      const code = (err as { error?: { code?: string } })?.error?.code;
      if (code === 'TTS_FAILED') {
        showToast('발음 듣기에 실패했어요.');
      } else {
        showToast('음성을 불러올 수 없습니다');
      }
    }
  }

  return { isPlaying, handlePress };
}
