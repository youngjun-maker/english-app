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
): Promise<Conversation> {
  const res = await apiFetch('/api/conversations', {
    method: 'POST',
    body: JSON.stringify({ topic_id: topicId, topic_label: topicLabel }),
  });
  if (!res.ok) return handleError(res);
  return res.json();
}

export async function fetchConversations(): Promise<Conversation[]> {
  const res = await apiFetch('/api/conversations');
  if (!res.ok) return handleError(res);
  return res.json();
}
