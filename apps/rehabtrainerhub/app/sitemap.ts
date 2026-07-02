import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://rehabtrainerhub.pages.dev';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/education', '/StrokeTrainer', '/VisionTrainer'];
  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : 0.8,
  }));
}
