import { useState, type ComponentProps } from 'react';
import { NavLink } from 'react-router-dom';
import { type AuthLocale } from '../auth/authClient';
import { AuthPanel } from './AuthPanel';

export type TrainerNavbarLinkClassName = ComponentProps<typeof NavLink>['className'];

export interface TrainerNavbarItem {
  to: string;
  label: string;
  className?: TrainerNavbarLinkClassName;
  end?: boolean;
}

interface TrainerNavbarFooterLink {
  href: string;
  label: string;
  external?: boolean;
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
  toggleMenuLabel?: string;
}

const defaultNavLinkClass: TrainerNavbarLinkClassName = ({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`;
const logoStyle = { width: 'auto', objectFit: 'contain' } as const;

export function TrainerNavbar({
  brandLabel,
  brandHref = '/',
  logoSrc,
  logoAlt,
  logoHeight = 22,
  navItems,
  auth,
  download,
  toggleMenuLabel = 'Toggle menu',
}: TrainerNavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDownloadingScores, setIsDownloadingScores] = useState(false);
  const footerLinks: TrainerNavbarFooterLink[] = [
    { href: auth.apiBase, label: 'Hub' },
    { href: `${auth.apiBase.replace(/\/+$/, '')}/privacy/`, label: auth.locale === 'en' ? 'Privacy' : '隱私權政策' },
    { href: 'https://github.com/ian030590/RehabTrainerHub', label: 'GitHub', external: true },
  ];

  const toggleMenu = () => setIsOpen((open) => !open);
  const closeMenu = () => setIsOpen(false);
  const handleDownloadScores = async () => {
    if (isDownloadingScores) return;

    setIsDownloadingScores(true);
    try {
      const downloaded = await download.onDownload();
      if (!downloaded) {
        window.alert(download.noScoresMessage);
      }
      closeMenu();
    } catch (error) {
      console.error('Unable to download training scores.', error);
      window.alert(download.errorMessage);
    } finally {
      setIsDownloadingScores(false);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <NavLink to={brandHref} className="navbar-brand" onClick={closeMenu}>
          <img src={logoSrc} alt={logoAlt} height={logoHeight} style={logoStyle} />
          {brandLabel}
        </NavLink>

        <button className="navbar-toggle" onClick={toggleMenu} aria-label={toggleMenuLabel}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>

        <div className={`navbar-menu ${isOpen ? 'is-open' : ''}`}>
          <div className="navbar-links">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={item.className ?? defaultNavLinkClass}
                onClick={closeMenu}
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="navbar-tools">
            <AuthPanel
              apiBase={auth.apiBase}
              appName={auth.appName}
              className="trainer-auth-panel"
              locale={auth.locale}
              turnstileSiteKey={
                auth.turnstileAuthRequired === true
                  ? auth.turnstileSiteKey
                  : undefined
              }
            />

            <div className="navbar-records">
              <button
                type="button"
                className="btn btn-primary btn-sm navbar-download-btn"
                onClick={() => void handleDownloadScores()}
                disabled={isDownloadingScores}
                aria-busy={isDownloadingScores}
              >
                {download.label}
              </button>
            </div>
          </div>

          {footerLinks.length > 0 && (
            <div className="navbar-footer-links">
              {footerLinks.map((link) => (
                <a
                  className="navbar-footer-link"
                  href={link.href}
                  key={`${link.label}-${link.href}`}
                  onClick={closeMenu}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  target={link.external ? '_blank' : undefined}
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
      {isOpen && <div className="navbar-overlay" onClick={closeMenu} />}
    </nav>
  );
}
