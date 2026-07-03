import { useSyncExternalStore } from 'react';
import { AUTH_CHANGED_EVENT } from '../auth/authClient';
import type { UserStore } from '../storage/userStore';

type ActiveUserStore = Pick<UserStore, 'activeUserChangedEvent' | 'getActiveUser'>;

export function createUseActiveUser(store: ActiveUserStore): () => string | null {
  function subscribe(onStoreChange: () => void): () => void {
    window.addEventListener(store.activeUserChangedEvent, onStoreChange);
    window.addEventListener(AUTH_CHANGED_EVENT, onStoreChange);
    window.addEventListener('storage', onStoreChange);
    return () => {
      window.removeEventListener(store.activeUserChangedEvent, onStoreChange);
      window.removeEventListener(AUTH_CHANGED_EVENT, onStoreChange);
      window.removeEventListener('storage', onStoreChange);
    };
  }

  return function useActiveUser(): string | null {
    return useSyncExternalStore(subscribe, store.getActiveUser, store.getActiveUser);
  };
}
