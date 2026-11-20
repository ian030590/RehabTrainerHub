export interface LobbyActivity {
  gameId: string;
  playedAt: string;
}

type HistoryDevice = Pick<Window, 'localStorage' | 'dispatchEvent'>;

export const guestLobbyHistoryKey: string;
export const lobbyActivitySavedEvent: string;
export function NormalizeActivityHistory(entries: unknown, knownIds: ReadonlySet<string> | null, limit: number): LobbyActivity[];
export function ReadGuestLobbyHistory(device: HistoryDevice, knownIds: ReadonlySet<string>): LobbyActivity[];
export function PublishLobbyActivity(device: HistoryDevice, gameId: string, playedAt: string, isGuest: boolean): void;
