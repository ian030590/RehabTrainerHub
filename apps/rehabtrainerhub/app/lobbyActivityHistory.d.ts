import type { RehabPlayCount } from '@rehab-trainer/ui/auth/authClient';

export interface LobbyActivity {
  gameId: string;
  playedAt: string;
}

type HistoryDevice = Pick<Window, 'localStorage' | 'dispatchEvent'>;

export const guestLobbyHistoryKey: string;
export const lobbyActivitySavedEvent: string;
export function ReadGuestLobbyHistory(device: HistoryDevice, knownIds: ReadonlySet<string>): LobbyActivity[];
export function SummarizeGuestLobbyHistory(history: readonly LobbyActivity[]): RehabPlayCount[];
export function NormalizeLobbyPlayCounts(entries: unknown): RehabPlayCount[];
export function PublishLobbyActivity(device: HistoryDevice, gameId: string, playedAt: string, isGuest: boolean): void;
