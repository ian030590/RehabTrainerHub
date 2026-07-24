import type { Metadata } from 'next';
import { hubFullName, hubLocalName, hubName } from './hubBrand';
import { siteUrls } from './siteUrls';

export const siteDescription =
  '居家訓練網 Rehab Trainer Hub 整合動作、視覺、注意力、記憶、高階認知與口腔訓練模組，並提供每日任務與復健進度追蹤。';

export const seoImage = {
  url: '/rehabtrainerhub.svg',
  width: 840,
  height: 840,
  alt: `${hubFullName} logo`,
} as const;

const trainerApplications = [
  {
    '@type': 'WebApplication',
    name: 'MotorTrainer',
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web browser',
    url: siteUrls.motor,
    description: 'MotorTrainer 提供上肢與下肢訓練入口，協助依治療師建議安排居家動作復健練習。',
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
  {
    '@type': 'WebApplication',
    name: 'MouthTrainer',
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web browser',
    url: siteUrls.mouth,
    description: 'MouthTrainer 提供口說、理解與口腔動作訓練，協助依專業建議安排居家練習。',
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
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: hubFullName,
  alternateName: [hubLocalName, hubName],
  url: siteUrls.hub,
  inLanguage: 'zh-Hant-TW',
  description: siteDescription,
  hasPart: trainerApplications,
  publisher: {
    '@type': 'Organization',
    name: hubFullName,
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
  name: hubFullName,
  alternateName: [hubLocalName, hubName],
  url: siteUrls.hub,
  logo: {
    '@type': 'ImageObject',
    url: `${siteUrls.hub}${seoImage.url}`,
    width: seoImage.width,
    height: seoImage.height,
  },
  description: siteDescription,
};
