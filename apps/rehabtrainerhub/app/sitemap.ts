import type { MetadataRoute } from 'next';
import { siteUrls } from './siteUrls';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/education', '/links', '/collaborate', '/privacy'];
  return routes.map((route) => ({
    url: `${siteUrls.hub}${route}`,
    lastModified: new Date('2026-07-04'),
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : 0.8,
  }));
}
