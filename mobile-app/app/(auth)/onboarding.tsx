import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { supabase } from '@/utils/supabase';

// OAuth redirect 처리 완료 — 컴포넌트 외부 최상단에서 반드시 호출
WebBrowser.maybeCompleteAuthSession();

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

async function signInWithGoogle(): Promise<void> {
  const redirectUri = makeRedirectUri({ scheme: 'com.fyuer.englishapp' });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectUri },
  });
  if (error) {
    console.error('Google OAuth error:', error.message);
    return;
  }
  if (data.url) {
    await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
  }
}

async function signInWithApple(): Promise<void> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken!,
    });
    if (error) {
      console.error('Apple Sign In error:', error.message);
    }
  } catch (e: unknown) {
    // 사용자가 직접 취소한 경우는 에러 로그 불필요
    if ((e as { code?: string }).code !== 'ERR_REQUEST_CANCELED') {
      console.error('Apple Sign In error:', e);
    }
  }
}

// 로그인 성공 후 router.replace는 불필요:
// _layout.tsx의 onAuthStateChange가 세션 감지 → appState → Redirect 처리

export default function OnboardingScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const { width: windowWidth } = useWindowDimensions();
  const SLIDE_WIDTH = Platform.OS === 'web' ? 390 : windowWidth;

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SLIDE_WIDTH);
    setCurrentIndex(index);
  }

  function goToNext() {
    const next = currentIndex + 1;
    scrollRef.current?.scrollTo({ x: next * SLIDE_WIDTH, animated: true });
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
            style={{ width: SLIDE_WIDTH }}
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
              currentIndex === slide.id ? 'w-6 bg-blue-500' : 'w-2 bg-gray-300'
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
              onPress={signInWithGoogle}
            >
              <Text className="text-white text-base font-semibold">Google로 시작하기</Text>
            </Pressable>

            {Platform.OS === 'ios' && (
              <Pressable
                className="w-full bg-gray-900 rounded-2xl py-4 items-center active:opacity-80"
                onPress={signInWithApple}
              >
                <Text className="text-white text-base font-semibold">Apple로 시작하기</Text>
              </Pressable>
            )}
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
