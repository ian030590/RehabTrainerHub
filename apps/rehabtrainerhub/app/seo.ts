import type { Metadata } from 'next';
import { hubFullName, hubLocalName, hubName } from './hubBrand';
import { siteUrls } from './siteUrls';

export const siteDescription =
  '居家訓練網 Rehab Trainer Hub 提供動作、視覺、認知與口腔居家練習工具、衛教資訊、每日任務與訓練紀錄；不提供個別評估、診斷或治療。';

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
const maintainerId = `${hubUrl}#maintainer`;

const trainerApplications = [
  {
    '@type': 'WebApplication',
    '@id': `${siteUrls.motor}/#application`,
    name: 'MotorTrainer',
    alternateName: '居家上肢動作練習',
    applicationCategory: 'EducationalApplication',
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
    alternateName: '居家視覺練習工具',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires a modern web browser with JavaScript enabled.',
    url: `${siteUrls.vision}/`,
    description: 'VisionTrainer 提供螢幕視標、眼動、閱讀、視覺搜尋與注意力練習；結果僅反映當次操作，不作為診斷。',
    image: `${siteUrls.vision}/icons/pwa-512.png`,
    inLanguage: ['zh-TW', 'en'],
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: 0,
      priceCurrency: 'TWD',
    },
    featureList: ['螢幕視標練習', '眼球運動練習', '閱讀與視覺注意力練習'],
    isPartOf: { '@id': websiteId },
    publisher: { '@id': organizationId },
  },
  {
    '@type': 'WebApplication',
    '@id': `${siteUrls.brain}/#application`,
    name: 'BrainTrainer',
    alternateName: '居家認知練習',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires a modern web browser with JavaScript enabled.',
    url: `${siteUrls.brain}/`,
    description: 'BrainTrainer 提供注意、記憶、反應控制與思考練習工具。',
    image: `${siteUrls.brain}/icons/pwa-512.png`,
    inLanguage: ['zh-TW', 'en'],
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: 0,
      priceCurrency: 'TWD',
    },
    featureList: ['注意力練習', '記憶練習', '高階認知與思考練習'],
    isPartOf: { '@id': websiteId },
    publisher: { '@id': organizationId },
  },
  {
    '@type': 'WebApplication',
    '@id': `${siteUrls.mouth}/#application`,
    name: 'MouthTrainer',
    alternateName: '居家舌頭動作練習',
    applicationCategory: 'EducationalApplication',
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
  inLanguage: 'zh-Hant-TW',
  description: siteDescription,
  hasPart: [
    { '@id': hubApplicationId },
    ...trainerApplications.map((application) => ({ '@id': application['@id'] })),
  ],
  publisher: { '@id': organizationId },
  creator: { '@id': maintainerId },
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
  founder: { '@id': maintainerId },
};

export const maintainerJsonLd = {
  '@type': 'Person',
  '@id': maintainerId,
  name: '蔡泓恩',
  jobTitle: '職能治療師',
  url: `${hubUrl}qa/#professional-background`,
  description: '經職能治療師考試及格並領有職能治療師證書，畢業於國立臺灣大學職能治療學系，具視覺功能評估、視覺復能與臨床研究經驗。',
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
  featureList: ['居家練習模組入口', '每日任務', '訓練紀錄與進度追蹤'],
  hasPart: trainerApplications.map((application) => ({ '@id': application['@id'] })),
  isPartOf: { '@id': websiteId },
  publisher: { '@id': organizationId },
  creator: { '@id': maintainerId },
};

export const siteJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    organizationJsonLd,
    maintainerJsonLd,
    websiteJsonLd,
    hubApplicationJsonLd,
    ...trainerApplications,
  ],
};

export function SerializeJsonLd(value: unknown) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}
