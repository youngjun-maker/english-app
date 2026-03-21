import { Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

type TTSButtonProps = {
  text: string;
  isPlaying: boolean;
  onPress: () => void;
};

export default function TTSButton({ text, isPlaying, onPress }: TTSButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="items-center justify-center min-w-[44px] min-h-[44px]"
      accessibilityLabel={isPlaying ? '재생 중지' : `${text} 듣기`}
    >
      <Ionicons
        name={isPlaying ? 'stop-circle' : 'volume-high'}
        size={22}
        color={isPlaying ? '#ef4444' : '#6b7280'}
      />
    </Pressable>
  );
}
