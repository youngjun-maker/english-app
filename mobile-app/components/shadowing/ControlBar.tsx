import { View, Text, Pressable, Platform } from 'react-native';
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

// 마이크 버튼 크기
const MIC_SIZE = 72;
// 2중 링 반지름 오프셋
const RING1_OFFSET = 6;
const RING2_OFFSET = 14;

function BlindIcon({ blindMode }: { blindMode: BlindMode }) {
  if (blindMode === 0) return <Ionicons name="eye-outline" size={24} color={GRAY} />;
  if (blindMode === 1) return <Ionicons name="eye-off-outline" size={24} color={BLUE} />;
  return (
    <View>
      <Ionicons name="eye-off-outline" size={24} color={RED} />
    </View>
  );
}

type IconButtonProps = {
  onPress: () => void;
  children: React.ReactNode;
  label: string;
};

function IconButton({ onPress, children, label }: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="items-center justify-center active:opacity-60"
      style={{ minWidth: 52 }}
    >
      <View className="w-10 h-10 items-center justify-center">
        {children}
      </View>
      <Text className="text-xs text-gray-400 mt-0.5" style={{ fontSize: 10 }}>
        {label}
      </Text>
    </Pressable>
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
  // Ring opacity animations
  const ring1Opacity = useSharedValue(0);
  const ring2Opacity = useSharedValue(0);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (isRecording) {
      // 마이크 버튼 scale pulse
      scale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 500 }),
          withTiming(1.0,  { duration: 500 }),
        ),
        -1,
      );
      // Ring1 opacity pulse
      ring1Opacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.2, { duration: 600 }),
        ),
        -1,
      );
      // Ring2 opacity pulse (오프셋으로 자연스럽게)
      ring2Opacity.value = withRepeat(
        withSequence(
          withTiming(0.15, { duration: 200 }),
          withTiming(0.5, { duration: 400 }),
          withTiming(0.1, { duration: 600 }),
        ),
        -1,
      );
    } else {
      cancelAnimation(scale);
      cancelAnimation(ring1Opacity);
      cancelAnimation(ring2Opacity);
      scale.value = withTiming(1.0, { duration: 150 });
      ring1Opacity.value = withTiming(0, { duration: 200 });
      ring2Opacity.value = withTiming(0, { duration: 200 });
    }
    return () => {
      cancelAnimation(scale);
      cancelAnimation(ring1Opacity);
      cancelAnimation(ring2Opacity);
    };
  }, [isRecording]);

  const micAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const ring1Style = useAnimatedStyle(() => ({
    opacity: ring1Opacity.value,
  }));

  const ring2Style = useAnimatedStyle(() => ({
    opacity: ring2Opacity.value,
  }));

  const micRingSize1 = MIC_SIZE + RING1_OFFSET * 2;
  const micRingSize2 = MIC_SIZE + RING2_OFFSET * 2;

  return (
    <View className="flex-row items-center justify-around px-8 py-4 border-t border-gray-100">
      {/* 속도 */}
      <IconButton
        onPress={onPlaybackRateToggle}
        label={playbackRate === 0.75 ? '속도 0.75x' : '속도 1x'}
      >
        <Ionicons
          name="speedometer-outline"
          size={24}
          color={playbackRate === 0.75 ? BLUE : GRAY}
        />
      </IconButton>

      {/* 블라인드 모드 */}
      <IconButton
        onPress={onBlindModeToggle}
        label={
          blindMode === 0 ? '가리기 OFF' : blindMode === 1 ? '가리기 Lv1' : '가리기 Lv2'
        }
      >
        <BlindIcon blindMode={blindMode} />
      </IconButton>

      {/* 마이크 (중앙) — 2중 링 pulse */}
      <View
        className="items-center justify-center"
        style={{ width: micRingSize2, height: micRingSize2 }}
      >
        {/* Ring2 — 더 연한 바깥 링 */}
        <Animated.View
          style={[
            ring2Style,
            {
              position: 'absolute',
              width: micRingSize2,
              height: micRingSize2,
              borderRadius: micRingSize2 / 2,
              borderWidth: 2,
              borderColor: RED,
            },
          ]}
        />
        {/* Ring1 — 안쪽 링 */}
        <Animated.View
          style={[
            ring1Style,
            {
              position: 'absolute',
              width: micRingSize1,
              height: micRingSize1,
              borderRadius: micRingSize1 / 2,
              borderWidth: 2,
              borderColor: RED,
            },
          ]}
        />
        {/* 마이크 버튼 */}
        <Animated.View style={micAnimStyle}>
          <Pressable
            onPress={onMicPress}
            className="rounded-full items-center justify-center active:opacity-80"
            style={{
              width: MIC_SIZE,
              height: MIC_SIZE,
              backgroundColor: isRecording ? RED : BLUE,
            }}
          >
            <Ionicons name="mic-outline" size={30} color="white" />
          </Pressable>
        </Animated.View>
      </View>

      {/* 스크립트 */}
      <IconButton onPress={onScriptPress} label="전체보기">
        <Ionicons name="list-outline" size={24} color={GRAY} />
      </IconButton>

      {/* 루프 */}
      <IconButton
        onPress={onLoopToggle}
        label={isLooping ? '반복 ON' : '반복'}
      >
        <Ionicons
          name="repeat-outline"
          size={24}
          color={isLooping ? BLUE : GRAY}
        />
      </IconButton>
    </View>
  );
}
