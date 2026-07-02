import type { MetadataRoute } from 'next';
import { siteUrls } from './siteUrls';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${siteUrls.hub}/sitemap.xml`,
  };
}
