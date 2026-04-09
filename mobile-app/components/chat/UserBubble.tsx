import { View, Text, Pressable } from 'react-native';
import { useState } from 'react';
import TTSButton from '@/components/common/TTSButton';
import SavePopup from '@/components/common/SavePopup';
import { useTTSButton } from '@/hooks/useTTSButton';

type UserBubbleProps = {
  text: string;
  onLongPress?: () => void;
  onSave?: (text: string, memo: string) => void;
  sourceLabel?: string;
};

export default function UserBubble({ text, onLongPress, onSave, sourceLabel }: UserBubbleProps) {
  const { isLoading, isPlaying, handlePress: handleTTSPress } = useTTSButton(text);
  const [saveVisible, setSaveVisible] = useState(false);

  function handleBubblePress() {
    if (onLongPress) {
      onLongPress();
    } else if (onSave) {
      setSaveVisible(true);
    }
  }

  return (
    <View className="items-end mb-4">
      <Pressable
        onPress={handleBubblePress}
        className="bg-gray-900 rounded-2xl rounded-br-sm px-4 py-3 max-w-[80%]"
      >
        <Text className="text-white text-sm leading-relaxed">{text}</Text>
      </Pressable>
      <TTSButton
        text={text}
        isLoading={isLoading}
        isPlaying={isPlaying}
        onPress={handleTTSPress}
      />
      {onSave && (
        <SavePopup
          visible={saveVisible}
          initialText={text}
          sourceLabel={sourceLabel}
          sourceBlock="내 발화"
          onSave={(t, memo) => onSave(t, memo)}
          onClose={() => setSaveVisible(false)}
        />
      )}
    </View>
  );
}
