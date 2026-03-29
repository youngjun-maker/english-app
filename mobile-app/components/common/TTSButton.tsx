import { ActivityIndicator, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

type TTSButtonProps = {
  text: string;
  isLoading: boolean;
  isPlaying: boolean;
  onPress: () => void;
};

export default function TTSButton({ text, isLoading, isPlaying, onPress }: TTSButtonProps) {
  function getAccessibilityLabel() {
    if (isLoading) return '음성 로딩 중';
    if (isPlaying) return '재생 중지';
    return `${text} 듣기`;
  }

  return (
    <Pressable
      onPress={onPress}
      className="items-center justify-center min-w-[44px] min-h-[44px]"
      accessibilityLabel={getAccessibilityLabel()}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#6b7280" />
      ) : (
        <Ionicons
          name={isPlaying ? 'stop-circle' : 'volume-high'}
          size={22}
          color={isPlaying ? '#ef4444' : '#6b7280'}
        />
      )}
    </Pressable>
  );
}
