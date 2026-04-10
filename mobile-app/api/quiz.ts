import { apiFetch } from '@/utils/apiFetch';
import type {
  GenerateQuizResponse,
  QuizSession,
  QuizSessionDetail,
} from '@/types/quiz';

type APIError = { error: { code: string; message: string } };

async function handleError(res: Response): Promise<never> {
  const data = (await res.json()) as APIError;
  throw data;
}

export async function generateQuiz(): Promise<GenerateQuizResponse> {
  const res = await apiFetch('/api/quiz/generate', { method: 'POST' });
  if (!res.ok) return handleError(res);
  return res.json();
}

export async function fetchQuizSessions(): Promise<QuizSession[]> {
  const res = await apiFetch('/api/quiz/sessions');
  if (!res.ok) return handleError(res);
  return res.json();
}

export async function fetchQuizSessionDetail(sessionId: string): Promise<QuizSessionDetail> {
  const res = await apiFetch(`/api/quiz/sessions/${sessionId}`);
  if (!res.ok) return handleError(res);
  return res.json();
}

export async function submitQuizResult(
  sessionId: string,
  answers: Array<{ expression_id: string; is_correct: boolean }>
): Promise<void> {
  const res = await apiFetch(`/api/quiz/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) return handleError(res);
}
