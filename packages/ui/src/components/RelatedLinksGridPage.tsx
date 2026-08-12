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
        subtitle: 'Related training tools from Rehab Trainer Hub',
      }
    : {
        title: '相關網站',
        subtitle: '居家訓練網的相關訓練工具',
      };
}

export type RelatedTrainerSite = keyof SiteUrls;

const relatedSiteCopy = {
  zh: {
    hub: {
      title: '居家訓練網',
      description: '居家練習工具與衛教資訊的整合入口。',
    },
    motor: {
      title: 'MotorTrainer',
      description: '上肢、下肢與動作協調練習工具。',
    },
    vision: {
      title: 'VisionTrainer',
      description: '視覺辨識、眼球運動與閱讀練習工具。',
    },
    brain: {
      title: 'BrainTrainer',
      description: '注意、記憶與思考練習工具。',
    },
    mouth: {
      title: 'MouthTrainer',
      description: '口說、理解與口腔動作練習工具。',
    },
  },
  en: {
    hub: {
      title: 'RehabTrainerHub',
      description: 'Home training portal for the RehabTrainerHub tools.',
    },
    motor: {
      title: 'MotorTrainer',
      description: 'Upper-limb, lower-limb, and movement-coordination practice tools.',
    },
    vision: {
      title: 'VisionTrainer',
      description: 'Visual recognition, eye-movement, and reading practice tools.',
    },
    brain: {
      title: 'BrainTrainer',
      description: 'Attention, memory, and thinking practice tools.',
    },
    mouth: {
      title: 'MouthTrainer',
      description: 'Speech, comprehension, and oral-movement practice tools.',
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
