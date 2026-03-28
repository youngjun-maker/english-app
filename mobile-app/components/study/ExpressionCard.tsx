import { View, Text, Pressable } from 'react-native';
import type { Expression } from '@/types';
import TTSButton from '@/components/common/TTSButton';
import { useTTSButton } from '@/hooks/useTTSButton';

type ExpressionCardProps = {
  expression: Expression;
  onPress?: () => void;
  onLongPress?: () => void;
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

const SOURCE_BLOCK_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  user_speech: { label: 'My Speech', bg: 'bg-emerald-50', text: 'text-emerald-600' },
  feedback: { label: 'Correction', bg: 'bg-indigo-50', text: 'text-indigo-500' },
  response: { label: 'AI Response', bg: 'bg-purple-50', text: 'text-purple-600' },
};

export default function ExpressionCard({ expression, onPress, onLongPress }: ExpressionCardProps) {
  const { isPlaying, handlePress } = useTTSButton(expression.expression_text);
  const sourceConfig = SOURCE_BLOCK_CONFIG[expression.source_block] ?? {
    label: expression.source_block,
    bg: 'bg-gray-100',
    text: 'text-gray-500',
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="bg-white rounded-2xl px-4 py-3.5 mb-3 border border-gray-100 shadow-sm active:opacity-70"
    >
      {/* 표현 텍스트 + TTS */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-gray-900 font-semibold text-sm flex-1 mr-2">
          {expression.expression_text}
        </Text>
        <View className="w-7 h-7 rounded-full bg-gray-100 items-center justify-center">
          <TTSButton
            text={expression.expression_text}
            isPlaying={isPlaying}
            onPress={handlePress}
          />
        </View>
      </View>

      {/* 배지들 */}
      <View className="flex-row items-center gap-2 flex-wrap">
        {/* 토픽 배지 */}
        <View className="bg-amber-50 rounded-full px-2 py-0.5">
          <Text className="text-xs text-amber-600">{expression.topic_label}</Text>
        </View>

        {/* source_block 배지 */}
        <View className={`rounded-full px-2 py-0.5 ${sourceConfig.bg}`}>
          <Text className={`text-xs ${sourceConfig.text}`}>{sourceConfig.label}</Text>
        </View>

        {/* 날짜 */}
        <Text className="text-xs text-gray-400">{formatDate(expression.created_at)}</Text>
      </View>
    </Pressable>
  );
}
