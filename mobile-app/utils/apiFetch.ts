import { API_BASE_URL } from '@/constants';
import { useAppStore } from '@/store/useAppStore';

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const session = useAppStore.getState().session;
  const token = session?.access_token;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // FormData 요청(STT)에서는 Content-Type을 브라우저/RN이 자동 설정(multipart boundary 포함)하므로
  // string body일 때만 JSON Content-Type을 명시한다.
  if (typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}
