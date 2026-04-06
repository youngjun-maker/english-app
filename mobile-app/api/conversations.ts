import type { Conversation } from '@/types';
import type { APIError } from '@/types';
import { apiFetch } from '@/utils/apiFetch';
import { supabase } from '@/utils/supabase';

async function handleError(res: Response): Promise<never> {
  const data = (await res.json()) as APIError;
  const code = data.error?.code;

  if (code === 'UNAUTHORIZED') {
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      await supabase.auth.signOut(); // _layout.tsx onAuthStateChange가 리다이렉트 처리
    }
  }
  throw data;
}

export async function createConversation(
  topicId: string,
  topicLabel: string,
  missionId?: string,
): Promise<Conversation> {
  const body: Record<string, string> = { topic_id: topicId, topic_label: topicLabel };
  if (missionId) body.mission_id = missionId;

  const res = await apiFetch('/api/conversations', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) return handleError(res);
  return res.json();
}

export async function fetchConversations(): Promise<Conversation[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw { error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다' } };

  const { data, error } = await supabase.rpc('get_conversations_with_turns', {
    p_user_id: user.id,
  });
  if (error) throw { error: { code: 'INTERNAL_ERROR', message: error.message } };
  return data || [];
}
