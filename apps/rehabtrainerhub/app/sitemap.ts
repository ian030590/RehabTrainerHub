import type { MetadataRoute } from 'next';
import { siteUrls } from './siteUrls';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/education', '/links', '/collaborate'];
  return routes.map((route) => ({
    url: `${siteUrls.hub}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : 0.8,
  }));
}
