import type { HtmlTagDescriptor, Plugin } from 'vite';

const hubSiteUrl = 'https://trainerhub.cc/';
const hubWebsiteId = `${hubSiteUrl}#website`;
const hubOrganizationId = `${hubSiteUrl}#organization`;

interface ViteHtmlSeoOptions {
  alternateName: string;
  applicationName: string;
  description: string;
  featureList: readonly string[];
  siteUrl: string;
  title: string;
}

function CreateMetaTag(attrs: Record<string, string>): HtmlTagDescriptor {
  return {
    tag: 'meta',
    attrs,
    injectTo: 'head',
  };
}

function SerializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

export function CreateViteHtmlSeoPlugin(options: ViteHtmlSeoOptions): Plugin {
  const canonicalUrl = new URL('/', options.siteUrl).href;
  const imageUrl = new URL('/icons/pwa-512.png', canonicalUrl).href;
  const imageAlt = `${options.applicationName} 應用程式圖示`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': `${canonicalUrl}#application`,
    name: options.applicationName,
    alternateName: options.alternateName,
    url: canonicalUrl,
    description: options.description,
    inLanguage: ['zh-TW', 'en'],
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires a modern web browser with JavaScript enabled.',
    isAccessibleForFree: true,
    image: {
      '@type': 'ImageObject',
      url: imageUrl,
      width: 512,
      height: 512,
    },
    offers: {
      '@type': 'Offer',
      price: 0,
      priceCurrency: 'TWD',
    },
    featureList: options.featureList,
    isPartOf: {
      '@id': hubWebsiteId,
    },
    publisher: {
      '@id': hubOrganizationId,
    },
  };

  const tags: HtmlTagDescriptor[] = [
    {
      tag: 'link',
      attrs: { rel: 'canonical', href: canonicalUrl },
      injectTo: 'head',
    },
    CreateMetaTag({
      name: 'robots',
      content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    }),
    CreateMetaTag({ property: 'og:type', content: 'website' }),
    CreateMetaTag({ property: 'og:site_name', content: '居家訓練網' }),
    CreateMetaTag({ property: 'og:locale', content: 'zh_TW' }),
    CreateMetaTag({ property: 'og:url', content: canonicalUrl }),
    CreateMetaTag({ property: 'og:title', content: options.title }),
    CreateMetaTag({ property: 'og:description', content: options.description }),
    CreateMetaTag({ property: 'og:image', content: imageUrl }),
    CreateMetaTag({ property: 'og:image:secure_url', content: imageUrl }),
    CreateMetaTag({ property: 'og:image:type', content: 'image/png' }),
    CreateMetaTag({ property: 'og:image:width', content: '512' }),
    CreateMetaTag({ property: 'og:image:height', content: '512' }),
    CreateMetaTag({ property: 'og:image:alt', content: imageAlt }),
    CreateMetaTag({ name: 'twitter:card', content: 'summary' }),
    CreateMetaTag({ name: 'twitter:title', content: options.title }),
    CreateMetaTag({ name: 'twitter:description', content: options.description }),
    CreateMetaTag({ name: 'twitter:image', content: imageUrl }),
    CreateMetaTag({ name: 'twitter:image:alt', content: imageAlt }),
    {
      tag: 'script',
      attrs: { type: 'application/ld+json' },
      children: SerializeJsonLd(jsonLd),
      injectTo: 'head',
    },
  ];

  return {
    name: 'rehab-trainer-html-seo',
    transformIndexHtml: {
      order: 'pre',
      handler() {
        return tags;
      },
    },
  };
}
