import type { MetadataRoute } from 'next';
import { siteUrls } from './siteUrls';

export const dynamic = 'force-static';
export const publicSitemapPaths = ['/', '/qa/', '/privacy/', '/download/'] as const;

export default function Sitemap(): MetadataRoute.Sitemap {
  return publicSitemapPaths.map((path) => ({
    url: new URL(path, siteUrls.hub).href,
  }));
}
