'use client';

import Image from 'next/image';
import Link from 'next/link';
import { AuthPanel } from '@rehab-trainer/ui/components/AuthPanel';
import { useEffect, useMemo, useState } from 'react';
import { siteUrls } from './siteUrls';

type Locale = 'zh-TW' | 'en';
type FontScale = 'standard' | 'large' | 'extra';
type Theme = 'light' | 'dark';

const storageKeys = {
  locale: 'rehabtrainerhub.locale',
  fontScale: 'rehabtrainerhub.fontScale',
  theme: 'rehabtrainerhub.theme',
} as const;

const fontScales: FontScale[] = ['standard', 'large', 'extra'];
const themes: Theme[] = ['light', 'dark'];
type SectionId = 'programs' | 'care' | 'education';
const homeSectionIds: SectionId[] = ['programs', 'care', 'education'];

const content = {
  'zh-TW': {
    documentLanguage: 'zh-Hant-TW',
    brandSubtitle: '居家復健入口',
    navigationLabel: 'RehabTrainerHub 導覽',
    nav: {
      programs: '復健工具',
      care: '安全提醒',
      education: '衛教資訊',
      links: '相關連結',
      submit: '合作投稿',
    },
    hero: {
      eyebrow: '居家復健入口',
      title: '我想找中風後在家可以練習的工具',
      body:
        '請依目前需要選擇中風復健或視覺訓練。這些工具可輔助居家練習，但不能取代醫師或治療師的評估。',
      primaryAction: '選擇工具',
      secondaryAction: '查看安全提醒',
      visualLabel: 'RehabTrainerHub 工具總覽',
      checklist: ['中風練習', '視覺訓練', '字體可放大'],
    },
    controls: {
      settingsLabel: '閱讀設定',
      settingsButton: '閱讀設定',
      settingsClose: '關閉設定',
      languageLabel: '介面語言',
      zh: '繁體中文',
      en: 'EN',
      fontLabel: '字型大小',
      standard: 'A',
      large: 'A+',
      extra: 'A++',
      themeLabel: '色彩模式',
      light: '淺色模式',
      dark: '深色模式',
      contrastLabel: '對比度',
      contrastLoading: '檢查中',
      contrastPass: '通過 WCAG AAA',
      contrastWarn: '通過 WCAG AA',
      contrastFail: '未達 AA',
    },
    programs: {
      eyebrow: '先選工具',
      title: '你現在想練什麼？',
      intro:
        '如果想練動作、認知或說話，請選中風復健；如果看字、閱讀或眼睛移動比較困難，請選視覺訓練。',
    },
    care: {
      eyebrow: '安全提醒',
      title: '開始前先確認安全',
      quote:
        '練習時如果感到不舒服，請先停止。網站提供工具與說明，不提供診斷。',
      body:
        '第一次使用建議家人陪同，先短時間練習，再依治療師建議調整。',
    },
    education: {
      eyebrow: '衛教資訊',
      title: '看不懂時，先看簡短說明',
      intro:
        '衛教頁整理開始前要注意的事、何時需要停止，以及每種訓練的用途。',
      educationLink: '閱讀衛教',
      linksLink: '相關連結',
    },
    apps: [
      {
        id: 'stroke',
        title: 'StrokeTrainer',
        localTitle: '中風復健練習',
        name: 'StrokeTrainer',
        bestFor: '適合：動作、認知、說話練習',
        description:
          '將治療師交代的方向，整理成適合在家短時間練習的任務。',
        points: ['動作協調', '注意力記憶', '口腔語音'],
        action: '開啟中風',
        logoAlt: 'StrokeTrainer 標誌',
      },
      {
        id: 'vision',
        title: 'VisionTrainer',
        localTitle: '視覺訓練練習',
        name: 'VisionTrainer',
        bestFor: '適合：看字、閱讀、眼動練習',
        description:
          '提供視覺搜尋、閱讀眼動與對比辨識練習，適合依專業建議使用。',
        points: ['視覺搜尋', '閱讀眼動', '對比辨識'],
        action: '開啟視覺',
        logoAlt: 'VisionTrainer 標誌',
      },
    ],
    features: [
      {
        title: '有人陪同',
        text:
          '第一次使用時，請家人在旁協助選工具與確認安全。',
      },
      {
        title: '專業確認',
        text:
          '不確定適不適合時，請先詢問醫師或治療師。',
      },
      {
        title: '短時練習',
        text:
          '每次先短時間練習；如果累、暈或痛，請立刻停止。',
      },
      {
        title: '步驟確認',
        text:
          '如果看不懂步驟，請先停下來，找家人或治療師確認。',
      },
    ],
  },
  en: {
    documentLanguage: 'en',
    brandSubtitle: 'Home rehabilitation hub',
    navigationLabel: 'RehabTrainerHub navigation',
    nav: {
      programs: 'Programs',
      care: 'Safety',
      education: 'Education',
      links: 'Links',
      submit: 'Submit',
    },
    hero: {
      eyebrow: 'Integrated home rehabilitation portal',
      title: 'A clearer entry point for home rehabilitation tools',
      body:
        'Choose stroke recovery or vision training. These tools support home practice and do not replace clinical care.',
      primaryAction: 'View programs',
      secondaryAction: 'Read guidance',
      visualLabel: 'RehabTrainerHub tool overview',
      checklist: ['Stroke practice', 'Vision training', 'Larger text'],
    },
    controls: {
      settingsLabel: 'Reading settings',
      settingsButton: 'Reading',
      settingsClose: 'Close',
      languageLabel: 'Interface language',
      zh: '繁體中文',
      en: 'EN',
      fontLabel: 'Font size',
      standard: 'A',
      large: 'A+',
      extra: 'A++',
      themeLabel: 'Color mode',
      light: 'Light',
      dark: 'Dark',
      contrastLabel: 'Contrast',
      contrastLoading: 'Checking',
      contrastPass: 'WCAG AAA pass',
      contrastWarn: 'WCAG AA pass',
      contrastFail: 'Below AA',
    },
    programs: {
      eyebrow: 'Targeted recovery programs',
      title: 'Choose stroke recovery or vision training by need',
      intro:
        'For movement, cognition, or speech after stroke, choose StrokeTrainer. For reading or eye movement, choose VisionTrainer.',
    },
    care: {
      eyebrow: 'Clinical care at home',
      title: 'Turn professional guidance into daily practice',
      quote:
        'Stop if you feel unwell. This site does not diagnose or treat.',
      body:
        'Use it first with a family member or caregiver. Keep each session short.',
    },
    education: {
      eyebrow: 'Guidance and related resources',
      title: 'Understand safety principles before training',
      intro:
        'Review setup, stop signs, and what each exercise trains.',
      educationLink: 'Read education materials',
      linksLink: 'View related links',
    },
    apps: [
      {
        id: 'stroke',
        title: 'StrokeTrainer',
        localTitle: 'Stroke rehabilitation',
        name: 'StrokeTrainer',
        bestFor: 'Best for movement, cognition, and speech',
        description:
          'Short home exercises based on therapist goals.',
        points: ['Coordination', 'Attention and memory', 'Oral speech'],
        action: 'Open StrokeTrainer',
        logoAlt: 'StrokeTrainer logo',
      },
      {
        id: 'vision',
        title: 'VisionTrainer',
        localTitle: 'Vision rehabilitation',
        name: 'VisionTrainer',
        bestFor: 'Best for reading and eye movement',
        description:
          'Practice visual search, reading, eye movement, and contrast.',
        points: ['Visual search', 'Reading and eye movement', 'Contrast'],
        action: 'Open VisionTrainer',
        logoAlt: 'VisionTrainer logo',
      },
    ],
    features: [
      {
        title: 'Clear usage limitations',
        text:
          'Each tool states when it should be used.',
      },
      {
        title: 'Taiwan-ready Traditional Chinese',
        text:
          'Chinese copy uses Taiwan Traditional Chinese.',
      },
      {
        title: 'Bilingual interface',
        text:
          'Switch between Traditional Chinese and English.',
      },
      {
        title: 'Readability settings',
        text:
          'Use larger text, dark mode, and contrast checks.',
      },
    ],
  },
} as const;

const appAssets = {
  stroke: {
    href: siteUrls.stroke,
    image: '/assets/stroke-logo.png',
  },
  vision: {
    href: siteUrls.vision,
    image: '/assets/vision-logo.png',
  },
} as const;

function isLocale(value: string | null): value is Locale {
  return value === 'zh-TW' || value === 'en';
}

function isFontScale(value: string | null): value is FontScale {
  return value === 'standard' || value === 'large' || value === 'extra';
}

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark';
}

function hexToRgb(hex: string) {
  const normalized = hex.trim().replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function getRelativeLuminance(value: number) {
  const channel = value / 255;
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function getContrastRatio(foreground: string, background: string) {
  const foregroundRgb = hexToRgb(foreground);
  const backgroundRgb = hexToRgb(background);
  if (!foregroundRgb || !backgroundRgb) return null;

  const foregroundLuminance =
    0.2126 * getRelativeLuminance(foregroundRgb.r) +
    0.7152 * getRelativeLuminance(foregroundRgb.g) +
    0.0722 * getRelativeLuminance(foregroundRgb.b);
  const backgroundLuminance =
    0.2126 * getRelativeLuminance(backgroundRgb.r) +
    0.7152 * getRelativeLuminance(backgroundRgb.g) +
    0.0722 * getRelativeLuminance(backgroundRgb.b);

  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function getCssVariable(name: string) {
  return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
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

export function ReadableHome() {
  const [locale, setLocale] = useStoredSetting<Locale>(storageKeys.locale, 'zh-TW', isLocale);
  const [fontScale, setFontScale] = useStoredSetting<FontScale>(
    storageKeys.fontScale,
    'standard',
    isFontScale,
  );
  const [theme, setTheme] = useStoredSetting<Theme>(storageKeys.theme, 'light', isTheme);
  const [contrastRatio, setContrastRatio] = useState<number | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState<SectionId>('programs');
  const copy = content[locale];

  useEffect(() => {
    const root = document.documentElement;
    root.lang = copy.documentLanguage;
    root.dataset.locale = locale;
    root.dataset.fontScale = fontScale;
    root.dataset.theme = theme;
  }, [copy.documentLanguage, fontScale, locale, theme]);

  useEffect(() => {
    const checkContrast = () => {
      const pairs = [
        [getCssVariable('--text'), getCssVariable('--background')],
        [getCssVariable('--primary'), getCssVariable('--surface-lowest')],
        [getCssVariable('--on-secondary'), getCssVariable('--secondary')],
      ] as const;
      const ratios = pairs
        .map(([foreground, background]) => getContrastRatio(foreground, background))
        .filter((ratio): ratio is number => ratio !== null);

      setContrastRatio(ratios.length ? Math.min(...ratios) : null);
    };

    window.requestAnimationFrame(checkContrast);
  }, [theme]);

  useEffect(() => {
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
  }, []);

  const contrastText = useMemo(() => {
    if (contrastRatio === null) {
      return {
        ratio: '--',
        status: copy.controls.contrastLoading,
      };
    }

    if (contrastRatio >= 7) {
      return {
        ratio: `${contrastRatio.toFixed(1)}:1`,
        status: copy.controls.contrastPass,
      };
    }

    if (contrastRatio >= 4.5) {
      return {
        ratio: `${contrastRatio.toFixed(1)}:1`,
        status: copy.controls.contrastWarn,
      };
    }

    return {
      ratio: `${contrastRatio.toFixed(1)}:1`,
      status: copy.controls.contrastFail,
    };
  }, [
    contrastRatio,
    copy.controls.contrastFail,
    copy.controls.contrastLoading,
    copy.controls.contrastPass,
    copy.controls.contrastWarn,
  ]);

  const closeHeaderPanels = () => {
    setIsMenuOpen(false);
    setIsSettingsOpen(false);
  };
  const sectionLinkClass = (sectionId: SectionId) => `nav-link ${currentSection === sectionId ? 'is-active' : ''}`;

  return (
    <main className="home-page" id="top">
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href="/" onClick={closeHeaderPanels}>
            <span className="brand-mark" aria-hidden="true">
              <Image src="/rehabtrainerhub.png" alt="" width={44} height={44} priority />
            </span>
            <span>
              <strong>RehabTrainerHub</strong>
              <small>{copy.brandSubtitle}</small>
            </span>
          </Link>

          <button
            className="navbar-toggle"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-controls="site-menu"
            aria-expanded={isMenuOpen}
            aria-label="Toggle menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isMenuOpen ? (
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
        </div>

        <div className={`header-stack ${isMenuOpen ? 'is-open' : ''}`} id="site-menu">
          <nav className="header-actions" aria-label={copy.navigationLabel}>
            <a className={sectionLinkClass('programs')} href="#apps-title" onClick={closeHeaderPanels}>{copy.nav.programs}</a>
            <a className={sectionLinkClass('care')} href="#care-title" onClick={closeHeaderPanels}>{copy.nav.care}</a>
            <a className={sectionLinkClass('education')} href="#education-title" onClick={closeHeaderPanels}>{copy.nav.education}</a>
            <Link className="nav-link" href="/links/" onClick={closeHeaderPanels}>{copy.nav.links}</Link>
            <Link className="nav-link" href="/collaborate/" onClick={closeHeaderPanels}>{copy.nav.submit}</Link>
          </nav>

          <div className="header-tools">
            <button
              aria-controls="readability-panel"
              aria-expanded={isSettingsOpen}
              className={`settings-toggle secondary-action compact ${isSettingsOpen ? 'is-active' : ''}`}
              onClick={() => setIsSettingsOpen((open) => !open)}
              type="button"
            >
              {copy.controls.settingsButton}
            </button>

            <AuthPanel
              appName="RehabTrainerHub"
              className="home-auth-panel"
              locale={locale === 'en' ? 'en' : 'zh-TW'}
            />
          </div>

          <div
            className={`readability-panel ${isSettingsOpen ? 'is-open' : ''}`}
            id="readability-panel"
            role="region"
            aria-label={copy.controls.settingsLabel}
          >
            <div className="readability-toolbar">
            <div className="control-group" role="group" aria-label={copy.controls.languageLabel}>
              <button
                aria-pressed={locale === 'zh-TW'}
                className={locale === 'zh-TW' ? 'is-active' : ''}
                onClick={() => setLocale('zh-TW')}
                type="button"
              >
                {copy.controls.zh}
              </button>
              <button
                aria-pressed={locale === 'en'}
                className={locale === 'en' ? 'is-active' : ''}
                onClick={() => setLocale('en')}
                type="button"
              >
                {copy.controls.en}
              </button>
            </div>

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
            <p className="contrast-status">
              {copy.controls.contrastLabel} {contrastText.ratio} {contrastText.status}
            </p>
            <button className="text-button" type="button" onClick={() => setIsSettingsOpen(false)}>
              {copy.controls.settingsClose}
            </button>
          </div>
        </div>
        {isMenuOpen && <div className="navbar-overlay" onClick={closeHeaderPanels} />}
      </header>

      <nav className="bottom-nav" aria-label={copy.navigationLabel}>
        <a className={sectionLinkClass('programs')} href="#apps-title">{copy.nav.programs}</a>
        <a className={sectionLinkClass('care')} href="#care-title">{copy.nav.care}</a>
        <a className={sectionLinkClass('education')} href="#education-title">{copy.nav.education}</a>
        <Link href="/links/">{copy.nav.links}</Link>
        <Link href="/collaborate/">{copy.nav.submit}</Link>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{copy.hero.eyebrow}</p>
          <h1>{copy.hero.title}</h1>
          <p>{copy.hero.body}</p>
          <div className="hero-actions">
            <a className="primary-action" href="#apps-title">
              {copy.hero.primaryAction}
            </a>
            <a className="secondary-action" href="#care-title">
              {copy.hero.secondaryAction}
            </a>
          </div>
        </div>
        <div className="hero-panel" aria-label={copy.hero.visualLabel}>
          <div className="hero-device">
            <div className="device-topbar" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="device-content">
              <Image src="/assets/stroke-logo.png" alt="" width={112} height={74} priority />
              <Image src="/assets/vision-logo.png" alt="" width={112} height={74} priority />
            </div>
          </div>
          <div className="hero-checklist">
            {copy.hero.checklist.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="app-section" id="programs" aria-labelledby="apps-title">
        <div className="section-heading">
          <p className="eyebrow">{copy.programs.eyebrow}</p>
          <h2 id="apps-title">{copy.programs.title}</h2>
          <span>{copy.programs.intro}</span>
        </div>
        <div className="app-grid">
          {copy.apps.map((app) => {
            const asset = appAssets[app.id];
            return (
              <article className="app-card" key={app.id}>
                <div className="app-card-media">
                  <Image src={asset.image} alt={app.logoAlt} width={144} height={92} />
                </div>
                <div className="app-body">
                  <p>{app.name}</p>
                  <h3>{app.localTitle}</h3>
                  <strong>{app.bestFor}</strong>
                  <span>{app.description}</span>
                  <ul className="app-points">
                    {app.points.map((point) => <li key={point}>{point}</li>)}
                  </ul>
                </div>
                <a className="app-link" href={asset.href}>
                  {app.action}
                  <span aria-hidden="true">-&gt;</span>
                </a>
              </article>
            );
          })}
        </div>
      </section>

      <section className="care-section" id="care" aria-labelledby="care-title">
        <div className="care-copy">
          <p className="eyebrow">{copy.care.eyebrow}</p>
          <h2 id="care-title">{copy.care.title}</h2>
          <blockquote>{copy.care.quote}</blockquote>
          <p>{copy.care.body}</p>
        </div>
        <div className="feature-grid">
          {copy.features.map((card, index) => (
            <article className="feature-card" key={card.title}>
              <span aria-hidden="true">{index + 1}</span>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="education-section" id="education" aria-labelledby="education-title">
        <div className="section-heading">
          <p className="eyebrow">{copy.education.eyebrow}</p>
          <h2 id="education-title">{copy.education.title}</h2>
          <span>{copy.education.intro}</span>
        </div>
        <div className="section-links">
          <Link className="text-link" href="/education/">
            {copy.education.educationLink}
          </Link>
          <Link className="text-link" href="/links/">
            {copy.education.linksLink}
          </Link>
        </div>
      </section>
    </main>
  );
}
