import { View, Text, Pressable } from 'react-native';
import { useState } from 'react';
import TTSButton from '@/components/common/TTSButton';
import SavePopup from '@/components/common/SavePopup';
import { useTTSButton } from '@/hooks/useTTSButton';

type UserBubbleProps = {
  text: string;
  onLongPress?: () => void;
  onSave?: (text: string, memo: string) => void;
};

export default function UserBubble({ text, onLongPress, onSave }: UserBubbleProps) {
  const { isPlaying, handlePress: handleTTSPress } = useTTSButton(text);
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
        className="bg-blue-500 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]"
      >
        <Text className="text-white text-sm leading-5">{text}</Text>
      </Pressable>
      <TTSButton
        text={text}
        isPlaying={isPlaying}
        onPress={handleTTSPress}
      />
      {onSave && (
        <SavePopup
          visible={saveVisible}
          initialText={text}
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
