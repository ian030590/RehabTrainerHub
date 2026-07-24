import { useScrollChromeVisibility } from '../hooks/useScrollChromeVisibility';

export interface RehabFooterProps {
  appName?: string;
  hubHref?: string;
  privacyHref?: string;
  repoHref?: string;
  labels?: {
    hub?: string;
    privacy?: string;
    repo?: string;
    disclaimer?: string;
    rights?: string;
    navigation?: string;
  };
}

export function GetTrainerFooterLabels(language: 'zh' | 'en') {
  return language === 'en'
    ? {
        hub: 'Hub',
        privacy: 'Privacy',
        repo: 'GitHub',
        disclaimer: 'For rehabilitation practice workflow prototyping, not medical advice.',
        rights: 'All rights reserved.',
      }
    : {
        hub: 'Hub',
        privacy: '隱私權政策',
        repo: 'GitHub',
        disclaimer: '復健練習流程原型，不能取代醫療建議。',
        rights: '保留所有權利。',
      };
}

export function GetTrainerSkipLinkLabel(language: 'zh' | 'en') {
  return language === 'en' ? 'Skip to content' : '跳到主要內容';
}

export function RehabFooter({
  appName = 'Rehab Trainer Hub',
  hubHref = '/',
  privacyHref,
  repoHref = 'https://github.com/ian030590/RehabTrainerHub',
  labels,
}: RehabFooterProps) {
  const isScrollChromeVisible = useScrollChromeVisibility({ scrollContainerSelector: '.page-content' });

  return (
    <footer className={`rehab-footer ${!isScrollChromeVisible ? 'is-scroll-hidden' : ''}`}>
      <div className="rehab-footer-inner">
        <strong>{appName}</strong>
        <span>{labels?.disclaimer ?? 'For rehabilitation practice workflow prototyping, not medical advice.'}</span>
        <div className="rehab-footer-meta">
          <nav aria-label={labels?.navigation ?? 'Footer navigation'}>
            <a href={hubHref}>{labels?.hub ?? 'Hub'}</a>
            {privacyHref && <a href={privacyHref}>{labels?.privacy ?? 'Privacy'}</a>}
            <a href={repoHref} target="_blank" rel="noopener noreferrer">{labels?.repo ?? 'GitHub'}</a>
          </nav>
          <span className="rehab-footer-rights">&copy; 2026 {labels?.rights ?? 'All rights reserved.'}</span>
        </div>
      </div>
    </footer>
  );
}
