import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { User } from '@/types';
import type { ShadowingMode, BlindMode } from '@/types/shadowing';

const TURN_LIMIT = 20;

interface AppState {
  // 인증 상태
  user: User | null;
  session: Session | null;
  setSession: (session: Session | null) => void;
  clearSession: () => void;

  // 일일 턴 제한 상태
  todayTurnCount: number;
  isTurnLimitReached: boolean;
  setTodayTurnCount: (count: number) => void;
  incrementTurnCount: () => void;
  resetTurnCount: () => void;

  // UI 전역 상태
  isTypingIndicatorVisible: boolean;
  setTypingIndicator: (visible: boolean) => void;

  // 토스트 메시지
  toastMessage: string | null;
  toastType: 'success' | 'error' | 'info';
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;

  // 네트워크 상태
  isOffline: boolean;
  setIsOffline: (value: boolean) => void;

  // 섀도잉 상태
  shadowingMode: ShadowingMode;
  isLooping: boolean;
  blindMode: BlindMode;
  playbackRate: 0.75 | 1.0;
  currentSentenceIndex: number;
  isRecording: boolean;
  setShadowingMode: (mode: ShadowingMode) => void;
  setIsLooping: (v: boolean) => void;
  setBlindMode: (v: BlindMode) => void;
  setPlaybackRate: (v: 0.75 | 1.0) => void;
  setCurrentSentenceIndex: (i: number) => void;
  setIsRecording: (v: boolean) => void;
  resetShadowingState: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // 인증 상태
  user: null,
  session: null,
  setSession: (session) => {
    // Supabase Session.user와 프로젝트 User 타입은 구조가 다름.
    // 실제 User 레코드는 Supabase DB에서 별도 조회해 채워야 하며,
    // 여기서는 세션만 저장하고 user는 auth 훅에서 setUser로 채운다.
    // session?.user.id 등 최소 필드만 임시 매핑.
    const supabaseUser = session?.user ?? null;
    const mappedUser: User | null = supabaseUser
      ? {
          id: supabaseUser.id,
          email: supabaseUser.email ?? '',
          // Google OAuth → full_name / name, Apple → full_name, 기존 display_name 순서로 fallback
          // 모두 없으면 이메일 앞부분 → 'User' 순으로 최후 fallback
          display_name:
            supabaseUser.user_metadata?.['display_name'] ??
            supabaseUser.user_metadata?.['full_name'] ??
            supabaseUser.user_metadata?.['name'] ??
            supabaseUser.email?.split('@')[0] ??
            'User',
          created_at: supabaseUser.created_at,
          last_login_at: supabaseUser.last_sign_in_at ?? supabaseUser.created_at,
        }
      : null;
    set({ session, user: mappedUser });
  },
  clearSession: () => set({ session: null, user: null }),

  // 일일 턴 제한 상태
  todayTurnCount: 0,
  isTurnLimitReached: false,
  setTodayTurnCount: (count) =>
    set({ todayTurnCount: count, isTurnLimitReached: count >= TURN_LIMIT }),
  incrementTurnCount: () => {
    const next = get().todayTurnCount + 1;
    set({ todayTurnCount: next, isTurnLimitReached: next >= TURN_LIMIT });
  },
  resetTurnCount: () => set({ todayTurnCount: 0, isTurnLimitReached: false }),

  // UI 전역 상태
  isTypingIndicatorVisible: false,
  setTypingIndicator: (visible) => set({ isTypingIndicatorVisible: visible }),

  // 토스트 메시지
  toastMessage: null,
  toastType: 'info',
  showToast: (message, type = 'info') => set({ toastMessage: message, toastType: type }),
  clearToast: () => set({ toastMessage: null, toastType: 'info' }),

  // 네트워크 상태
  isOffline: false,
  setIsOffline: (value) => set({ isOffline: value }),

  // 섀도잉 상태
  shadowingMode: '1',
  isLooping: false,
  blindMode: 0,
  playbackRate: 1.0,
  currentSentenceIndex: 0,
  isRecording: false,
  setShadowingMode: (mode) => set({ shadowingMode: mode }),
  setIsLooping: (v) => set({ isLooping: v }),
  setBlindMode: (v) => set({ blindMode: v }),
  setPlaybackRate: (v) => set({ playbackRate: v }),
  setCurrentSentenceIndex: (i) => set({ currentSentenceIndex: i }),
  setIsRecording: (v) => set({ isRecording: v }),
  resetShadowingState: () => set({
    shadowingMode: '1',
    isLooping: false,
    blindMode: 0,
    playbackRate: 1.0,
    currentSentenceIndex: 0,
    isRecording: false,
  }),
}));
