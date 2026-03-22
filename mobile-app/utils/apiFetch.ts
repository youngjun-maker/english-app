import { API_BASE_URL } from '@/constants';
import { useAppStore } from '@/store/useAppStore';
import { supabase } from '@/utils/supabase';

async function _doFetch(path: string, options: RequestInit): Promise<Response> {
  const session = useAppStore.getState().session;
  const token = session?.access_token;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // FormData 요청(STT)에서는 Content-Type을 RN이 자동 설정(multipart boundary 포함)하므로
  // string body일 때만 JSON Content-Type을 명시한다.
  if (typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const res = await _doFetch(path, options);

  if (res.status === 401) {
    // 토큰 갱신 시도
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) {
      // 갱신 성공 → 스토어 업데이트 후 원래 요청 1회 재시도
      useAppStore.getState().setSession(data.session);
      return _doFetch(path, options);
    } else {
      // 갱신 실패 → 로그아웃 (_layout.tsx onAuthStateChange가 로그인 화면으로 redirect)
      useAppStore.getState().clearSession();
      await supabase.auth.signOut();
    }
  }

  return res;
}
