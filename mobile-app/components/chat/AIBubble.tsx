import { View, Text, Pressable } from 'react-native';
import { useState } from 'react';
import type { FeedbackItem } from '@/types';
import FeedbackBlock from '@/components/chat/FeedbackBlock';
import TTSButton from '@/components/common/TTSButton';
import SavePopup from '@/components/common/SavePopup';
import { useTTSButton } from '@/hooks/useTTSButton';

type AIBubbleProps = {
  feedback: FeedbackItem[];
  nextResponse: string;
  messageId: string;
  readonly?: boolean;
  onSave?: (text: string, memo: string) => void;
  onFeedbackSave?: (index: number, text: string, memo: string) => void;
};

export default function AIBubble({
  feedback,
  nextResponse,
  messageId,
  readonly,
  onSave,
  onFeedbackSave,
}: AIBubbleProps) {
  const { isPlaying, handlePress } = useTTSButton(nextResponse);
  const [saveVisible, setSaveVisible] = useState(false);

  return (
    <View className="items-start mb-4 max-w-[85%]">
      {/* 피드백 블록 목록 */}
      {feedback.map((item, index) => (
        <FeedbackBlock
          key={`${messageId}-fb-${index}`}
          feedback={item}
          onLongPress={readonly ? () => {} : undefined}
          onSave={
            !readonly && onFeedbackSave
              ? (text, memo) => onFeedbackSave(index, text, memo)
              : undefined
          }
        />
      ))}

      {/* AI 응답 텍스트 블록 */}
      <Pressable
        onLongPress={
          readonly
            ? undefined
            : onSave
              ? () => setSaveVisible(true)
              : undefined
        }
        className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 mt-1"
      >
        <Text className="text-gray-800 text-sm leading-5 mb-1">{nextResponse}</Text>
        <TTSButton
          text={nextResponse}
          isPlaying={isPlaying}
          onPress={handlePress}
        />
      </Pressable>

      {onSave && (
        <SavePopup
          visible={saveVisible}
          initialText={nextResponse}
          onSave={(t, memo) => {
            onSave(t, memo);
            setSaveVisible(false);
          }}
          onClose={() => setSaveVisible(false)}
        />
      )}
    </View>
  );
}
