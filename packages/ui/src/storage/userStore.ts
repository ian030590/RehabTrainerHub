export interface UserStore {
  activeUserChangedEvent: string;
  addUser: (name: string) => void;
  getActiveUser: () => string | null;
  getUsers: () => string[];
  removeUser: (name: string) => void;
  setActiveUser: (name: string | null) => void;
}

interface CreateUserStoreOptions {
  activeUserChangedEvent: string;
  storagePrefix: string;
}

export function createUserStore({
  activeUserChangedEvent,
  storagePrefix,
}: CreateUserStoreOptions): UserStore {
  const usersKey = `${storagePrefix}users`;
  const activeUserKey = `${storagePrefix}active_user`;

  function getUsers(): string[] {
    const raw = localStorage.getItem(usersKey);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((user): user is string => typeof user === 'string') : [];
    } catch {
      return [];
    }
  }

  function getActiveUser(): string | null {
    return localStorage.getItem(activeUserKey) || null;
  }

  function setActiveUser(name: string | null): void {
    if (name) {
      localStorage.setItem(activeUserKey, name);
    } else {
      localStorage.removeItem(activeUserKey);
    }
    window.dispatchEvent(new Event(activeUserChangedEvent));
  }

  function addUser(name: string): void {
    const users = getUsers();
    if (!users.includes(name)) {
      users.push(name);
      localStorage.setItem(usersKey, JSON.stringify(users));
    }
  }

  function removeUser(name: string): void {
    const users = getUsers().filter((user) => user !== name);
    localStorage.setItem(usersKey, JSON.stringify(users));
    if (getActiveUser() === name) {
      setActiveUser(null);
    }
  }

  return {
    activeUserChangedEvent,
    addUser,
    getActiveUser,
    getUsers,
    removeUser,
    setActiveUser,
  };
}
