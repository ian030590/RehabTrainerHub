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
