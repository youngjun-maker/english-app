import '../global.css';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Redirect, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOffline } from '@/hooks/useOffline';
import { supabase } from '@/utils/supabase';
import Toast from '@/components/common/Toast';
import { useAppStore } from '@/store/useAppStore';

type AppState = 'loading' | 'unauthenticated' | 'home';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [appState, setAppState] = useState<AppState>('loading');
  const { width: winW, height: winH } = useWindowDimensions();

  useOffline();

  useEffect(() => {
    // 초기 세션 확인 — store에도 반영
    supabase.auth.getSession().then(({ data: { session } }) => {
      useAppStore.getState().setSession(session);
      setAppState(session ? 'home' : 'unauthenticated');
    });

    // 로그인/로그아웃 이벤트 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      useAppStore.getState().setSession(session);
      setAppState(session ? 'home' : 'unauthenticated');

      // 로그인 시 users 테이블 upsert (신규 가입 + 재로그인 모두 처리)
      if (event === 'SIGNED_IN' && session?.user) {
        await supabase.from('users').upsert(
          {
            id: session.user.id,
            email: session.user.email ?? '',
            display_name:
              session.user.user_metadata?.['full_name'] ??
              session.user.user_metadata?.['name'] ??
              '',
            last_login_at: new Date().toISOString(),
          },
          { onConflict: 'id' },
        );
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (appState === 'loading') {
    return null;
  }

  const content = (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)/onboarding" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="chat/topic-select" />
        <Stack.Screen name="study/[expressionId]" />
        <Stack.Screen name="quiz/[sessionId]" />
        <Stack.Screen name="quiz/result/[sessionId]" />
        <Stack.Screen name="guide" />
      </Stack>
      {appState === 'unauthenticated' && <Redirect href="/(auth)/onboarding" />}
      {appState === 'home' && <Redirect href="/(tabs)/" />}
      <Toast />
      <StatusBar style="auto" />
    </ThemeProvider>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={{ width: winW, height: winH, backgroundColor: '#f3f4f6', alignItems: 'center' }}>
        <View style={{
          width: 390,
          height: winH,
          backgroundColor: 'white',
          overflow: 'hidden',
          // @ts-ignore
          boxShadow: '0 0 40px rgba(0,0,0,0.15)',
        }}>
          {content}
        </View>
      </View>
    );
  }

  return content;
}
