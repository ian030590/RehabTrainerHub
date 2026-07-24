import type { Metadata } from 'next';
import { TrainingLobby } from './TrainingLobby';
import { hubFullName } from './hubBrand';
import { CreateSeoMetadata, siteDescription } from './seo';

export const metadata: Metadata = CreateSeoMetadata({
  title: hubFullName,
  description: siteDescription,
  path: '/',
  absoluteTitle: true,
});

export default function HomePage() {
  return <TrainingLobby />;
}
