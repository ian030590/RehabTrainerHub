import type { ReactNode } from 'react';
import { TrainingConfigSummary, type TrainingConfigSummaryItem } from './TrainingConfigSummary';

export interface TrainingConfigPanelProps {
  title: ReactNode;
  label?: ReactNode;
  headerEnd?: ReactNode;
  children: ReactNode;
  summaryTitle?: ReactNode;
  summaryItems?: readonly TrainingConfigSummaryItem[];
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export interface TrainingConfigActionsProps {
  children: ReactNode;
  className?: string;
}

export function TrainingConfigPanel({
  title,
  label,
  headerEnd,
  children,
  summaryTitle,
  summaryItems = [],
  actions,
  className,
  bodyClassName,
}: TrainingConfigPanelProps) {
  const panelClassName = ['training-config', className].filter(Boolean).join(' ');
  const bodyClasses = ['training-config-body', bodyClassName].filter(Boolean).join(' ');

  return (
    <div className={panelClassName}>
      <header className="training-config-header">
        <div>
          {label && <span className="training-config-label">{label}</span>}
          <h1>{title}</h1>
        </div>
        {headerEnd}
      </header>

      <div className={bodyClasses}>{children}</div>

      {summaryTitle && summaryItems.length > 0 && (
        <TrainingConfigSummary title={summaryTitle} items={summaryItems} />
      )}
      {actions && <TrainingConfigActions>{actions}</TrainingConfigActions>}
    </div>
  );
}

export function TrainingConfigActions({ children, className }: TrainingConfigActionsProps) {
  return <div className={['config-actions', className].filter(Boolean).join(' ')}>{children}</div>;
}
