import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useAppStore } from '@/store/useAppStore';

export function useOffline(): void {
  const showToast = useAppStore((s) => s.showToast);
  const setIsOffline = useAppStore((s) => s.setIsOffline);
  const initialized = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected ?? true;
      if (!initialized.current) {
        initialized.current = true;
        setIsOffline(!connected);
        return;
      }
      setIsOffline(!connected);
      if (!connected) showToast('인터넷 연결이 없습니다. 확인해주세요.');
    });
    return () => unsubscribe();
  }, []);
}
