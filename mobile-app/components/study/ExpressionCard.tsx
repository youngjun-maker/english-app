import { View, Text, Pressable } from 'react-native';
import { useState } from 'react';
import type { Expression } from '@/types';
import TTSButton from '@/components/common/TTSButton';

type ExpressionCardProps = {
  expression: Expression;
  onPress?: () => void;
  onLongPress?: () => void;
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

export default function ExpressionCard({ expression, onPress, onLongPress }: ExpressionCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="bg-white rounded-2xl px-4 py-4 mb-3 shadow-sm border border-gray-100"
    >
      {/* 표현 텍스트 + TTS */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-gray-900 font-semibold text-base flex-1 mr-2">
          {expression.expression_text}
        </Text>
        <TTSButton
          text={expression.expression_text}
          isPlaying={isPlaying}
          onPress={() => setIsPlaying((p) => !p)}
        />
      </View>

      {/* 토픽 + 날짜 */}
      <View className="flex-row items-center gap-2 mb-1">
        <Text className="text-blue-500 text-xs font-medium">{expression.topic_label}</Text>
        <Text className="text-gray-300 text-xs">·</Text>
        <Text className="text-gray-400 text-xs">{formatDate(expression.created_at)}</Text>
      </View>

      {/* 메모 (optional) */}
      {expression.user_memo && (
        <Text className="text-gray-500 text-xs mt-1">{expression.user_memo}</Text>
      )}
    </Pressable>
  );
}
