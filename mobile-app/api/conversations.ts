import type { Conversation } from '@/types';

export async function createConversation(
  _topicId: string,
  _topicLabel: string,
): Promise<Conversation> {
  throw new Error('Not implemented');
}

export async function fetchConversations(): Promise<Conversation[]> {
  throw new Error('Not implemented');
}
