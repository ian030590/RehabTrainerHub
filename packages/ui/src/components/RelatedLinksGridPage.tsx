import { ExternalLinkCard } from './ExternalLinkCard';
import { GridPageLayout } from './GridPageLayout';
import { icons } from './Icons';
import type { SiteUrls } from '../siteUrls';

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

export function GetDefaultRelatedLinksPageLabels(language: 'zh' | 'en') {
  return language === 'en'
    ? {
        title: 'Related Sites',
        subtitle: 'Official websites in the RehabTrainerHub ecosystem',
      }
    : {
        title: '相關網站',
        subtitle: 'RehabTrainerHub 生態系的正式網站',
      };
}

export type RelatedTrainerSite = keyof SiteUrls;

const relatedSiteCopy = {
  zh: {
    hub: {
      title: 'RehabTrainerHub',
      description: '居家訓練入口平台，整理各項居家訓練工具。',
    },
    motor: {
      title: 'MotorTrainer',
      description: '動作訓練平台，提供上肢與下肢訓練入口。',
    },
    vision: {
      title: 'VisionTrainer',
      description: '視覺評估與視覺訓練平台。',
    },
    brain: {
      title: 'BrainTrainer',
      description: '注意、記憶與思考訓練平台。',
    },
    mouth: {
      title: 'MouthTrainer',
      description: '口說、理解與口腔動作訓練平台。',
    },
  },
  en: {
    hub: {
      title: 'RehabTrainerHub',
      description: 'Home training portal for the RehabTrainerHub tools.',
    },
    motor: {
      title: 'MotorTrainer',
      description: 'Motor rehabilitation platform with upper- and lower-limb training areas.',
    },
    vision: {
      title: 'VisionTrainer',
      description: 'Visual assessment and visual training platform.',
    },
    brain: {
      title: 'BrainTrainer',
      description: 'Attention, memory, and thinking practice platform.',
    },
    mouth: {
      title: 'MouthTrainer',
      description: 'Speech, comprehension, and oral-movement training platform.',
    },
  },
} as const;

const relatedSiteOrder: RelatedTrainerSite[] = ['hub', 'motor', 'vision', 'brain', 'mouth'];

export function CreateRelatedTrainerLinks({
  currentSite,
  language,
  siteUrls,
}: {
  currentSite: Exclude<RelatedTrainerSite, 'hub'>;
  language: 'zh' | 'en';
  siteUrls: SiteUrls;
}): RelatedLinkItem[] {
  return relatedSiteOrder
    .filter((site) => site !== currentSite)
    .map((site) => ({
      href: siteUrls[site],
      title: relatedSiteCopy[language][site].title,
      description: relatedSiteCopy[language][site].description,
    }));
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
