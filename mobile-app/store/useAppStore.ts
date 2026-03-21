import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { User } from '@/types';

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
  showToast: (message: string) => void;
  clearToast: () => void;
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
          display_name: supabaseUser.user_metadata?.['display_name'] ?? '',
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
  showToast: (message) => set({ toastMessage: message }),
  clearToast: () => set({ toastMessage: null }),
}));
