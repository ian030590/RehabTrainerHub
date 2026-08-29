import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  BuildLegacyTrainingModuleHref,
  trainingCatalog,
} from '@rehab-trainer/hub-modules/catalog';
import { OfficialTrainingHost } from '../../OfficialTrainingHost';

export const metadata: Metadata = {
  title: '訓練活動',
  robots: { index: false, follow: false },
};

export const dynamicParams = false;

export function generateStaticParams() {
  return trainingCatalog.map((module) => {
    const [domain, slug] = module.catalogId.split(':');
    return { domain, slug };
  });
}

export default async function OfficialTrainingHostPage({
  params,
}: {
  params: Promise<{ domain: string; slug: string }>;
}) {
  const { domain, slug } = await params;
  const module = trainingCatalog.find((candidate) => (
    candidate.manifest.id === `${domain}:${slug}`
  ));
  if (!module) notFound();

  return (
    <OfficialTrainingHost
      legacySource={BuildLegacyTrainingModuleHref(module)}
      manifest={module.manifest}
    />
  );
}
