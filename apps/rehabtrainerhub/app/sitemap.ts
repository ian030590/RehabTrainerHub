import type { MetadataRoute } from 'next';
import { siteContentLastModified } from './seo';
import { siteUrls } from './siteUrls';

export const dynamic = 'force-static';
export const publicSitemapPaths = ['/', '/about/', '/qa/', '/privacy/', '/download/'] as const;

export default function Sitemap(): MetadataRoute.Sitemap {
  return publicSitemapPaths.map((path) => ({
    url: new URL(path, siteUrls.hub).href,
    ...(['/', '/about/'].includes(path) ? { lastModified: siteContentLastModified } : {}),
  }));
}
