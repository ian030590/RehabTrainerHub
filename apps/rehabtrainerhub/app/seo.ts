import type { Metadata } from 'next';
import { HUB_FULL_NAME, HUB_LOCAL_NAME, HUB_NAME } from './hubBrand';
import { siteUrls } from './siteUrls';

export const siteDescription =
  '居家訓練網 Rehab Trainer Hub 提供職能治療師設計的居家訓練工具，整合中風復健、視覺訓練、認知訓練、衛教資訊與衛教影片。';

export const seoImage = {
  url: '/rehabtrainerhub.svg',
  width: 840,
  height: 840,
  alt: `${HUB_FULL_NAME} logo`,
} as const;

const trainerApplications = [
  {
    '@type': 'WebApplication',
    name: 'StrokeTrainer',
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web browser',
    url: siteUrls.stroke,
    description: 'StrokeTrainer 提供動作、認知與語音練習，協助依治療師建議安排居家中風復健訓練。',
  },
  {
    '@type': 'WebApplication',
    name: 'VisionTrainer',
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web browser',
    url: siteUrls.vision,
    description: 'VisionTrainer 提供視覺評估、眼動、閱讀與視覺注意力練習，適合依專業建議安排居家視覺訓練。',
  },
  {
    '@type': 'WebApplication',
    name: 'BrainTrainer',
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web browser',
    url: siteUrls.brain,
    description: 'BrainTrainer 提供注意、記憶與思考訓練入口，協助依專業建議安排認知訓練練習。',
  },
] as const;

export function createSeoMetadata({
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
  const resolvedTitle = absoluteTitle ? title : `${title} | ${HUB_LOCAL_NAME}`;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: path,
    },
    robots: noIndex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title: resolvedTitle,
      description,
      url: path,
      siteName: HUB_FULL_NAME,
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
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: HUB_FULL_NAME,
  alternateName: [HUB_LOCAL_NAME, HUB_NAME],
  url: siteUrls.hub,
  inLanguage: ['zh-Hant-TW', 'en'],
  description: siteDescription,
  hasPart: trainerApplications,
  publisher: {
    '@type': 'Organization',
    name: HUB_FULL_NAME,
    url: siteUrls.hub,
    logo: {
      '@type': 'ImageObject',
      url: `${siteUrls.hub}${seoImage.url}`,
      width: seoImage.width,
      height: seoImage.height,
    },
  },
};

export const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: HUB_FULL_NAME,
  alternateName: [HUB_LOCAL_NAME, HUB_NAME],
  url: siteUrls.hub,
  logo: {
    '@type': 'ImageObject',
    url: `${siteUrls.hub}${seoImage.url}`,
    width: seoImage.width,
    height: seoImage.height,
  },
  description: siteDescription,
};
