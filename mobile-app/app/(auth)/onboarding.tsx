import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

const ONBOARDING_KEY = 'onboarding_completed';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
  id: number;
  title: string;
  subtitle: string;
  emoji: string;
  isLast?: boolean;
}

const SLIDES: Slide[] = [
  {
    id: 0,
    title: 'AI 선생님과\n부담 없이 영어로\n대화해요',
    subtitle: '언제 어디서나 편하게, 실전 영어 회화 연습',
    emoji: '💬',
  },
  {
    id: 1,
    title: '틀린 표현은 즉시 교정!\n완벽하면 칭찬!',
    subtitle: 'AI가 실시간으로 교정 피드백을 제공해요',
    emoji: '✏️',
  },
  {
    id: 2,
    title: '배운 표현은\n대화 문맥과 함께 저장',
    subtitle: '나만의 표현 학습장에서 복습해요',
    emoji: '📖',
    isLast: true,
  },
];

async function completeOnboarding(router: ReturnType<typeof useRouter>) {
  await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  router.replace('/(tabs)/');
}

export default function OnboardingScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentIndex(index);
  }

  function goToNext() {
    const next = currentIndex + 1;
    scrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
    setCurrentIndex(next);
  }

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
      >
        {SLIDES.map((slide) => (
          <View
            key={slide.id}
            style={{ width: SCREEN_WIDTH }}
            className="flex-1 items-center justify-center px-8"
          >
            <Text className="text-7xl mb-8">{slide.emoji}</Text>
            <Text className="text-3xl font-bold text-gray-900 text-center leading-tight mb-4">
              {slide.title}
            </Text>
            <Text className="text-base text-gray-500 text-center leading-relaxed">
              {slide.subtitle}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Dot indicators */}
      <View className="flex-row justify-center items-center gap-2 mb-8">
        {SLIDES.map((slide) => (
          <View
            key={slide.id}
            className={`h-2 rounded-full ${
              currentIndex === slide.id
                ? 'w-6 bg-blue-500'
                : 'w-2 bg-gray-300'
            }`}
          />
        ))}
      </View>

      {/* Bottom action area */}
      <View className="px-6 pb-12 gap-3">
        {isLastSlide ? (
          <>
            <Pressable
              className="w-full bg-blue-500 rounded-2xl py-4 items-center active:opacity-80"
              onPress={() => completeOnboarding(router)}
            >
              <Text className="text-white text-base font-semibold">
                Google로 시작하기
              </Text>
            </Pressable>

            <Pressable
              className="w-full bg-gray-900 rounded-2xl py-4 items-center active:opacity-80"
              onPress={() => completeOnboarding(router)}
            >
              <Text className="text-white text-base font-semibold">
                Apple로 시작하기
              </Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            className="w-full bg-blue-500 rounded-2xl py-4 items-center active:opacity-80"
            onPress={goToNext}
          >
            <Text className="text-white text-base font-semibold">다음</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
