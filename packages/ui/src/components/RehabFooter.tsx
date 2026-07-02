export interface RehabFooterProps {
  appName?: string;
  hubHref?: string;
  repoHref?: string;
  labels?: {
    hub?: string;
    repo?: string;
    disclaimer?: string;
    rights?: string;
  };
}

export function RehabFooter({
  appName = 'RehabTrainerHub',
  hubHref = '/',
  repoHref = 'https://github.com/ian030590/RehabTrainerHub',
  labels,
}: RehabFooterProps) {
  return (
    <footer className="rehab-footer">
      <div className="rehab-footer-inner">
        <strong>{appName}</strong>
        <span>{labels?.disclaimer ?? 'For rehabilitation practice workflow prototyping, not medical advice.'}</span>
        <nav aria-label="Footer navigation">
          <a href={hubHref}>{labels?.hub ?? 'Hub'}</a>
          <a href={repoHref} target="_blank" rel="noopener noreferrer">{labels?.repo ?? 'GitHub'}</a>
        </nav>
        <span>&copy; 2026 {labels?.rights ?? 'All rights reserved.'}</span>
      </div>
    </footer>
  );
}
