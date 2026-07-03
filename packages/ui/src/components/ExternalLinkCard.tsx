import type { ReactNode } from 'react';

export interface ExternalLinkCardProps {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
  actionIcon: ReactNode;
  actionLabel: string;
}

export function ExternalLinkCard({
  href,
  icon,
  title,
  description,
  actionIcon,
  actionLabel,
}: ExternalLinkCardProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="card card-link fade-in-up external-link-card"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
    >
      <div className="card-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div className="card-title" style={{ width: '100%', textAlign: 'left' }}>
        {title}
      </div>
      <div className="card-desc" style={{ width: '100%', textAlign: 'left', flex: 1 }}>
        {description}
      </div>
      <div className="card-action" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {actionIcon}
        <span>{actionLabel}</span>
      </div>
    </a>
  );
}
