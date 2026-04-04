import { View, Text, Pressable } from 'react-native';
import { useEffect } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';

type Props = {
  title: string;
  onReplay: () => void;
  onBack: () => void;
};

export default function CompletionOverlay({ title, onReplay, onBack }: Props) {
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 180 });
    opacity.value = withTiming(1, { duration: 280 });
  }, []);

  const bgStyle = useAnimatedStyle(() => ({ opacity: opacity.value * 0.65 }));
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));

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
        className="mx-8 bg-white rounded-3xl px-6 py-8 items-center"
        style={cardStyle}
      >
        <Text className="text-5xl mb-3">🎉</Text>
        <Text className="text-xl font-bold text-gray-900 mb-1 text-center">완주했어요!</Text>
        <Text className="text-sm text-gray-400 text-center mb-6" numberOfLines={2}>{title}</Text>
        <View className="flex-row gap-3 w-full">
          <Pressable
            onPress={onReplay}
            className="flex-1 py-3 rounded-xl border border-gray-200 items-center active:opacity-60"
          >
            <Text className="text-sm font-semibold text-gray-700">다시 보기</Text>
          </Pressable>
          <Pressable
            onPress={onBack}
            className="flex-1 py-3 rounded-xl bg-blue-500 items-center active:opacity-80"
          >
            <Text className="text-sm font-semibold text-white">목록으로</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}
