import type { ReactNode } from 'react';

interface AppDialogProps { title: string; titleId: string; children: ReactNode; actions?: ReactNode; tone?: 'default' | 'error'; className?: string; }

export function AppDialog({ title, titleId, children, actions, tone = 'default', className = '' }: AppDialogProps) {
  return <div className="app-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId}><div className={`app-dialog app-dialog-${tone} ${className}`.trim()}><h2 id={titleId}>{title}</h2><div className="app-dialog-content">{children}</div>{actions && <div className="app-dialog-actions">{actions}</div>}</div></div>;
}
