import type { MetadataRoute } from 'next';
import { trainingCatalog } from '@rehab-trainer/hub-modules/catalog';
import { BuildActivityHref } from './activityLinks';
import { siteContentLastModified } from './seo';
import { siteUrls } from './siteUrls';

export const dynamic = 'force-static';
export const publicSitemapPaths = ['/', '/about/', '/qa/', '/privacy/', '/download/', '/activity-map/', '/activities/',
  ...trainingCatalog.map(({ runtimeId }) => BuildActivityHref(runtimeId))];

export default function Sitemap(): MetadataRoute.Sitemap {
  return publicSitemapPaths.map((path) => ({
    url: new URL(path, siteUrls.hub).href,
    ...(['/', '/about/'].includes(path) ? { lastModified: siteContentLastModified } : {}),
  }));
}
