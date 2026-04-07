import { View, Text } from 'react-native';
import { useAppStore } from '@/store';

type TypingIndicatorProps = {
  /** 상황별 맥락 텍스트 (없으면 기본 텍스트 사용) */
  contextText?: string;
};

export default function TypingIndicator({ contextText }: TypingIndicatorProps) {
  const isVisible = useAppStore((s) => s.isTypingIndicatorVisible);

  if (!isVisible) return null;

  const displayText = contextText ?? '상대방이 생각 중이에요...';

  return (
    <View className="items-start mb-4">
      <View className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
        <Text className="text-gray-500 text-sm">{displayText}</Text>
      </View>
    </View>
  );
}
