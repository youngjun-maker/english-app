import { apiFetch } from '@/utils/apiFetch';

export type WeeklyReport = {
  summary: string;
  total_turns: number;
  weak_points: Array<{
    category: string;
    count: number;
    examples: Array<{ original: string; corrected: string }>;
  }>;
  praise: string;
  next_goal: string;
};

export type WeeklyReportResponse = {
  report: WeeklyReport | null;
  cached: boolean;
  totalTurns?: number;
  message?: string;
};

export async function fetchWeeklyReport(): Promise<WeeklyReportResponse> {
  const res = await apiFetch('/api/reports/weekly');
  if (!res.ok) {
    const data = await res.json();
    throw data;
  }
  return res.json();
}
