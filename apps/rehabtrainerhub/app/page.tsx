import type { Metadata } from 'next';
import { TrainingLobby } from './TrainingLobby';
import { hubSeoTitle } from './hubBrand';
import {
  CreateSeoMetadata,
  SerializeJsonLd,
  siteDescription,
  siteJsonLd,
} from './seo';

export const metadata: Metadata = CreateSeoMetadata({
  title: hubSeoTitle,
  description: siteDescription,
  path: '/',
  absoluteTitle: true,
});

export default function HomePage() {
  return (
    <>
      <script
        id="site-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: SerializeJsonLd(siteJsonLd) }}
      />
      <TrainingLobby />
    </>
  );
}
