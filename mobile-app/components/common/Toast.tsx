import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useAppStore } from '@/store';

const BG_COLOR: Record<'success' | 'error' | 'info', string> = {
  success: 'rgba(34,197,94,0.92)',
  error:   'rgba(239,68,68,0.92)',
  info:    'rgba(31,41,55,0.90)',
};

export default function Toast() {
  const toastMessage = useAppStore((s) => s.toastMessage);
  const toastType = useAppStore((s) => s.toastType);
  const clearToast = useAppStore((s) => s.clearToast);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      clearToast();
    }, 2000);
    return () => clearTimeout(timer);
  }, [toastMessage, clearToast]);

  if (!toastMessage) return null;

  return (
    <View pointerEvents="none" className="absolute bottom-20 left-6 right-6 items-center z-50">
      <View style={{ backgroundColor: BG_COLOR[toastType] }} className="px-5 py-3 rounded-full">
        <Text className="text-white text-sm text-center">{toastMessage}</Text>
      </View>
    </View>
  );
}
