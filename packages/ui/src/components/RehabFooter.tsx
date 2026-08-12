export interface RehabFooterProps {
  appName?: string;
  className?: string;
  downloadHref?: string;
  hubHref?: string;
  innerClassName?: string;
  privacyHref?: string;
  repoHref?: string;
  showRights?: boolean;
  labels?: {
    hub?: string;
    download?: string;
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
        download: 'Download app',
        privacy: 'Privacy',
        repo: 'GitHub',
        disclaimer: 'General information and self-practice tools only. This site is not a medical facility or occupational therapy clinic and does not provide individualized assessment, diagnosis, medical orders, or treatment.',
        rights: 'All rights reserved.',
      }
    : {
        hub: 'Hub',
        download: '下載程式',
        privacy: '隱私權政策',
        repo: 'GitHub',
        disclaimer: '本站提供一般資訊與自主練習工具，非醫療機構或職能治療所；不提供個別評估、診斷、醫囑或治療。',
        rights: '保留所有權利。',
      };
}

export function GetTrainerSkipLinkLabel(language: 'zh' | 'en') {
  return language === 'en' ? 'Skip to content' : '跳到主要內容';
}

export function RehabFooter({
  appName = 'Rehab Trainer Hub',
  className = 'rehab-footer',
  downloadHref,
  hubHref = '/',
  innerClassName = 'rehab-footer-inner',
  privacyHref,
  repoHref = 'https://github.com/ian030590/RehabTrainerHub',
  showRights = true,
  labels,
}: RehabFooterProps) {
  return (
    <footer className={className}>
      <div className={innerClassName}>
        <strong>{appName}</strong>
        <span>{labels?.disclaimer ?? 'General information and self-practice tools only. This site is not a medical facility or occupational therapy clinic and does not provide individualized assessment, diagnosis, medical orders, or treatment.'}</span>
        <div className="rehab-footer-meta">
          <nav aria-label={labels?.navigation ?? 'Footer navigation'}>
            <a href={hubHref}>{labels?.hub ?? 'Hub'}</a>
            {downloadHref && <a href={downloadHref}>{labels?.download ?? 'Download app'}</a>}
            {privacyHref && <a href={privacyHref}>{labels?.privacy ?? 'Privacy'}</a>}
            <a href={repoHref} target="_blank" rel="noopener noreferrer">{labels?.repo ?? 'GitHub'}</a>
          </nav>
          {showRights && (
            <span className="rehab-footer-rights">&copy; 2026 {labels?.rights ?? 'All rights reserved.'}</span>
          )}
        </div>
      </div>
    </footer>
  );
}
