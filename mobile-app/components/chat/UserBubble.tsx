import { View, Text, Pressable } from 'react-native';
import { useState } from 'react';
import TTSButton from '@/components/common/TTSButton';
import SavePopup from '@/components/common/SavePopup';

type UserBubbleProps = {
  text: string;
  onLongPress?: () => void;
};

export default function UserBubble({ text, onLongPress }: UserBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [saveVisible, setSaveVisible] = useState(false);

  return (
    <View className="items-end mb-4">
      <Pressable
        onLongPress={onLongPress ?? (() => setSaveVisible(true))}
        className="bg-blue-500 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]"
      >
        <Text className="text-white text-sm leading-5">{text}</Text>
      </Pressable>
      <TTSButton
        text={text}
        isPlaying={isPlaying}
        onPress={() => setIsPlaying((p) => !p)}
      />
      <SavePopup
        visible={saveVisible}
        initialText={text}
        onSave={(_t, _memo) => setSaveVisible(false)}
        onClose={() => setSaveVisible(false)}
      />
    </View>
  );
}
