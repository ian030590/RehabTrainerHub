import { GetAuthToken } from '@rehab-trainer/ui/auth/authClient';

export type PracticeSettings = Record<string, string | number | boolean>;

export interface PracticePlanItem {
  id: string;
  gameId: string;
  weeklyTarget: number;
  settings: PracticeSettings | null;
  completedThisWeek: number;
}

export interface PracticePlan {
  id: string;
  title: string;
  note: string;
  assignedBy: string | null;
  items: PracticePlanItem[];
  week: { start: string; end: string; achieved: boolean };
  achievedWeeks: number;
  currentStreak: number;
  weeksToTitle: number;
  titles: { id: string; awardedAt: string }[];
}

export async function FetchAssignedPracticePlan(signal?: AbortSignal): Promise<PracticePlan | null> {
  const token = GetAuthToken();
  if (!token) return null;
  const response = await fetch('/api/training-plans/current', {
    cache: 'no-store', signal, headers: { Authorization: `Bearer ${token}` },
  });
  // The feature answers 404 while it is switched off; players should not see an error for that.
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Unable to load practice list.');
  return (await response.json()).plan;
}
