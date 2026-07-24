import type { MetadataRoute } from 'next';
import { siteUrls } from './siteUrls';

export const dynamic = 'force-static';

export default function Sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date('2026-07-24');
  const routes = [
    { route: '', changeFrequency: 'weekly', priority: 1 },
    { route: '/progress', changeFrequency: 'daily', priority: 0.8 },
    { route: '/qa', changeFrequency: 'weekly', priority: 0.75 },
    { route: '/privacy', changeFrequency: 'yearly', priority: 0.35 },
  ] as const;

  return routes.map(({ route, changeFrequency, priority }) => ({
    url: `${siteUrls.hub}${route}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
