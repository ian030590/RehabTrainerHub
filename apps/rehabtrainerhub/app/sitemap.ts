import type { MetadataRoute } from 'next';
import { siteUrls } from './siteUrls';

export const dynamic = 'force-static';

export default function Sitemap(): MetadataRoute.Sitemap {
  const publicRoutes = ['', '/qa', '/privacy', '/download'] as const;

  return publicRoutes.map((route) => ({
    url: `${siteUrls.hub}${route}/`,
  }));
}
