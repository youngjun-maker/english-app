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
      <View className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 mb-2">
        <Text className="text-emerald-700 text-xs font-semibold">
          ✅ Perfect expression!
        </Text>
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
      className="bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2.5 mb-2"
    >
      {/* 원문 (취소선) */}
      {feedback.original && (
        <Text className="text-gray-400 text-xs line-through mb-1">
          {feedback.original}
        </Text>
      )}

      {/* 교정문 + TTS */}
      {feedback.corrected && (
        <View className="flex-row items-center justify-between">
          <Text className="text-gray-800 text-sm font-semibold flex-1 mr-2">
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
