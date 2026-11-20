import { useEffect, useState, useSyncExternalStore } from 'react';
import { authChangedEvent, authTokenKey, FetchRehabProgress, GetAuthToken } from '@rehab-trainer/ui/auth/authClient';
import { guestLobbyHistoryKey, lobbyActivitySavedEvent, NormalizeActivityHistory, ReadGuestLobbyHistory, type LobbyActivity } from './lobbyActivityHistory.js';
import { useHubAuth } from './HubNavigation';

function SubscribeToAuth(update: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === authTokenKey || event.key === null) update();
  };
  window.addEventListener(authChangedEvent, update);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(authChangedEvent, update);
    window.removeEventListener('storage', onStorage);
  };
}

const serverAuthToken = () => undefined;

export function useLobbyActivityHistory(knownIds: ReadonlySet<string>) {
  // Shared-session restoration can set the token silently before updating the Hub user.
  useHubAuth();
  const token = useSyncExternalStore<string | null | undefined>(SubscribeToAuth, GetAuthToken, serverAuthToken);
  const [account, setAccount] = useState<{ token: string; history: LobbyActivity[] } | null>(null);
  const [guestHistory, setGuestHistory] = useState<LobbyActivity[]>([]);

  useEffect(() => {
    if (token !== null) return;
    const refresh = () => setGuestHistory(ReadGuestLobbyHistory(window, knownIds));
    const onStorage = (event: StorageEvent) => {
      if (event.key === guestLobbyHistoryKey || event.key === null) refresh();
    };
    refresh();
    window.addEventListener(lobbyActivitySavedEvent, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(lobbyActivitySavedEvent, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, [knownIds, token]);

  useEffect(() => {
    if (!token) {
      setAccount(null);
      return;
    }
    let generation = 0;
    const refresh = () => {
      if (GetAuthToken() !== token) return;
      const request = ++generation;
      const apply = (history: LobbyActivity[]) => {
        if (request === generation && GetAuthToken() === token) setAccount({ token, history });
      };
      void FetchRehabProgress(window.location.origin)
        .then((progress) => apply(NormalizeActivityHistory(progress?.recentModules, null, 3)))
        .catch(() => apply([]));
    };
    refresh();
    window.addEventListener(lobbyActivitySavedEvent, refresh);
    return () => {
      generation++;
      window.removeEventListener(lobbyActivitySavedEvent, refresh);
    };
  }, [token]);

  if (token === null) return guestHistory;
  return token && account?.token === token ? account.history : [];
}
