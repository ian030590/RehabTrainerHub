import type { MetadataRoute } from 'next';
import { siteUrls } from './siteUrls';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date('2026-07-15');
  const routes = [
    { route: '', changeFrequency: 'weekly', priority: 1 },
    { route: '/education', changeFrequency: 'monthly', priority: 0.85 },
    { route: '/videos', changeFrequency: 'weekly', priority: 0.85 },
    { route: '/collaborate', changeFrequency: 'monthly', priority: 0.65 },
    { route: '/privacy', changeFrequency: 'yearly', priority: 0.35 },
  ] as const;

  return routes.map(({ route, changeFrequency, priority }) => ({
    url: `${siteUrls.hub}${route}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
