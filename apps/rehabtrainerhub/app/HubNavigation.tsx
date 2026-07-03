'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

export type HubNavKey = 'programs' | 'care' | 'education' | 'links' | 'submit';
type HubNavLabels = Record<HubNavKey, string>;

const defaultLabels: HubNavLabels = {
  programs: '復健工具',
  care: '安全提醒',
  education: '衛教資訊',
  links: '相關連結',
  submit: '合作投稿',
};

const navItems: Array<{ key: HubNavKey; href: string }> = [
  { key: 'programs', href: '/#apps-title' },
  { key: 'care', href: '/#care-title' },
  { key: 'education', href: '/education/' },
  { key: 'links', href: '/links/' },
  { key: 'submit', href: '/collaborate/' },
];

interface HubNavigationProps {
  activeKey?: HubNavKey;
  labels?: Partial<HubNavLabels>;
  navigationLabel?: string;
}

interface HubSiteHeaderProps extends HubNavigationProps {
  brandSubtitle: string;
  onNavigate?: () => void;
  tools?: ReactNode;
}

function labelFor(labels: Partial<HubNavLabels> | undefined, key: HubNavKey) {
  return labels?.[key] ?? defaultLabels[key];
}

function MenuIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg className="icon-md" aria-hidden="true" viewBox="0 0 24 24" fill="none">
      {isOpen ? (
        <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
      )}
    </svg>
  );
}

function HubNavLinks({ activeKey, labels, navigationLabel, onNavigate }: HubNavigationProps & { onNavigate?: () => void }) {
  return (
    <nav className="header-actions" aria-label={navigationLabel ?? 'RehabTrainerHub navigation'}>
      {navItems.map((item) => (
        <Link
          className={`nav-link ${activeKey === item.key ? 'is-active' : ''}`}
          href={item.href}
          key={item.key}
          onClick={onNavigate}
        >
          {labelFor(labels, item.key)}
        </Link>
      ))}
    </nav>
  );
}

export function HubSiteHeader({
  activeKey,
  brandSubtitle,
  labels,
  navigationLabel,
  onNavigate,
  tools,
}: HubSiteHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeMenu = () => {
    setIsMenuOpen(false);
    onNavigate?.();
  };

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="brand" href="/" onClick={closeMenu}>
          <span className="brand-mark" aria-hidden="true">
            <Image src="/rehabtrainerhub.png" alt="" width={44} height={44} priority />
          </span>
          <span>
            <strong>RehabTrainerHub</strong>
            <small>{brandSubtitle}</small>
          </span>
        </Link>

        <button
          className="navbar-toggle"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-controls="site-menu"
          aria-expanded={isMenuOpen}
          aria-label="Toggle menu"
          type="button"
        >
          <MenuIcon isOpen={isMenuOpen} />
        </button>
      </div>

      <div className={`header-stack ${isMenuOpen ? 'is-open' : ''}`} id="site-menu">
        <HubNavLinks
          activeKey={activeKey}
          labels={labels}
          navigationLabel={navigationLabel}
          onNavigate={closeMenu}
        />
        {tools}
      </div>

      {isMenuOpen && <div className="navbar-overlay" onClick={closeMenu} />}
    </header>
  );
}

export function HubBottomNav({ activeKey, labels, navigationLabel }: HubNavigationProps) {
  return (
    <nav className="bottom-nav" aria-label={navigationLabel ?? 'RehabTrainerHub navigation'}>
      {navItems.map((item) => (
        <Link className={activeKey === item.key ? 'is-active' : ''} href={item.href} key={item.key}>
          {labelFor(labels, item.key)}
        </Link>
      ))}
    </nav>
  );
}
