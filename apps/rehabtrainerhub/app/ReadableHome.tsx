'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useHubReadability, type HubLocale } from './HubNavigation';
import { HUB_NAME } from './hubBrand';
import { siteUrls } from './siteUrls';

type Locale = HubLocale;
type IconName = 'brain' | 'eye' | 'arrow' | 'check' | 'panel';

const content = {
  'zh-TW': {
    documentLanguage: 'zh-Hant-TW',
    brandSubtitle: '居家復健入口',
    navigationLabel: `${HUB_NAME} 導覽`,
    nav: {
      programs: '復健工具',
      care: '安全提醒',
      education: '衛教資訊',
      links: '衛教影片',
      submit: '合作投稿',
    },
    hero: {
      eyebrow: '居家復健入口',
      title: '職能治療師開發的居家復健工具',
      body:
        '透過網頁，在家中使用電腦、手機或平板進行居家復健練習。請在治療師的指導下使用。',
      primaryAction: '選擇工具',
      secondaryAction: '查看安全提醒',
      visualLabel: `${HUB_NAME} 工具選擇示意`,
      checklist: ['中風練習', '視覺訓練', '字體可放大'],
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
    },
    programs: {
      eyebrow: '選擇復健項目',
      title: '你現在想練什麼？',
      intro:
        '請根據自己的需求以及職能治療師的指導下選擇復健項目。',
    },
    care: {
      eyebrow: '使用方法',
      title: '如何使用這個網站？',
      quote:
        '練習時請密切關注自己的身體狀況，若有不適請立即停止練習。',
      body:
        '網站提供工具與指引，並非診斷。請務必在治療師的指導下使用，以免發生危險。',
    },
    education: {
      eyebrow: '衛教資訊',
      title: '復健相關衛教資訊，歡迎參考',
      intro:
        '了解復健如何進行？自己在家可以如何訓練？',
      educationLink: '閱讀衛教',
      linksLink: '衛教影片',
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
        action: '開啟中風復健',
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
        action: '開啟視覺訓練',
        logoAlt: 'VisionTrainer 標誌',
      },
    ],
    safetySteps: [
      {
        title: '確認疼痛狀況',
        text: '若是疼痛或不適，請務必停止練習，並尋求醫療建議。',
      },
      {
        title: '家人安全陪同',
        text: '進行需要走動、平衡的練習時，建議有家人在旁協助。確保安全性。',
      },
      {
        title: '持續不斷練習',
        text: '復健是一場馬拉松，只有堅持才能看到效果。',
      },
      {
        title: '與身邊人一起進步',
        text: '網站提供評分榜，讓你能夠看到其他使用者進行的狀況，一起努力進步。',
      },
    ],
  },
  en: {
    documentLanguage: 'en',
    brandSubtitle: 'Home rehabilitation hub',
    navigationLabel: `${HUB_NAME} navigation`,
    nav: {
      programs: 'Rehab Tools',
      care: 'Safety Notes',
      education: 'Education',
      links: 'Education Videos',
      submit: 'Collaboration',
    },
    hero: {
      eyebrow: 'Home rehabilitation hub',
      title: 'Home rehabilitation tools developed by occupational therapists',
      body:
        'Practice home rehabilitation through the website on a computer, phone, or tablet at home. Use it under therapist guidance.',
      primaryAction: 'Choose a tool',
      secondaryAction: 'View safety notes',
      visualLabel: `${HUB_NAME} tool selection preview`,
      checklist: ['Stroke practice', 'Vision training', 'Larger text'],
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
      contrastLabel: 'Contrast',
      contrastLoading: 'Checking',
      contrastPass: 'WCAG AAA pass',
      contrastWarn: 'WCAG AA pass',
      contrastFail: 'Below AA',
    },
    programs: {
      eyebrow: 'Choose a rehabilitation item',
      title: 'What do you want to practice now?',
      intro:
        'Choose rehabilitation items based on your needs and occupational therapist guidance.',
    },
    care: {
      eyebrow: 'How to use',
      title: 'How do I use this website?',
      quote:
        'Pay close attention to your physical condition during practice. If you feel unwell, stop practicing immediately.',
      body:
        'The website provides tools and guidance, not diagnosis. Use it under therapist guidance to avoid danger.',
    },
    education: {
      eyebrow: 'Education',
      title: 'Rehabilitation education information for reference',
      intro:
        'How does rehabilitation work? How can you train at home?',
      educationLink: 'Read education',
      linksLink: 'Education videos',
    },
    apps: [
      {
        id: 'stroke',
        title: 'StrokeTrainer',
        localTitle: 'Stroke rehabilitation practice',
        name: 'StrokeTrainer',
        bestFor: 'Good for movement, cognition, and speech practice',
        description:
          'Turns therapist-directed goals into short home practice tasks.',
        points: ['Coordination', 'Attention and memory', 'Oral speech'],
        action: 'Open StrokeTrainer',
        logoAlt: 'StrokeTrainer logo',
      },
      {
        id: 'vision',
        title: 'VisionTrainer',
        localTitle: 'Vision training practice',
        name: 'VisionTrainer',
        bestFor: 'Good for seeing text, reading, and eye movement practice',
        description:
          'Provides visual search, reading eye movement, and contrast practice for professional-guided use.',
        points: ['Visual search', 'Reading eye movement', 'Contrast'],
        action: 'Open VisionTrainer',
        logoAlt: 'VisionTrainer logo',
      },
    ],
    safetySteps: [
      {
        title: 'Check pain status',
        text: 'If there is pain or discomfort, stop practicing and seek medical advice.',
      },
      {
        title: 'Have family support for safety',
        text: 'For practice that involves walking or balance, ask a family member to assist nearby and keep it safe.',
      },
      {
        title: 'Keep practicing consistently',
        text: 'Rehabilitation is a marathon. You only see results by staying consistent.',
      },
      {
        title: 'Improve with people around you',
        text: 'The website provides leaderboards so you can see how other users are doing and keep improving together.',
      },
    ],
  },
} as const;

const appAssets = {
  stroke: {
    href: siteUrls.stroke,
    image: '/assets/stroke-logo.png',
    icon: 'brain',
  },
  vision: {
    href: siteUrls.vision,
    image: '/assets/vision-logo.png',
    icon: 'eye',
  },
} as const;

function Icon({ name, className }: { name: IconName; className?: string }) {
  if (name === 'eye') {
    return (
      <svg className={className} aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (name === 'panel') {
    return (
      <svg className={className} aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7 9h10M7 13h4m3 0h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === 'brain') {
    return (
      <svg className={className} aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path d="M8.5 5.5A3.5 3.5 0 0 1 12 2a3.5 3.5 0 0 1 3.45 3 3.45 3.45 0 0 1 2.8 5.45A3.7 3.7 0 0 1 16 17.4V19a3 3 0 0 1-6 0v-1.6a3.7 3.7 0 0 1-2.25-6.95A3.45 3.45 0 0 1 8.5 5.5Z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 2v20M8.2 8.2c1.1.4 2 .4 3-.2M15.8 8.2c-1.1.4-2 .4-3-.2M8.3 14.4c1 .35 1.9.25 2.7-.3M15.7 14.4c-1 .35-1.9.25-2.7-.3" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === 'check') {
    return (
      <svg className={className} aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg className={className} aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ReadableHome() {
  const { locale } = useHubReadability();
  const copy = content[locale];

  return (
    <main className="home-page" id="top">
      <section className="hero">
        <div className="section-inner hero-grid">
          <div className="hero-copy">
            <p className="eyebrow pill">{copy.hero.eyebrow}</p>
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
                <Icon className="icon-sm" name="panel" />
                <span>{HUB_NAME}</span>
              </div>
              <div className="device-content">
                {copy.apps.map((app) => {
                  const asset = appAssets[app.id];
                  return (
                    <div className={`device-tile device-tile-${app.id}`} key={app.id}>
                      <Icon className="device-icon" name={asset.icon} />
                      <span>{app.localTitle}</span>
                    </div>
                  );
                })}
              </div>
              <div className="hero-checklist">
                {copy.hero.checklist.map((item) => (
                  <span key={item}>
                    <Icon className="check-icon" name="check" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="app-section" id="programs" aria-labelledby="apps-title">
        <div className="section-inner">
          <div className="section-heading">
            <p className="eyebrow">{copy.programs.eyebrow}</p>
            <h2 id="apps-title">{copy.programs.title}</h2>
            <p>{copy.programs.intro}</p>
          </div>

          <div className="app-grid">
            {copy.apps.map((app) => {
              const asset = appAssets[app.id];
              return (
                <article className={`app-card app-card-${app.id}`} key={app.id}>
                  <div className="app-card-heading">
                    <div>
                      <span>{app.name}</span>
                      <h3>{app.localTitle}</h3>
                    </div>
                    <div className="app-icon">
                      <Icon className="icon-lg" name={asset.icon} />
                    </div>
                  </div>

                  <p className="app-best-for">{app.bestFor}</p>
                  <p className="app-description">{app.description}</p>

                  <ul className="app-points">
                    {app.points.map((point) => (
                      <li key={point}>
                        <Icon className="check-icon" name="check" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>

                  <a className="app-link" href={asset.href}>
                    {app.action}
                    <Icon className="icon-sm" name="arrow" />
                  </a>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="care-section" id="care" aria-labelledby="care-title">
        <div className="section-inner care-grid">
          <div className="care-copy">
            <p className="eyebrow">{copy.care.eyebrow}</p>
            <h2 id="care-title">{copy.care.title}</h2>
            <blockquote>{copy.care.quote}</blockquote>
            <p>{copy.care.body}</p>
          </div>

          <div className="safety-list">
            {copy.safetySteps.map((card, index) => (
              <article className="feature-card" key={card.title}>
                <span aria-hidden="true">{index + 1}</span>
                <div>
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="education-section" id="education" aria-labelledby="education-title">
        <div className="education-card">
          <p className="eyebrow">{copy.education.eyebrow}</p>
          <h2 id="education-title">{copy.education.title}</h2>
          <p>{copy.education.intro}</p>
          <div className="section-links">
            <Link className="primary-action" href="/education/">
              {copy.education.educationLink}
            </Link>
            <Link className="text-link" href="/videos/">
              {copy.education.linksLink}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
