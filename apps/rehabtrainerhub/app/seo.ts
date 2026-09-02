import type { Metadata } from 'next';
import { hubFullName, hubLocalName, hubName } from './hubBrand';
import { zhTW } from './i18n';
import { siteUrls } from './siteUrls';

export const siteDescription =
  '居家訓練網 Rehab Trainer Hub 是可安裝的居家練習遊戲平台，提供動作、視覺、認知與口腔練習、衛教資訊、每日任務與當次紀錄；不提供個別評估、診斷或治療。';

export const gamePlatformDescription =
  '居家訓練網提供內建與經審核的開發者居家練習遊戲；可在平台遊玩，也能將每個遊戲以 PWA 單獨安裝，並了解 HTML／ZIP 投稿與隔離執行機制。';

export const seoImage = {
  url: '/icons/pwa-512.png',
  width: 512,
  height: 512,
  alt: `${hubFullName} 標誌`,
} as const;

const hubUrl = `${siteUrls.hub}/`;
const organizationId = `${hubUrl}#organization`;
const websiteId = `${hubUrl}#website`;
const hubApplicationId = `${hubUrl}#application`;
const maintainerId = `${hubUrl}qa/#professional-background`;
const repositoryUrl = 'https://github.com/ian030590/RehabTrainerHub';

export const siteContentLastModified = '2026-08-27';

export function CreateSeoMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  absoluteTitle?: boolean;
  noIndex?: boolean;
}): Metadata {
  const resolvedTitle = absoluteTitle ? title : `${title} | ${hubLocalName}`;
  const canonicalPath = path === '/' ? '/' : `${path.replace(/\/+$/, '')}/`;
  const robots = noIndex
    ? {
        index: false,
        follow: true,
        googleBot: {
          index: false,
          follow: true,
        },
      }
    : {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-video-preview': -1,
          'max-image-preview': 'large' as const,
          'max-snippet': -1,
        },
      };

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    robots,
    openGraph: {
      title: resolvedTitle,
      description,
      url: canonicalPath,
      siteName: hubLocalName,
      locale: 'zh_TW',
      type: 'website',
      images: [seoImage],
    },
    twitter: {
      card: 'summary',
      title: resolvedTitle,
      description,
      images: [seoImage.url],
    },
  };
}

export const websiteJsonLd = {
  '@type': 'WebSite',
  '@id': websiteId,
  name: hubLocalName,
  alternateName: [hubName, hubFullName],
  url: hubUrl,
  inLanguage: 'zh-TW',
  description: siteDescription,
  dateModified: siteContentLastModified,
  hasPart: [{ '@id': hubApplicationId }],
  publisher: { '@id': organizationId },
};

export const organizationJsonLd = {
  '@type': 'Organization',
  '@id': organizationId,
  name: hubLocalName,
  alternateName: [hubName, hubFullName],
  url: hubUrl,
  logo: {
    '@type': 'ImageObject',
    url: `${siteUrls.hub}${seoImage.url}`,
    width: seoImage.width,
    height: seoImage.height,
  },
  description: siteDescription,
  sameAs: [repositoryUrl],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'technical support',
    url: `${repositoryUrl}/issues`,
    availableLanguage: ['zh-TW', 'en'],
  },
};

export const maintainerJsonLd = {
  '@type': 'Person',
  '@id': maintainerId,
  name: '蔡泓恩',
  jobTitle: '職能治療師',
  url: maintainerId,
  description: zhTW.hubUi.questions.professionalBody,
  alumniOf: {
    '@type': 'CollegeOrUniversity',
    name: '國立臺灣大學',
  },
  hasCredential: {
    '@type': 'EducationalOccupationalCredential',
    name: '職能治療師證書',
    credentialCategory: '醫事人員專業證書',
  },
  knowsAbout: ['職能治療', '視覺功能評估', '視覺復能', '居家訓練工具設計'],
};

export const hubApplicationJsonLd = {
  '@type': 'WebApplication',
  '@id': hubApplicationId,
  name: hubLocalName,
  alternateName: [hubName, hubFullName],
  url: hubUrl,
  description: siteDescription,
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Any',
  browserRequirements: 'Requires a modern web browser with JavaScript enabled.',
  image: `${siteUrls.hub}${seoImage.url}`,
  inLanguage: ['zh-TW', 'en'],
  isAccessibleForFree: true,
  offers: {
    '@type': 'Offer',
    price: 0,
    priceCurrency: 'TWD',
  },
  featureList: [
    '內建與經審核的開發者居家練習遊戲',
    '平台遊玩與單一遊戲 PWA 安裝',
    '每日任務與當次紀錄',
  ],
  isPartOf: { '@id': websiteId },
  publisher: { '@id': organizationId },
};

const homepageFaqCopy = zhTW.hubUi.lobby.guide;

export const homepageFaqJsonLd = {
  '@type': 'FAQPage',
  '@id': `${hubUrl}#faq`,
  inLanguage: 'zh-TW',
  mainEntity: [
    [homepageFaqCopy.title, homepageFaqCopy.definition],
    [homepageFaqCopy.chooseTitle, homepageFaqCopy.chooseBody],
    [homepageFaqCopy.prepareTitle, homepageFaqCopy.prepareBody],
    [homepageFaqCopy.recordsTitle, homepageFaqCopy.recordsBody],
    [homepageFaqCopy.privacyTitle, homepageFaqCopy.privacyBody],
    [homepageFaqCopy.limitsTitle, homepageFaqCopy.limitsBody],
    [homepageFaqCopy.reviewTitle, homepageFaqCopy.reviewBody],
  ].map(([name, text]) => ({
    '@type': 'Question',
    name,
    acceptedAnswer: {
      '@type': 'Answer',
      text,
    },
  })),
};

export const siteJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    organizationJsonLd,
    websiteJsonLd,
    hubApplicationJsonLd,
    homepageFaqJsonLd,
  ],
};

export const maintainerPageJsonLd = {
  '@context': 'https://schema.org',
  ...maintainerJsonLd,
};

export function CreatePageJsonLd({
  name,
  description,
  path,
  type = 'WebPage',
}: {
  name: string;
  description: string;
  path: string;
  type?: 'AboutPage' | 'WebPage';
}) {
  const canonicalPath = path === '/' ? '/' : `${path.replace(/\/+$/, '')}/`;
  const url = new URL(canonicalPath, siteUrls.hub).href;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': type,
        '@id': `${url}#webpage`,
        url,
        name,
        description,
        inLanguage: 'zh-TW',
        isPartOf: { '@id': websiteId },
        publisher: { '@id': organizationId },
        breadcrumb: { '@id': `${url}#breadcrumb` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: hubLocalName,
            item: hubUrl,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name,
            item: url,
          },
        ],
      },
    ],
  };
}

export function SerializeJsonLd(value: unknown) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}
