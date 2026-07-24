'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AuthPanel } from '@rehab-trainer/ui/components/AuthPanel';
import type { AuthUser } from '@rehab-trainer/ui/auth/authClient';
import { hubName } from './hubBrand';
import { siteUrls } from './siteUrls';

const navigationItems = [
  { href: '/', label: '訓練大廳' },
  { href: '/progress/', label: '進度追蹤' },
  { href: '/qa/', label: '問答中心' },
] as const;

interface HubAuthContextValue {
  user: AuthUser | null;
}

const hubAuthContext = createContext<HubAuthContextValue>({ user: null });

export function useHubAuth() {
  return useContext(hubAuthContext);
}

export function HubShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setIsAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isAccountOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsAccountOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAccountOpen]);

  return (
    <hubAuthContext.Provider value={{ user }}>
      <header className="hub-header">
        <Link className="hub-brand" href="/" aria-label="Rehab Trainer Hub 訓練大廳">
          <Image src="/rehabtrainerhub.svg" alt="" width={42} height={42} priority />
          <span>
            <strong>Rehab Trainer Hub</strong>
            <small>居家訓練網</small>
          </span>
        </Link>

        <nav className="hub-nav" aria-label="主要導覽">
          {navigationItems.map((item) => {
            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
            return (
              <Link className={isActive ? 'is-active' : ''} href={item.href} key={item.href}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="account-menu" ref={accountMenuRef}>
          <button
            aria-controls="hub-account-panel"
            aria-expanded={isAccountOpen}
            aria-label={user ? `${user.displayName} 帳號選單` : '帳號選單'}
            className={`account-menu-button ${user ? 'is-signed-in' : ''}`}
            onClick={() => setIsAccountOpen((open) => !open)}
            title={user ? user.displayName : '帳號'}
            type="button"
          >
            <span className="material-symbols-outlined" aria-hidden="true">account_circle</span>
          </button>

          <div
            className="account-popover"
            hidden={!isAccountOpen}
            id="hub-account-panel"
          >
            {user && <p className="account-name">{user.displayName}</p>}
            <AuthPanel
              apiBase={siteUrls.hub}
              appName={hubName}
              className="hub-auth-panel"
              locale="zh-TW"
              onAuthChange={setUser}
              privacyHref={`${siteUrls.hub}/privacy/`}
            />
          </div>
        </div>
      </header>

      {children}
    </hubAuthContext.Provider>
  );
}
