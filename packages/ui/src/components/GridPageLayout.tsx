import type { ReactNode } from 'react';
import './GridPageLayout.css';

export interface GridPageLayoutProps {
  title: string;
  subtitle: string;
  children?: ReactNode;
}

export function GridPageLayout({ title, subtitle, children }: GridPageLayoutProps) {
  return (
    <main className="shared-page-content" id="main-content">
      <h1 className="shared-section-title">{title}</h1>
      <p className="shared-section-subtitle">{subtitle}</p>
      {children && (
        <div className="shared-card-grid">
          {children}
        </div>
      )}
    </main>
  );
}
