import type { HTMLAttributes, ReactNode } from 'react';
import { TrainingConfigSummary, type TrainingConfigSummaryItem } from './TrainingConfigSummary';

type PanelAriaProps = Pick<HTMLAttributes<HTMLDivElement>, 'aria-label' | 'aria-modal' | 'role'>;

export interface TrainingConfigPanelProps extends PanelAriaProps {
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
  role,
  'aria-label': ariaLabel,
  'aria-modal': ariaModal,
}: TrainingConfigPanelProps) {
  const panelClassName = ['training-config', className].filter(Boolean).join(' ');
  const bodyClasses = ['training-config-body', bodyClassName].filter(Boolean).join(' ');
  const hasSummary = Boolean(summaryTitle && summaryItems.length > 0);

  return (
    <div className={panelClassName} role={role} aria-label={ariaLabel} aria-modal={ariaModal}>
      <header className="training-config-header">
        <div className="training-config-title">
          {label && <span className="training-config-label">{label}</span>}
          <h1>{title}</h1>
        </div>
        {(hasSummary || headerEnd) && (
          <div className="training-config-header-side">
            {hasSummary && <TrainingConfigSummary title={summaryTitle} items={summaryItems} />}
            {headerEnd}
          </div>
        )}
      </header>

      <div className={bodyClasses}>{children}</div>

      {actions && <TrainingConfigActions>{actions}</TrainingConfigActions>}
    </div>
  );
}

export function TrainingConfigActions({ children, className }: TrainingConfigActionsProps) {
  return <div className={['config-actions', className].filter(Boolean).join(' ')}>{children}</div>;
}
