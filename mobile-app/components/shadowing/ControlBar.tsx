import { View, Pressable, Platform } from 'react-native';
import { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { BlindMode } from '@/types/shadowing';

type Props = {
  playbackRate: 0.75 | 1.0;
  blindMode: BlindMode;
  isLooping: boolean;
  isRecording: boolean;
  onPlaybackRateToggle: () => void;
  onBlindModeToggle: () => void;
  onLoopToggle: () => void;
  onScriptPress: () => void;
  onMicPress: () => void;
};

const BLUE = '#3B82F6';
const GRAY = '#9CA3AF';
const RED  = '#EF4444';

function BlindIcon({ blindMode }: { blindMode: BlindMode }) {
  if (blindMode === 0) return <Ionicons name="eye-outline" size={24} color={GRAY} />;
  if (blindMode === 1) return <Ionicons name="eye-off-outline" size={24} color={BLUE} />;
  return (
    <View>
      <Ionicons name="eye-off-outline" size={24} color={RED} />
    </View>
  );
}

export default function ControlBar({
  playbackRate,
  blindMode,
  isLooping,
  isRecording,
  onPlaybackRateToggle,
  onBlindModeToggle,
  onLoopToggle,
  onScriptPress,
  onMicPress,
}: Props) {
  const scale = useSharedValue(1);

  // 녹음 중 pulse 애니메이션 (웹은 reanimated 미지원으로 스킵)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (isRecording) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 500 }),
          withTiming(1.0,  { duration: 500 }),
        ),
        -1,
      );
    } else {
      cancelAnimation(scale);
      scale.value = withTiming(1.0, { duration: 150 });
    }
    return () => cancelAnimation(scale);
  }, [isRecording]);

  const micAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View className="flex-row items-center justify-around px-8 py-4 border-t border-gray-100">
      {/* 🐢 속도 */}
      <Pressable
        onPress={onPlaybackRateToggle}
        className="w-10 h-10 items-center justify-center active:opacity-60"
      >
        <Ionicons
          name="speedometer-outline"
          size={24}
          color={playbackRate === 0.75 ? BLUE : GRAY}
        />
      </Pressable>

      {/* 👁 블라인드 모드 */}
      <Pressable
        onPress={onBlindModeToggle}
        className="w-10 h-10 items-center justify-center active:opacity-60"
      >
        <BlindIcon blindMode={blindMode} />
      </Pressable>

      {/* 🎙️ 마이크 (중앙) */}
      <Animated.View style={micAnimStyle}>
        <Pressable
          onPress={onMicPress}
          className="w-16 h-16 rounded-full items-center justify-center active:opacity-80"
          style={{ backgroundColor: isRecording ? RED : BLUE }}
        >
          <Ionicons name="mic-outline" size={28} color="white" />
        </Pressable>
      </Animated.View>

      {/* 📄 전체 스크립트 */}
      <Pressable
        onPress={onScriptPress}
        className="w-10 h-10 items-center justify-center active:opacity-60"
      >
        <Ionicons name="document-text-outline" size={24} color={GRAY} />
      </Pressable>

      {/* 🔁 루프 */}
      <Pressable
        onPress={onLoopToggle}
        className="w-10 h-10 items-center justify-center active:opacity-60"
      >
        <Ionicons
          name="repeat-outline"
          size={24}
          color={isLooping ? BLUE : GRAY}
        />
      </Pressable>
    </View>
  );
}
