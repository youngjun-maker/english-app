import { View, Text, Pressable } from 'react-native';
import { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

type Stats = {
  sentences: number;
  duration: string;
  repeats: number;
};

type Props = {
  title: string;
  onReplay: () => void;
  onBack: () => void;
  stats?: Stats;
};

export default function CompletionOverlay({ title, onReplay, onBack, stats }: Props) {
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 180 });
    opacity.value = withTiming(1, { duration: 280 });
  }, []);

  const bgStyle = useAnimatedStyle(() => ({ opacity: opacity.value * 0.65 }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View className="absolute inset-0 items-center justify-center" pointerEvents="box-none">
      {/* 반투명 배경 */}
      <Animated.View
        className="absolute inset-0 bg-black"
        style={bgStyle}
        pointerEvents="none"
      />

      {/* 카드 */}
      <Animated.View
        className="mx-8 bg-white rounded-3xl overflow-hidden"
        style={cardStyle}
      >
        {/* 상단 콘텐츠 */}
        <View className="px-6 pt-8 pb-4 items-center">
          <Text className="text-5xl mb-3">🎉</Text>
          <Text className="text-xl font-bold text-gray-900 mb-1 text-center">완주했어요!</Text>
          <Text className="text-sm text-gray-400 text-center" numberOfLines={2}>
            {title}
          </Text>
        </View>

        {/* 통계 섹션 */}
        {stats && (
          <View
            className="mx-6 mb-5 rounded-2xl overflow-hidden flex-row"
            style={{ backgroundColor: '#F8FAFC' }}
          >
            <View
              className="flex-1 items-center py-3"
              style={{ borderRightWidth: 1, borderRightColor: '#E2E8F0' }}
            >
              <Text className="text-lg font-bold text-gray-900">{stats.sentences}</Text>
              <Text className="text-xs text-gray-400 mt-0.5">총 문장</Text>
            </View>
            <View
              className="flex-1 items-center py-3"
              style={{ borderRightWidth: 1, borderRightColor: '#E2E8F0' }}
            >
              <Text className="text-lg font-bold text-gray-900">{stats.duration}</Text>
              <Text className="text-xs text-gray-400 mt-0.5">소요 시간</Text>
            </View>
            <View className="flex-1 items-center py-3">
              <Text className="text-lg font-bold text-gray-900">{stats.repeats}x</Text>
              <Text className="text-xs text-gray-400 mt-0.5">반복 횟수</Text>
            </View>
          </View>
        )}

        {/* 버튼 영역 */}
        <View className="px-6 pb-8">
          {/* 다시 도전하기 — 풀너비 파란 버튼 */}
          <Pressable
            onPress={onReplay}
            className="w-full rounded-2xl py-3.5 items-center mb-3 active:opacity-80"
            style={{ backgroundColor: '#2563EB' }}
          >
            <Text className="text-base font-bold text-white">다시 도전하기</Text>
          </Pressable>

          {/* 목록으로 돌아가기 — 텍스트 링크 */}
          <Pressable onPress={onBack} className="items-center py-2 active:opacity-60">
            <Text className="text-sm text-gray-400 font-medium">목록으로 돌아가기</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}
