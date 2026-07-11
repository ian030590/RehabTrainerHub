import type { ReactNode } from 'react';
import { RehabFooter, type RehabFooterProps } from './RehabFooter';

export interface TrainerAppLayoutProps {
  children: ReactNode;
  footer: RehabFooterProps;
  navbar: ReactNode;
  skipLinkLabel?: string;
  skipLinkHref?: string;
}

export function TrainerAppLayout({
  children,
  footer,
  navbar,
  skipLinkLabel,
  skipLinkHref = '#main-content',
}: TrainerAppLayoutProps) {
  return (
    <div className="app-layout">
      {skipLinkLabel && (
        <a className="skip-link" href={skipLinkHref}>
          {skipLinkLabel}
        </a>
      )}
      {navbar}
      {children}
      <RehabFooter {...footer} />
    </div>
  );
}
