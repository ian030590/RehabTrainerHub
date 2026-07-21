import { ExternalLinkCard } from './ExternalLinkCard';
import { GridPageLayout } from './GridPageLayout';
import { icons } from './Icons';

export interface RelatedLinkItem {
  description: string;
  href: string;
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
      {links.map((link, index) => (
        <ExternalLinkCard
          key={link.href}
          href={link.href}
          index={index + 1}
          title={link.title}
          description={link.description}
          actionLabel={link.href.replace('https://', '')}
          actionIcon={<icons.ExternalLink />}
        />
      ))}
    </GridPageLayout>
  );
}
