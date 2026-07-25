import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { type AuthLocale, type AuthUser } from '../auth/authClient';
import { AccountAvatar } from './AccountAvatar';
import { AuthPanel } from './AuthPanel';

export type TrainerNavbarLinkClassName = ComponentProps<typeof NavLink>['className'];

export interface TrainerNavbarItem {
  to: string;
  label: string;
  className?: TrainerNavbarLinkClassName;
  end?: boolean;
}

export interface TrainerNavbarProps {
  brandLabel: string;
  brandHref?: string;
  logoSrc: string;
  logoAlt: string;
  logoHeight?: number;
  navItems: TrainerNavbarItem[];
  auth: {
    apiBase: string;
    appName: string;
    locale: AuthLocale;
    turnstileAuthRequired?: boolean;
    turnstileSiteKey?: string;
  };
  download: {
    label: string;
    noScoresMessage: string;
    errorMessage: string;
    onDownload: () => Promise<boolean>;
  };
}

const defaultNavLinkClass: TrainerNavbarLinkClassName = ({ isActive }) => `trainer-hub-nav-link ${isActive ? 'is-active' : ''}`;
const logoStyle = { objectFit: 'contain' } as const;

function AccountIcon() {
  return (
    <svg aria-hidden="true" className="trainer-account-icon" viewBox="0 0 24 24">
      <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" fill="currentColor" />
    </svg>
  );
}

export function TrainerNavbar({
  brandLabel,
  brandHref = '/',
  logoSrc,
  logoAlt,
  logoHeight = 42,
  navItems,
  auth,
  download,
}: TrainerNavbarProps) {
  const location = useLocation();
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isDownloadingScores, setIsDownloadingScores] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const accountMenuLabel = auth.locale === 'en' ? 'Account menu' : '帳號選單';

  useEffect(() => {
    setIsAccountOpen(false);
  }, [location.pathname]);

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

  const handleDownloadScores = async () => {
    if (isDownloadingScores) return;

    setIsDownloadingScores(true);
    try {
      const downloaded = await download.onDownload();
      if (!downloaded) window.alert(download.noScoresMessage);
      setIsAccountOpen(false);
    } catch (error) {
      console.error('Unable to download training scores.', error);
      window.alert(download.errorMessage);
    } finally {
      setIsDownloadingScores(false);
    }
  };

  return (
    <header className="trainer-hub-header">
      <NavLink to={brandHref} className="trainer-hub-brand" onClick={() => setIsAccountOpen(false)}>
        <img src={logoSrc} alt={logoAlt} height={logoHeight} style={logoStyle} />
        <span>
          <strong>{brandLabel}</strong>
          <small>Rehab Trainer Hub</small>
        </span>
      </NavLink>

      <nav className="trainer-hub-nav" aria-label={auth.locale === 'en' ? 'Primary navigation' : '主要導覽'}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={item.className ?? defaultNavLinkClass}
            onClick={() => setIsAccountOpen(false)}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="trainer-account-menu" ref={accountMenuRef}>
        <button
          aria-controls="trainer-account-panel"
          aria-expanded={isAccountOpen}
          aria-label={user ? `${user.displayName} ${accountMenuLabel}` : accountMenuLabel}
          className={`trainer-account-menu-button ${user ? 'is-signed-in' : ''}`}
          onClick={() => setIsAccountOpen((open) => !open)}
          title={user ? user.displayName : accountMenuLabel}
          type="button"
        >
          <AccountAvatar
            alt=""
            avatarUrl={user?.avatarUrl}
            className="trainer-account-avatar"
            fallback={<AccountIcon />}
          />
        </button>

        <div className="trainer-account-popover" hidden={!isAccountOpen} id="trainer-account-panel">
          {user && <p className="trainer-account-name">{user.displayName}</p>}
          <AuthPanel
            apiBase={auth.apiBase}
            appName={auth.appName}
            className="trainer-hub-auth-panel"
            locale={auth.locale}
            onAuthChange={setUser}
            turnstileSiteKey={auth.turnstileAuthRequired === true ? auth.turnstileSiteKey : undefined}
          />
          <button
            aria-busy={isDownloadingScores}
            className="btn btn-primary btn-sm trainer-account-download-btn"
            disabled={isDownloadingScores}
            onClick={() => void handleDownloadScores()}
            type="button"
          >
            {download.label}
          </button>
        </div>
      </div>
    </header>
  );
}
