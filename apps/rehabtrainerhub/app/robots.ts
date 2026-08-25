import type { MetadataRoute } from 'next';
import { siteUrls } from './siteUrls';

export const dynamic = 'force-static';

export default function Robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: '/api/',
      },
    ],
    sitemap: new URL('/sitemap.xml', siteUrls.hub).href,
  };
}
