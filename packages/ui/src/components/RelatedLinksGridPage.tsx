import type { ReactNode } from 'react';
import { ExternalLinkCard } from './ExternalLinkCard';
import { GridPageLayout } from './GridPageLayout';
import { Icons } from './Icons';

export interface RelatedLinkItem {
  description: string;
  href: string;
  icon: ReactNode;
  title: string;
}

export interface RelatedLinksGridPageProps {
  links: RelatedLinkItem[];
  subtitle: string;
  title: string;
}

export function RelatedLinksGridPage({ links, subtitle, title }: RelatedLinksGridPageProps) {
  return (
    <GridPageLayout title={title} subtitle={subtitle}>
      {links.map((link) => (
        <ExternalLinkCard
          key={link.href}
          href={link.href}
          icon={link.icon}
          title={link.title}
          description={link.description}
          actionLabel={link.href.replace('https://', '')}
          actionIcon={<Icons.ExternalLink />}
        />
      ))}
    </GridPageLayout>
  );
}
