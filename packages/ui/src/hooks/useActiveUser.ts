import { useSyncExternalStore } from 'react';
import { authChangedEvent } from '../auth/authClient';
import type { UserStore } from '../storage/userStore';

type ActiveUserStore = Pick<UserStore, 'activeUserChangedEvent' | 'getActiveUser'>;

export function CreateUseActiveUser(store: ActiveUserStore): () => string | null {
  function Subscribe(onStoreChange: () => void): () => void {
    window.addEventListener(store.activeUserChangedEvent, onStoreChange);
    window.addEventListener(authChangedEvent, onStoreChange);
    window.addEventListener('storage', onStoreChange);
    return () => {
      window.removeEventListener(store.activeUserChangedEvent, onStoreChange);
      window.removeEventListener(authChangedEvent, onStoreChange);
      window.removeEventListener('storage', onStoreChange);
    };
  }

  return function useActiveUser(): string | null {
    return useSyncExternalStore(Subscribe, store.getActiveUser, store.getActiveUser);
  };
}
