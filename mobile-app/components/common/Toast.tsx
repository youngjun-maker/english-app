import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useAppStore } from '@/store';

export default function Toast() {
  const toastMessage = useAppStore((s) => s.toastMessage);
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
    <View className="absolute bottom-20 left-6 right-6 items-center z-50 pointer-events-none">
      <View className="bg-gray-800/90 px-5 py-3 rounded-full">
        <Text className="text-white text-sm text-center">{toastMessage}</Text>
      </View>
    </View>
  );
}
