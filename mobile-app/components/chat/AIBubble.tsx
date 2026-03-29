import { View, Text, Pressable } from 'react-native';
import { useState } from 'react';
import type { FeedbackItem } from '@/types';
import FeedbackBlock from '@/components/chat/FeedbackBlock';
import TTSButton from '@/components/common/TTSButton';
import SavePopup from '@/components/common/SavePopup';
import BearMascot from '@/components/common/BearMascot';
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
  const { isLoading, isPlaying, handlePress } = useTTSButton(nextResponse);
  const [saveVisible, setSaveVisible] = useState(false);

  return (
    <View className="flex-row gap-2.5 items-start mb-4 max-w-[90%]">
      {/* Bear avatar */}
      <View className="w-7 h-7 mt-0.5 rounded-full bg-red-50 items-center justify-center flex-shrink-0">
        <BearMascot size="small" />
      </View>

      {/* 콘텐츠 영역 */}
      <View className="flex-1 gap-2">
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

        {/* AI 응답 텍스트 — 버블 없음 */}
        <Pressable
          onPress={
            readonly
              ? undefined
              : onSave
                ? () => setSaveVisible(true)
                : undefined
          }
        >
          <Text className="text-gray-700 text-sm leading-relaxed">{nextResponse}</Text>
        </Pressable>

        {/* TTS 버튼 */}
        <TTSButton
          text={nextResponse}
          isLoading={isLoading}
          isPlaying={isPlaying}
          onPress={handlePress}
        />
      </View>

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
