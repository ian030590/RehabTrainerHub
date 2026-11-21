import type { RehabPlayCount } from '@rehab-trainer/ui/auth/authClient';

type LobbyOrderCue = { tier: 'played' } | { tier: 'similar'; reasonGameId: string; score: number };

export const lobbySimilarityThreshold: number;
export function OrderLobbyGames<T extends { id: string }>(
  games: readonly T[],
  playCounts: readonly RehabPlayCount[],
  similarityScores: Readonly<Record<string, Readonly<Record<string, number>>>>,
): { games: readonly T[]; cues: ReadonlyMap<string, LobbyOrderCue> };
