import { useCallback, useEffect, useState } from 'react';
import type { UserStore } from '../storage/userStore';

type Translate = (key: string, params?: Record<string, string | number>) => string;

export interface UserSelectorProps {
  groupClassName?: string;
  iconClassName?: string;
  iconStroke?: string;
  onActiveUserChange?: (userName: string | null) => void;
  showFullscreenToggle?: boolean;
  store: UserStore;
  t: Translate;
}

export function UserSelector({
  groupClassName,
  iconClassName,
  iconStroke = 'var(--accent)',
  onActiveUserChange,
  showFullscreenToggle = false,
  store,
  t,
}: UserSelectorProps) {
  const [users, setUsers] = useState(store.getUsers);
  const [activeUser, setActiveUserState] = useState(store.getActiveUser);
  const [newName, setNewName] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);

  const refreshUsers = useCallback(() => {
    setUsers(store.getUsers());
    setActiveUserState(store.getActiveUser());
  }, [store]);

  useEffect(() => {
    refreshUsers();
    window.addEventListener('storage', refreshUsers);
    window.addEventListener(store.activeUserChangedEvent, refreshUsers);
    return () => {
      window.removeEventListener('storage', refreshUsers);
      window.removeEventListener(store.activeUserChangedEvent, refreshUsers);
    };
  }, [refreshUsers, store.activeUserChangedEvent]);

  useEffect(() => {
    onActiveUserChange?.(activeUser);
  }, [activeUser, onActiveUserChange]);

  const handleSelectUser = (name: string) => {
    const nextUser = name || null;
    store.setActiveUser(nextUser);
    setActiveUserState(nextUser);
  };

  const handleAddUser = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    store.addUser(trimmed);
    store.setActiveUser(trimmed);
    setNewName('');
    setShowAddUser(false);
    refreshUsers();
  };

  const handleRemoveUser = (name: string) => {
    if (!window.confirm(t('home.deleteUserPrompt', { name }))) return;
    store.removeUser(name);
    refreshUsers();
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen?.();
    } else {
      void document.exitFullscreen?.();
    }
  };

  const selector = (
    <>
      <div className="user-selector">
        <svg
          className={iconClassName}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={iconStroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <select value={activeUser || ''} onChange={(event) => handleSelectUser(event.target.value)}>
          <option value="">{t('home.selectUser')}</option>
          {users.map((user) => (
            <option key={user} value={user}>{user}</option>
          ))}
        </select>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddUser((current) => !current)}>
          {showAddUser ? t('btn.cancel') : t('btn.add')}
        </button>
        {activeUser && (
          <button className="btn btn-danger btn-sm" onClick={() => handleRemoveUser(activeUser)}>
            {t('btn.delete')}
          </button>
        )}
        {showFullscreenToggle && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleToggleFullscreen}
            title={t('home.toggleFullscreen')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3" />
              <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
              <path d="M3 16v3a2 2 0 0 0 2 2h3" />
              <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          </button>
        )}
      </div>

      {showAddUser && (
        <div className="user-selector user-selector-add fade-in">
          <input
            className="input"
            type="text"
            placeholder={t('home.enterUserName')}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleAddUser()}
            autoFocus
          />
          <button className="btn btn-primary btn-sm" onClick={handleAddUser}>
            {t('btn.confirmAdd')}
          </button>
        </div>
      )}
    </>
  );

  return groupClassName ? <div className={groupClassName}>{selector}</div> : selector;
}
