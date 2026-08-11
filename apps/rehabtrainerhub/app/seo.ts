import type { Metadata } from 'next';
import { hubFullName, hubLocalName, hubName } from './hubBrand';
import { siteUrls } from './siteUrls';

export const siteDescription =
  '居家訓練網 Rehab Trainer Hub 整合動作、視覺、注意力、記憶、高階認知與口腔訓練模組，並提供每日任務與復健進度追蹤。';

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

const trainerApplications = [
  {
    '@type': 'WebApplication',
    '@id': `${siteUrls.motor}/#application`,
    name: 'MotorTrainer',
    alternateName: '居家上肢動作訓練',
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires a modern web browser with JavaScript enabled.',
    url: `${siteUrls.motor}/`,
    description: 'MotorTrainer 提供畫畫塔防、小行星護盾、手勢指令與手部追蹤等上肢互動練習。',
    image: `${siteUrls.motor}/icons/pwa-512.png`,
    inLanguage: ['zh-TW', 'en'],
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: 0,
      priceCurrency: 'TWD',
    },
    featureList: ['圖形繪製練習', '手部定位與追蹤', '手勢辨識互動'],
    isPartOf: { '@id': websiteId },
    publisher: { '@id': organizationId },
  },
  {
    '@type': 'WebApplication',
    '@id': `${siteUrls.vision}/#application`,
    name: 'VisionTrainer',
    alternateName: '居家視覺訓練與評估',
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires a modern web browser with JavaScript enabled.',
    url: `${siteUrls.vision}/`,
    description: 'VisionTrainer 提供視覺評估、眼動、閱讀與視覺注意力練習，適合依專業建議安排居家視覺訓練。',
    image: `${siteUrls.vision}/icons/pwa-512.png`,
    inLanguage: ['zh-TW', 'en'],
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: 0,
      priceCurrency: 'TWD',
    },
    featureList: ['視覺功能評估', '眼球運動訓練', '閱讀與視覺注意力練習'],
    isPartOf: { '@id': websiteId },
    publisher: { '@id': organizationId },
  },
  {
    '@type': 'WebApplication',
    '@id': `${siteUrls.brain}/#application`,
    name: 'BrainTrainer',
    alternateName: '居家認知訓練',
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires a modern web browser with JavaScript enabled.',
    url: `${siteUrls.brain}/`,
    description: 'BrainTrainer 提供注意、記憶與思考訓練入口，協助依專業建議安排認知訓練練習。',
    image: `${siteUrls.brain}/icons/pwa-512.png`,
    inLanguage: ['zh-TW', 'en'],
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: 0,
      priceCurrency: 'TWD',
    },
    featureList: ['注意力訓練', '記憶力訓練', '高階認知與思考練習'],
    isPartOf: { '@id': websiteId },
    publisher: { '@id': organizationId },
  },
  {
    '@type': 'WebApplication',
    '@id': `${siteUrls.mouth}/#application`,
    name: 'MouthTrainer',
    alternateName: '居家舌頭動作訓練',
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires a modern web browser with JavaScript enabled.',
    url: `${siteUrls.mouth}/`,
    description: 'MouthTrainer 提供以攝影機辨識舌頭左右方向的口腔動作練習。',
    image: `${siteUrls.mouth}/icons/pwa-512.png`,
    inLanguage: ['zh-TW', 'en'],
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: 0,
      priceCurrency: 'TWD',
    },
    featureList: ['攝影機舌頭方向辨識', '舌頭左右動作練習'],
    isPartOf: { '@id': websiteId },
    publisher: { '@id': organizationId },
  },
] as const;

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
      siteName: hubFullName,
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
  name: hubFullName,
  alternateName: [hubLocalName, hubName],
  url: hubUrl,
  inLanguage: 'zh-Hant-TW',
  description: siteDescription,
  hasPart: [
    { '@id': hubApplicationId },
    ...trainerApplications.map((application) => ({ '@id': application['@id'] })),
  ],
  publisher: { '@id': organizationId },
};

export const organizationJsonLd = {
  '@type': 'Organization',
  '@id': organizationId,
  name: hubFullName,
  alternateName: [hubLocalName, hubName],
  url: hubUrl,
  logo: {
    '@type': 'ImageObject',
    url: `${siteUrls.hub}${seoImage.url}`,
    width: seoImage.width,
    height: seoImage.height,
  },
  description: siteDescription,
};

export const hubApplicationJsonLd = {
  '@type': 'WebApplication',
  '@id': hubApplicationId,
  name: hubFullName,
  alternateName: [hubLocalName, hubName],
  url: hubUrl,
  description: siteDescription,
  applicationCategory: 'HealthApplication',
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
  featureList: ['復健訓練模組入口', '每日任務', '訓練紀錄與進度追蹤'],
  hasPart: trainerApplications.map((application) => ({ '@id': application['@id'] })),
  isPartOf: { '@id': websiteId },
  publisher: { '@id': organizationId },
};

export const siteJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    organizationJsonLd,
    websiteJsonLd,
    hubApplicationJsonLd,
    ...trainerApplications,
  ],
};

export function SerializeJsonLd(value: unknown) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}
