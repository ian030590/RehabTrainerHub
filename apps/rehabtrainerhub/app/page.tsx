import type { Metadata } from 'next';
import { ReadableHome } from './ReadableHome';
import { HUB_FULL_NAME } from './hubBrand';
import { createSeoMetadata, siteDescription } from './seo';

export const metadata: Metadata = createSeoMetadata({
  title: HUB_FULL_NAME,
  description: siteDescription,
  path: '/',
  absoluteTitle: true,
});

export default function HomePage() {
  return <ReadableHome />;
}
