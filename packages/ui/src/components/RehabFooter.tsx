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

export function RehabFooter({
  appName = 'Rehab Trainer Hub',
  hubHref = '/',
  privacyHref,
  repoHref = 'https://github.com/ian030590/RehabTrainerHub',
  labels,
}: RehabFooterProps) {
  return (
    <footer className="rehab-footer">
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
