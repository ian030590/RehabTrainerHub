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

const content = {
  'zh-TW': {
    documentLanguage: 'zh-Hant-TW',
    brandSubtitle: '居家復健入口',
    navigationLabel: 'RehabTrainerHub 導覽',
    nav: {
      programs: '復健工具',
      care: '照護原則',
      education: '衛教資訊',
      links: '相關連結',
    },
    hero: {
      eyebrow: '居家復健整合入口',
      title: '把居家復健工具整理成清楚好用的入口',
      body:
        'RehabTrainerHub 匯集中風復健與視覺訓練工具，協助個案、家屬與治療師在家安排練習、理解使用限制，並快速前往合適的訓練系統。',
      primaryAction: '查看復健工具',
      secondaryAction: '閱讀衛教資訊',
      visualLabel: 'RehabTrainerHub 工具總覽',
      checklist: ['繁體中文與英文介面', '可調整字型大小', '深色模式與對比檢查'],
    },
    controls: {
      settingsLabel: '閱讀設定',
      languageLabel: '介面語言',
      zh: '繁中',
      en: 'EN',
      fontLabel: '字型大小',
      standard: 'A',
      large: 'A+',
      extra: 'A++',
      themeLabel: '色彩模式',
      light: '淺色',
      dark: '深色',
      contrastLabel: '對比度',
      contrastLoading: '檢查中',
      contrastPass: '通過 WCAG AAA',
      contrastWarn: '通過 WCAG AA',
      contrastFail: '未達 AA',
    },
    programs: {
      eyebrow: '分項復健工具',
      title: '依需要選擇中風復健或視覺訓練',
      intro:
        '兩個訓練系統各自部署，主頁提供清楚入口、用途說明與使用限制，方便個案與照護者快速找到合適工具。',
    },
    care: {
      eyebrow: '居家照護原則',
      title: '把專業建議轉成每天做得到的練習',
      quote:
        '本平台協助安排與紀錄居家練習，不提供醫療診斷，也不取代醫師或治療師的評估。',
      body:
        '使用前請先確認治療目標、身體狀況與安全環境。若訓練中出現疼痛、暈眩、視覺不適或其他不舒服，應立即停止並諮詢專業人員。',
    },
    education: {
      eyebrow: '衛教與延伸資料',
      title: '先理解安全原則，再開始訓練',
      intro:
        '整理復健練習前的注意事項、使用限制與相關資源，讓家人和照護者可以用同一套語言溝通。',
      educationLink: '閱讀衛教資料',
      linksLink: '查看相關連結',
    },
    apps: [
      {
        id: 'stroke',
        title: 'Stroke Recovery',
        localTitle: '中風復健',
        name: 'StrokeTrainer',
        description:
          '依照居家復健情境設計動作、語言與認知練習，讓中風後的日常訓練更容易開始、追蹤與維持。',
        action: '前往中風復健',
        logoAlt: 'StrokeTrainer 標誌',
      },
      {
        id: 'vision',
        title: 'Vision Training',
        localTitle: '視覺訓練',
        name: 'VisionTrainer',
        description:
          '提供視覺搜尋、閱讀、眼動與對比敏感度練習，適合在治療師建議下安排居家視覺訓練。',
        action: '前往視覺訓練',
        logoAlt: 'VisionTrainer 標誌',
      },
    ],
    features: [
      {
        title: '清楚的使用限制',
        text:
          '每項工具都標示適用情境與使用限制，提醒使用者依醫療專業建議調整，不取代診斷或治療。',
      },
      {
        title: '台灣常用詞彙',
        text:
          '中文文案採繁體中文與台灣慣用說法，例如「使用限制」、「復健」、「治療師」、「居家練習」。',
      },
      {
        title: '雙語介面',
        text:
          '主頁支援繁體中文與英文切換，連結、按鈕、狀態與輔助文字都會同步更新。',
      },
      {
        title: '可讀性設定',
        text:
          '提供字級、深色模式與即時對比度檢查，讓長輩、個案與照顧者都能更舒服地閱讀。',
      },
    ],
  },
  en: {
    documentLanguage: 'en',
    brandSubtitle: 'Home rehabilitation hub',
    navigationLabel: 'RehabTrainerHub navigation',
    nav: {
      programs: 'Programs',
      care: 'Care principles',
      education: 'Education',
      links: 'Links',
    },
    hero: {
      eyebrow: 'Integrated home rehabilitation portal',
      title: 'A clearer entry point for home rehabilitation tools',
      body:
        'RehabTrainerHub brings stroke recovery and vision training tools together so clients, families, and therapists can plan home practice, understand usage limitations, and move quickly to the right training system.',
      primaryAction: 'View programs',
      secondaryAction: 'Read guidance',
      visualLabel: 'RehabTrainerHub tool overview',
      checklist: ['Traditional Chinese and English', 'Adjustable font size', 'Dark mode and contrast check'],
    },
    controls: {
      settingsLabel: 'Reading settings',
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
        'Each training system is deployed separately. This home page provides clear entry points, purpose statements, and usage limitations so clients and caregivers can find the right tool faster.',
    },
    care: {
      eyebrow: 'Clinical care at home',
      title: 'Turn professional guidance into daily practice',
      quote:
        'This platform helps organize and record home practice. It does not provide medical diagnosis and does not replace assessment by a physician or therapist.',
      body:
        'Before using the tools, confirm the treatment goal, physical condition, and safe practice environment. Stop immediately and consult a professional if pain, dizziness, visual discomfort, or other symptoms occur.',
    },
    education: {
      eyebrow: 'Guidance and related resources',
      title: 'Understand safety principles before training',
      intro:
        'Review preparation notes, usage limitations, and related resources so family members and caregivers can discuss practice with the same terms.',
      educationLink: 'Read education materials',
      linksLink: 'View related links',
    },
    apps: [
      {
        id: 'stroke',
        title: 'Stroke Recovery',
        localTitle: 'Stroke rehabilitation',
        name: 'StrokeTrainer',
        description:
          'Home-practice exercises for movement, speech, and cognition after stroke, designed to make daily training easier to start, track, and maintain.',
        action: 'Open StrokeTrainer',
        logoAlt: 'StrokeTrainer logo',
      },
      {
        id: 'vision',
        title: 'Vision Training',
        localTitle: 'Vision rehabilitation',
        name: 'VisionTrainer',
        description:
          'Visual search, reading, eye movement, and contrast sensitivity exercises for home practice under therapist guidance.',
        action: 'Open VisionTrainer',
        logoAlt: 'VisionTrainer logo',
      },
    ],
    features: [
      {
        title: 'Clear usage limitations',
        text:
          'Each tool states its intended use and usage limitations, reminding users to adjust practice with professional guidance rather than replacing diagnosis or treatment.',
      },
      {
        title: 'Taiwan-ready Traditional Chinese',
        text:
          'The Chinese copy uses Traditional Chinese and terms commonly used in Taiwan, including 使用限制, 復健, 治療師, and 居家練習.',
      },
      {
        title: 'Bilingual interface',
        text:
          'The home page supports Traditional Chinese and English switching, including links, buttons, statuses, and assistive labels.',
      },
      {
        title: 'Readability settings',
        text:
          'Font size controls, dark mode, and a live contrast check make the page easier to read for older adults, clients, and caregivers.',
      },
    ],
  },
} as const;

const appAssets = {
  stroke: {
    href: siteUrls.stroke,
    image: '/assets/stroke-logo.png',
    iconLabel: 'ST',
  },
  vision: {
    href: siteUrls.vision,
    image: '/assets/vision-logo.png',
    iconLabel: 'VT',
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

  const contrastText = useMemo(() => {
    if (contrastRatio === null) {
      return {
        ratio: '--',
        status: copy.controls.contrastLoading,
        tone: 'pending',
      };
    }

    if (contrastRatio >= 7) {
      return {
        ratio: `${contrastRatio.toFixed(1)}:1`,
        status: copy.controls.contrastPass,
        tone: 'pass',
      };
    }

    if (contrastRatio >= 4.5) {
      return {
        ratio: `${contrastRatio.toFixed(1)}:1`,
        status: copy.controls.contrastWarn,
        tone: 'warn',
      };
    }

    return {
      ratio: `${contrastRatio.toFixed(1)}:1`,
      status: copy.controls.contrastFail,
      tone: 'fail',
    };
  }, [
    contrastRatio,
    copy.controls.contrastFail,
    copy.controls.contrastLoading,
    copy.controls.contrastPass,
    copy.controls.contrastWarn,
  ]);

  return (
    <main className="home-page">
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            <Image src="/rehabtrainerhub.png" alt="" width={44} height={44} priority />
          </span>
          <span>
            <strong>RehabTrainerHub</strong>
            <small>{copy.brandSubtitle}</small>
          </span>
        </Link>

        <div className="header-stack">
          <nav className="header-actions" aria-label={copy.navigationLabel}>
            <a href="#programs">{copy.nav.programs}</a>
            <a href="#care">{copy.nav.care}</a>
            <Link href="/education/">{copy.nav.education}</Link>
            <Link href="/links/">{copy.nav.links}</Link>
          </nav>

          <div className="readability-toolbar" role="region" aria-label={copy.controls.settingsLabel}>
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

            <div className="contrast-status" role="status" aria-live="polite">
              <span>{copy.controls.contrastLabel}</span>
              <strong>{contrastText.ratio}</strong>
              <small>{contrastText.status}</small>
            </div>
          </div>

          <AuthPanel
            appName="RehabTrainerHub"
            className="home-auth-panel"
            locale={locale === 'en' ? 'en' : 'zh-TW'}
          />
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{copy.hero.eyebrow}</p>
          <h1>{copy.hero.title}</h1>
          <p>{copy.hero.body}</p>
          <div className="hero-actions">
            <a className="primary-action" href="#programs">
              {copy.hero.primaryAction}
            </a>
            <Link className="secondary-action" href="/education/">
              {copy.hero.secondaryAction}
            </Link>
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
                <div className="app-icon" aria-hidden="true">
                  {asset.iconLabel}
                </div>
                <div className="app-body">
                  <p>{app.name}</p>
                  <h3>{app.title}</h3>
                  <strong>{app.localTitle}</strong>
                  <span>{app.description}</span>
                  <div className="app-logo-strip">
                    <Image src={asset.image} alt={app.logoAlt} width={128} height={82} />
                  </div>
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

      <section className="education-section" aria-labelledby="education-title">
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
