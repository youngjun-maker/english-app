import { View, Text, Pressable } from 'react-native';
import { useState } from 'react';
import type { FeedbackItem } from '@/types';
import FeedbackBlock from '@/components/chat/FeedbackBlock';
import TTSButton from '@/components/common/TTSButton';
import SavePopup from '@/components/common/SavePopup';

type AIBubbleProps = {
  feedback: FeedbackItem[];
  nextResponse: string;
  messageId: string;
  readonly?: boolean;
};

export default function AIBubble({ feedback, nextResponse, messageId, readonly }: AIBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [saveVisible, setSaveVisible] = useState(false);

  return (
    <View className="items-start mb-4 max-w-[85%]">
      {/* 피드백 블록 목록 */}
      {feedback.map((item, index) => (
        <FeedbackBlock
          key={`${messageId}-fb-${index}`}
          feedback={item}
          onLongPress={readonly ? () => {} : undefined}
        />
      ))}

      {/* AI 응답 텍스트 블록 */}
      <Pressable
        onLongPress={readonly ? undefined : () => setSaveVisible(true)}
        className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 mt-1"
      >
        <Text className="text-gray-800 text-sm leading-5 mb-1">{nextResponse}</Text>
        <TTSButton
          text={nextResponse}
          isPlaying={isPlaying}
          onPress={() => setIsPlaying((p) => !p)}
        />
      </Pressable>

      <SavePopup
        visible={saveVisible}
        initialText={nextResponse}
        onSave={(_t, _memo) => setSaveVisible(false)}
        onClose={() => setSaveVisible(false)}
      />
    </View>
  );
}
