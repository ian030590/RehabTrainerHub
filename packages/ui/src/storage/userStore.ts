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

export function CreateUserStore({
  activeUserChangedEvent,
  storagePrefix,
}: CreateUserStoreOptions): UserStore {
  const usersKey = `${storagePrefix}users`;
  const activeUserKey = `${storagePrefix}active_user`;

  function GetUsers(): string[] {
    const raw = localStorage.getItem(usersKey);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((user): user is string => typeof user === 'string') : [];
    } catch {
      return [];
    }
  }

  function GetActiveUser(): string | null {
    return localStorage.getItem(activeUserKey) || null;
  }

  function SetActiveUser(name: string | null): void {
    if (name) {
      localStorage.setItem(activeUserKey, name);
    } else {
      localStorage.removeItem(activeUserKey);
    }
    window.dispatchEvent(new Event(activeUserChangedEvent));
  }

  function AddUser(name: string): void {
    const users = GetUsers();
    if (!users.includes(name)) {
      users.push(name);
      localStorage.setItem(usersKey, JSON.stringify(users));
    }
  }

  function RemoveUser(name: string): void {
    const users = GetUsers().filter((user) => user !== name);
    localStorage.setItem(usersKey, JSON.stringify(users));
    if (GetActiveUser() === name) {
      SetActiveUser(null);
    }
  }

  return {
    activeUserChangedEvent,
    addUser: AddUser,
    getActiveUser: GetActiveUser,
    getUsers: GetUsers,
    removeUser: RemoveUser,
    setActiveUser: SetActiveUser,
  };
}
