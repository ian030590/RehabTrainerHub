export interface GlobalPortalLinksProps {
  hubHref?: string;
  strokeHref?: string;
  visionHref?: string;
  current?: 'hub' | 'stroke' | 'vision';
  labels?: {
    hub?: string;
    stroke?: string;
    vision?: string;
  };
}

export function GlobalPortalLinks({
  hubHref = '/',
  strokeHref = '/StrokeTrainer/',
  visionHref = '/VisionTrainer/',
  current,
  labels,
}: GlobalPortalLinksProps) {
  const items = [
    { id: 'hub', href: hubHref, label: labels?.hub ?? 'Hub' },
    { id: 'stroke', href: strokeHref, label: labels?.stroke ?? 'Stroke' },
    { id: 'vision', href: visionHref, label: labels?.vision ?? 'Vision' },
  ] as const;

  return (
    <div className="global-portal-links" aria-label="RehabTrainerHub apps">
      {items.map((item) => (
        <a
          key={item.id}
          className={item.id === current ? 'global-portal-link active' : 'global-portal-link'}
          href={item.href}
          aria-current={item.id === current ? 'page' : undefined}
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}
