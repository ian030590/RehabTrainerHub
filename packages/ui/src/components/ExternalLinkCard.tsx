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
    >
      <div className="card-icon">{icon}</div>
      <div className="card-title">{title}</div>
      <div className="card-desc">{description}</div>
      <div className="card-action">
        {actionIcon}
        <span>{actionLabel}</span>
      </div>
    </a>
  );
}
