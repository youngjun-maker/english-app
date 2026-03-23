import { View, Text, Pressable } from 'react-native';
import { useState } from 'react';
import type { FeedbackItem } from '@/types';
import TTSButton from '@/components/common/TTSButton';
import SavePopup from '@/components/common/SavePopup';
import { useTTSButton } from '@/hooks/useTTSButton';

type FeedbackBlockProps = {
  feedback: FeedbackItem;
  onLongPress?: () => void;
  onSave?: (text: string, memo: string) => void;
};

export default function FeedbackBlock({ feedback, onLongPress, onSave }: FeedbackBlockProps) {
  const { isPlaying, handlePress: handleTTSPress } = useTTSButton(feedback.corrected ?? '');
  const [saveVisible, setSaveVisible] = useState(false);

  if (feedback.is_perfect) {
    return (
      <View className="bg-green-50 rounded-xl px-4 py-3 mb-2">
        <Text className="text-green-700 text-sm">완벽해요! 자연스럽고 정확한 표현이에요.</Text>
      </View>
    );
  }

  function handleBubblePress() {
    if (onLongPress) {
      onLongPress();
    } else if (onSave) {
      setSaveVisible(true);
    }
  }

  return (
    <Pressable
      onPress={handleBubblePress}
      className="bg-amber-50 rounded-xl px-4 py-3 mb-2"
    >
      {/* 원문 (취소선) */}
      {feedback.original && (
        <Text className="text-gray-400 text-sm line-through mb-1">
          {feedback.original}
        </Text>
      )}

      {/* 교정문 + TTS */}
      {feedback.corrected && (
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-gray-800 font-semibold text-sm flex-1 mr-2">
            {feedback.corrected}
          </Text>
          <TTSButton
            text={feedback.corrected}
            isPlaying={isPlaying}
            onPress={handleTTSPress}
          />
        </View>
      )}

      {onSave && (
        <SavePopup
          visible={saveVisible}
          initialText={feedback.corrected ?? ''}
          onSave={(t, memo) => {
            onSave(t, memo);
            setSaveVisible(false);
          }}
          onClose={() => setSaveVisible(false)}
        />
      )}
    </Pressable>
  );
}
