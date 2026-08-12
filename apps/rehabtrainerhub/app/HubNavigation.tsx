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
import { AccountAvatar } from '@rehab-trainer/ui/components/AccountAvatar';
import { RehabFooter } from '@rehab-trainer/ui/components/RehabFooter';
import type { AuthUser } from '@rehab-trainer/ui/auth/authClient';
import { PwaRegistration } from '@rehab-trainer/ui/pwa';
import { hubLocalName, hubName } from './hubBrand';
import { GetHubUiCopy } from './i18n';
import { HubLanguageProvider, useHubLanguage } from './i18n/HubLanguage';
import { siteUrls } from './siteUrls';

const navigationHrefs = ['/', '/progress/', '/qa/', '/download/'] as const;

function IsStaffUser(user: AuthUser | null): boolean {
  const role = (user as (AuthUser & { role?: unknown }) | null)?.role;
  return role === 'therapist' || role === 'admin';
}

interface HubAuthContextValue {
  user: AuthUser | null;
}

const hubAuthContext = createContext<HubAuthContextValue>({ user: null });

export function useHubAuth() {
  return useContext(hubAuthContext);
}

export function HubShell({ children }: { children: ReactNode }) {
  return (
    <HubLanguageProvider>
      <HubShellContent>{children}</HubShellContent>
    </HubLanguageProvider>
  );
}

function HubShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const { language, locale, setLanguage } = useHubLanguage();
  const isStaff = IsStaffUser(user);
  const isTrainingRoute = pathname === '/train' || pathname.startsWith('/train/');
  const copy = GetHubUiCopy(language).navigation;
  const nextLanguage = language === 'en' ? 'zh' : 'en';

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
      <div className={`hub-shell${isTrainingRoute ? ' hub-shell-training' : ''}`}>
        <PwaRegistration />
        {!isTrainingRoute && (
          <header className="hub-header">
            <Link className="hub-brand" href="/" aria-label={`${hubLocalName} ${hubName}`}>
              <Image src="/rehabtrainerhub.svg" alt="" width={42} height={42} priority />
              <span>
                <strong>{hubLocalName}</strong>
                <small>{hubName}</small>
              </span>
            </Link>

            <nav className="hub-nav" aria-label={copy.navigationLabel}>
              {navigationHrefs.map((href, index) => {
                const isActive = href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(href);
                return (
                  <Link className={isActive ? 'is-active' : ''} href={href} key={href}>
                    {copy.navigationItems[index]}
                  </Link>
                );
              })}
            </nav>

            <div className="hub-header-actions">
              <button
                aria-label={copy.switchLanguage}
                className="hub-language-toggle"
                onClick={() => setLanguage(nextLanguage)}
                title={copy.switchLanguage}
                type="button"
              >
                <img
                  alt=""
                  aria-hidden="true"
                  src={language === 'en' ? '/assets/flags/us.svg' : '/assets/flags/tw.svg'}
                />
                <span className="sr-only">{copy.flagLabel}</span>
              </button>

              <div className="account-menu" ref={accountMenuRef}>
                <button
                  aria-controls="hub-account-panel"
                  aria-expanded={isAccountOpen}
                  aria-label={user ? `${user.displayName} — ${copy.accountMenu}` : copy.accountMenu}
                  className={`account-menu-button ${user ? 'is-signed-in' : ''}`}
                  onClick={() => setIsAccountOpen((open) => !open)}
                  title={user ? user.displayName : copy.accountMenu}
                  type="button"
                >
                  <AccountAvatar
                    alt=""
                    avatarUrl={user?.avatarUrl}
                    className="account-avatar"
                    fallback={<span className="material-symbols-outlined" aria-hidden="true">account_circle</span>}
                  />
                </button>

                <div
                  className="account-popover"
                  hidden={!isAccountOpen}
                  id="hub-account-panel"
                >
                  {user && <p className="account-name">{user.displayName}</p>}
                  {isStaff && (
                    <Link
                      aria-current={pathname.startsWith('/admin/') ? 'page' : undefined}
                      className="account-admin-link"
                      href="/admin/"
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">clinical_notes</span>
                      {copy.admin}
                    </Link>
                  )}
                  <AuthPanel
                    apiBase={siteUrls.hub}
                    appName={hubName}
                    className="hub-auth-panel"
                    locale={locale}
                    onAuthChange={setUser}
                    privacyHref={`${siteUrls.hub}/privacy/`}
                    turnstileSiteKey={
                      process.env.NEXT_PUBLIC_TURNSTILE_AUTH_REQUIRED === '1'
                        ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
                        : undefined
                    }
                  />
                </div>
              </div>
            </div>
          </header>
        )}

        <div className={`hub-content${isTrainingRoute ? ' hub-content-training' : ''}`}>{children}</div>
        {!isTrainingRoute && (
          <RehabFooter
            appName="Rehab Trainer Hub"
            className="hub-footer"
            downloadHref="/download/"
            innerClassName="hub-footer-inner"
            privacyHref="/privacy/"
            showRights={false}
            labels={{
              hub: copy.footer.hub,
              download: copy.footer.download,
              privacy: copy.footer.privacy,
              repo: 'GitHub',
              disclaimer: copy.footer.disclaimer,
              navigation: copy.footer.navigation,
            }}
          />
        )}
      </div>
    </hubAuthContext.Provider>
  );
}
