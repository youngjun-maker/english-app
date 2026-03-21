import type { TranscribeResponse, SendMessageResponse, Expression } from '@/types';

export async function transcribeAudio(_audioUri: string): Promise<TranscribeResponse> {
  throw new Error('Not implemented');
}

export async function sendMessage(
  _conversationId: string,
  _text: string,
): Promise<SendMessageResponse> {
  throw new Error('Not implemented');
}

export async function fetchMessages(_conversationId: string): Promise<unknown[]> {
  throw new Error('Not implemented');
}

export async function saveExpression(_payload: Partial<Expression>): Promise<void> {
  throw new Error('Not implemented');
}

export async function playTTS(_text: string): Promise<void> {
  throw new Error('Not implemented');
}
