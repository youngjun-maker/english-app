import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { useAppStore } from '@/store/useAppStore';
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

// 로그인 성공 후 router.replace는 불필요:
// _layout.tsx의 onAuthStateChange가 세션 감지 → appState → Redirect 처리

export default function OnboardingScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const showToast = useAppStore((s) => s.showToast);
  const SLIDE_WIDTH = Platform.OS === 'web' ? 390 : windowWidth;

  async function handleGoogleLogin() {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const redirectUri = makeRedirectUri({ scheme: 'englishapp' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUri, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        if (result.type === 'success' && result.url) {
          const fragment = result.url.split('#')[1] ?? '';
          const params = new URLSearchParams(fragment);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          if (access_token && refresh_token) {
            const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
            if (sessionError) throw sessionError;
          }
        }
      }
    } catch {
      showToast('로그인에 실패했어요. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAppleLogin() {
    if (isLoading) return;
    setIsLoading(true);
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
      if (error) throw error;
    } catch (e: unknown) {
      // 사용자가 직접 취소한 경우는 Toast 불필요
      if ((e as { code?: string }).code !== 'ERR_REQUEST_CANCELED') {
        showToast('로그인에 실패했어요. 다시 시도해주세요.');
      }
    } finally {
      setIsLoading(false);
    }
  }

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
              className={`w-full bg-blue-500 rounded-2xl py-4 items-center active:opacity-80 ${isLoading ? 'opacity-60' : ''}`}
              onPress={handleGoogleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-base font-semibold">Google로 시작하기</Text>
              )}
            </Pressable>

            {Platform.OS === 'ios' && (
              <Pressable
                className={`w-full bg-gray-900 rounded-2xl py-4 items-center active:opacity-80 ${isLoading ? 'opacity-60' : ''}`}
                onPress={handleAppleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white text-base font-semibold">Apple로 시작하기</Text>
                )}
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
