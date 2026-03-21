import { View, Text } from 'react-native';
import { useAppStore } from '@/store';

export default function TypingIndicator() {
  const isVisible = useAppStore((s) => s.isTypingIndicatorVisible);

  if (!isVisible) return null;

  return (
    <View className="items-start mb-4">
      <View className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
        <Text className="text-gray-500 text-sm">AI가 문장을 교정하고 있어요 ✍️</Text>
      </View>
    </View>
  );
}
