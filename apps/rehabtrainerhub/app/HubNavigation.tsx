'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthPanel } from '@rehab-trainer/ui/components/AuthPanel';
import { RehabFooter } from '@rehab-trainer/ui/components/RehabFooter';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { HUB_LOCAL_NAME, HUB_NAME } from './hubBrand';
import { siteUrls } from './siteUrls';

export type HubNavKey = 'programs' | 'care' | 'education' | 'links' | 'submit';
export type HubLocale = 'zh-TW' | 'en';
type FontScale = 'standard' | 'large' | 'extra';
type Theme = 'light' | 'dark' | 'contrast';
type SectionId = 'programs' | 'care' | 'education';
type HubNavLabels = Record<HubNavKey, string>;

const storageKeys = {
  locale: 'rehabtrainerhub.locale',
  fontScale: 'rehabtrainerhub.fontScale',
  theme: 'rehabtrainerhub.theme',
} as const;

const fontScales: FontScale[] = ['standard', 'large', 'extra'];
const themes: Theme[] = ['light', 'dark', 'contrast'];
const homeSectionIds: SectionId[] = ['programs', 'care', 'education'];

const defaultLabels: HubNavLabels = {
  programs: '復健工具',
  care: '安全提醒',
  education: '衛教資訊',
  links: '衛教影片',
  submit: '合作投稿',
};

const navItems: Array<{ key: HubNavKey; href: string }> = [
  { key: 'programs', href: '/#apps-title' },
  { key: 'care', href: '/#care-title' },
  { key: 'education', href: '/education/' },
  { key: 'links', href: '/videos/' },
  { key: 'submit', href: '/collaborate/' },
];

const headerContent = {
  'zh-TW': {
    documentLanguage: 'zh-Hant-TW',
    navigationLabel: 'Rehab Trainer Hub 導覽',
    toggleMenuLabel: '切換選單',
    nav: defaultLabels,
    footer: {
      hub: '首頁',
      privacy: '隱私權政策',
      repo: 'GitHub',
      disclaimer: '本平台用於居家復健練習與流程原型展示，不提供醫療診斷或治療建議。使用前請諮詢醫師或治療師。',
      rights: '保留所有權利。',
      navigation: '頁尾導覽',
    },
    controls: {
      settingsLabel: '閱讀設定',
      settingsButton: '閱讀設定',
      settingsClose: '關閉設定',
      languageLabel: '介面語言',
      zh: '繁中',
      en: 'EN',
      fontLabel: '字體大小',
      standard: 'A',
      large: 'A+',
      extra: 'A++',
      themeLabel: '色彩模式',
      light: '淺色',
      dark: '深色',
      contrast: '高對比',
    },
  },
  en: {
    documentLanguage: 'en',
    navigationLabel: 'Rehab Trainer Hub navigation',
    toggleMenuLabel: 'Toggle menu',
    nav: {
      programs: 'Rehab Tools',
      care: 'Safety Notes',
      education: 'Education',
      links: 'Education Videos',
      submit: 'Collaboration',
    },
    footer: {
      hub: 'Home',
      privacy: 'Privacy',
      repo: 'GitHub',
      disclaimer: 'For home rehabilitation practice and workflow prototyping, not medical advice. Consult a physician or therapist before use.',
      rights: 'All rights reserved.',
      navigation: 'Footer navigation',
    },
    controls: {
      settingsLabel: 'Reading settings',
      settingsButton: 'Reading',
      settingsClose: 'Close settings',
      languageLabel: 'Interface language',
      zh: '繁中',
      en: 'EN',
      fontLabel: 'Font size',
      standard: 'A',
      large: 'A+',
      extra: 'A++',
      themeLabel: 'Color mode',
      light: 'Light',
      dark: 'Dark',
      contrast: 'High contrast',
    },
  },
} as const;

interface HubNavigationProps {
  activeKey?: HubNavKey;
  labels?: Partial<HubNavLabels>;
  navigationLabel?: string;
}

interface HubSiteHeaderProps extends HubNavigationProps {
  headerTools?: ReactNode;
  menuTools?: ReactNode;
  onNavigate?: () => void;
  toggleMenuLabel?: string;
}

interface HubReadabilityState {
  locale: HubLocale;
  fontScale: FontScale;
  theme: Theme;
  setLocale: Dispatch<SetStateAction<HubLocale>>;
  setFontScale: Dispatch<SetStateAction<FontScale>>;
  setTheme: Dispatch<SetStateAction<Theme>>;
}

const HubReadabilityContext = createContext<HubReadabilityState | null>(null);

function labelFor(labels: Partial<HubNavLabels> | undefined, key: HubNavKey) {
  return labels?.[key] ?? defaultLabels[key];
}

function isLocale(value: string | null): value is HubLocale {
  return value === 'zh-TW' || value === 'en';
}

function isFontScale(value: string | null): value is FontScale {
  return value === 'standard' || value === 'large' || value === 'extra';
}

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark' || value === 'contrast';
}

function useStoredSetting<T extends string>(
  key: string,
  fallback: T,
  validator: (value: string | null) => value is T,
) {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(key);
    if (validator(storedValue)) setValue(storedValue);
  }, [key, validator]);

  useEffect(() => {
    window.localStorage.setItem(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}

function getRouteNavKey(pathname: string): HubNavKey | undefined {
  if (pathname.startsWith('/education')) return 'education';
  if (pathname.startsWith('/videos') || pathname.startsWith('/links')) return 'links';
  if (pathname.startsWith('/collaborate')) return 'submit';
  return undefined;
}

export function useHubReadability() {
  const context = useContext(HubReadabilityContext);
  if (!context) throw new Error('useHubReadability must be used inside HubShell.');
  return context;
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
    <nav className="header-actions" aria-label={navigationLabel ?? 'Rehab Trainer Hub navigation'}>
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

function LanguageSwitch({
  copy,
  locale,
  setLocale,
}: {
  copy: (typeof headerContent)[HubLocale]['controls'];
  locale: HubLocale;
  setLocale: Dispatch<SetStateAction<HubLocale>>;
}) {
  return (
    <div className="control-group language-switch" role="group" aria-label={copy.languageLabel}>
      <button
        aria-pressed={locale === 'zh-TW'}
        className={locale === 'zh-TW' ? 'is-active' : ''}
        onClick={() => setLocale('zh-TW')}
        type="button"
      >
        {copy.zh}
      </button>
      <button
        aria-pressed={locale === 'en'}
        className={locale === 'en' ? 'is-active' : ''}
        onClick={() => setLocale('en')}
        type="button"
      >
        {copy.en}
      </button>
    </div>
  );
}

export function HubSiteHeader({
  activeKey,
  headerTools,
  labels,
  menuTools,
  navigationLabel,
  onNavigate,
  toggleMenuLabel,
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
            <strong>{HUB_NAME}</strong>
            <span className="brand-local-name">{HUB_LOCAL_NAME}</span>
          </span>
        </Link>

        {headerTools}

        <button
          className="navbar-toggle"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-controls="site-menu"
          aria-expanded={isMenuOpen}
          aria-label={toggleMenuLabel ?? 'Toggle menu'}
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
        {menuTools}
      </div>

      {isMenuOpen && <div className="navbar-overlay" onClick={closeMenu} />}
    </header>
  );
}

export function HubBottomNav({ activeKey, labels, navigationLabel }: HubNavigationProps) {
  return (
    <nav className="bottom-nav" aria-label={navigationLabel ?? 'Rehab Trainer Hub navigation'}>
      {navItems.map((item) => (
        <Link className={activeKey === item.key ? 'is-active' : ''} href={item.href} key={item.key}>
          {labelFor(labels, item.key)}
        </Link>
      ))}
    </nav>
  );
}

export function HubShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [locale, setLocale] = useStoredSetting<HubLocale>(storageKeys.locale, 'zh-TW', isLocale);
  const [fontScale, setFontScale] = useStoredSetting<FontScale>(
    storageKeys.fontScale,
    'standard',
    isFontScale,
  );
  const [theme, setTheme] = useStoredSetting<Theme>(storageKeys.theme, 'light', isTheme);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState<SectionId>('programs');
  const copy = headerContent[locale];

  useEffect(() => {
    const root = document.documentElement;
    root.lang = copy.documentLanguage;
    root.dataset.locale = locale;
    root.dataset.fontScale = fontScale;
    root.dataset.theme = theme;
  }, [copy.documentLanguage, fontScale, locale, theme]);

  useEffect(() => {
    if (pathname !== '/') return;

    const sections = homeSectionIds
      .map((sectionId) => document.getElementById(sectionId))
      .filter((section): section is HTMLElement => Boolean(section));

    if (!sections.length || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];

        if (visibleEntry) setCurrentSection(visibleEntry.target.id as SectionId);
      },
      {
        rootMargin: '-32% 0px -48% 0px',
        threshold: [0.1, 0.35, 0.65],
      },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [pathname]);

  const activeKey = pathname === '/'
    ? currentSection === 'programs' || currentSection === 'care'
      ? currentSection
      : undefined
    : getRouteNavKey(pathname);

  const contextValue = useMemo(
    () => ({ locale, fontScale, theme, setLocale, setFontScale, setTheme }),
    [fontScale, locale, theme],
  );

  const closeHeaderPanels = () => setIsSettingsOpen(false);

  return (
    <HubReadabilityContext.Provider value={contextValue}>
      <HubSiteHeader
        activeKey={activeKey}
        headerTools={(
          <div className="header-tools">
            <LanguageSwitch copy={copy.controls} locale={locale} setLocale={setLocale} />
          </div>
        )}
        labels={copy.nav}
        menuTools={(
          <div className="menu-tools">
            <AuthPanel
              appName={HUB_NAME}
              className="home-auth-panel"
              locale={locale === 'en' ? 'en' : 'zh-TW'}
            />

            <button
              aria-controls="readability-panel"
              aria-expanded={isSettingsOpen}
              className={`settings-toggle secondary-action compact ${isSettingsOpen ? 'is-active' : ''}`}
              onClick={() => setIsSettingsOpen((open) => !open)}
              type="button"
            >
              {copy.controls.settingsButton}
            </button>

            <div
              className={`readability-panel ${isSettingsOpen ? 'is-open' : ''}`}
              id="readability-panel"
              role="region"
              aria-label={copy.controls.settingsLabel}
            >
              <div className="readability-toolbar">
                <div className="control-group" role="group" aria-label={copy.controls.fontLabel}>
                  {fontScales.map((scale) => (
                    <button
                      aria-pressed={fontScale === scale}
                      className={fontScale === scale ? 'is-active' : ''}
                      key={scale}
                      onClick={() => setFontScale(scale)}
                      type="button"
                    >
                      {copy.controls[scale]}
                    </button>
                  ))}
                </div>

                <div className="control-group" role="group" aria-label={copy.controls.themeLabel}>
                  {themes.map((mode) => (
                    <button
                      aria-pressed={theme === mode}
                      className={theme === mode ? 'is-active' : ''}
                      key={mode}
                      onClick={() => setTheme(mode)}
                      type="button"
                    >
                      {copy.controls[mode]}
                    </button>
                  ))}
                </div>
              </div>
              <button className="text-button" type="button" onClick={() => setIsSettingsOpen(false)}>
                {copy.controls.settingsClose}
              </button>
            </div>
          </div>
        )}
        navigationLabel={copy.navigationLabel}
        onNavigate={closeHeaderPanels}
        toggleMenuLabel={copy.toggleMenuLabel}
      />
      <HubBottomNav activeKey={activeKey} labels={copy.nav} navigationLabel={copy.navigationLabel} />
      {children}
      <RehabFooter
        appName={HUB_NAME}
        hubHref={siteUrls.hub}
        privacyHref={`${siteUrls.hub}/privacy/`}
        labels={copy.footer}
      />
    </HubReadabilityContext.Provider>
  );
}
