import '../global.css';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Redirect, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/utils/supabase';
import Toast from '@/components/common/Toast';

type AppState = 'loading' | 'unauthenticated' | 'home';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [appState, setAppState] = useState<AppState>('loading');
  const { width: winW, height: winH } = useWindowDimensions();

  useEffect(() => {
    // 초기 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAppState(session ? 'home' : 'unauthenticated');
    });

    // 로그인/로그아웃 이벤트 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAppState(session ? 'home' : 'unauthenticated');
    });

    return () => subscription.unsubscribe();
  }, []);

  if (appState === 'loading') {
    return null;
  }

  const content = (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="chat" options={{ headerShown: false }} />
        <Stack.Screen name="study" options={{ headerShown: false }} />
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
