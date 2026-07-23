import type { HTMLAttributes, ReactNode, Ref } from 'react';
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

export interface TrainingConfigSectionProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  value?: ReactNode;
  wide?: boolean;
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
}

export type TrainingConfigOptionColumns = 2 | 3 | 4 | 5 | 'auto';

export interface TrainingConfigOptionGroupProps extends HTMLAttributes<HTMLDivElement> {
  columns?: TrainingConfigOptionColumns;
}

export interface TrainingConfigNoticeProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode;
  description: ReactNode;
}

const optionColumnClassNames: Record<Exclude<TrainingConfigOptionColumns, 'auto'>, string> = {
  2: 'training-option-grid-two',
  3: 'training-option-grid-three',
  4: 'training-option-grid-four',
  5: 'training-option-grid-five',
};

function JoinClassNames(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(' ');
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
  const panelClassName = JoinClassNames('training-config', className);
  const bodyClasses = JoinClassNames('training-config-body', bodyClassName);
  const hasSummary = summaryItems.length > 0;

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
  return <div className={JoinClassNames('config-actions', className)}>{children}</div>;
}

export function TrainingConfigSection({
  title,
  description,
  value,
  wide = false,
  children,
  className,
  ref,
  ...sectionProps
}: TrainingConfigSectionProps) {
  const hasDescription = description !== undefined && description !== null && description !== '';
  const hasValue = value !== undefined && value !== null && value !== '';

  return (
    <section
      {...sectionProps}
      ref={ref}
      className={JoinClassNames('training-setting', wide && 'training-setting-wide', className)}
    >
      <div className="training-setting-header">
        <div>
          <h2>{title}</h2>
          {hasDescription && <p>{description}</p>}
        </div>
        {hasValue && <span>{value}</span>}
      </div>
      {children}
    </section>
  );
}

export function TrainingConfigOptionGroup({
  columns,
  className,
  children,
  ...groupProps
}: TrainingConfigOptionGroupProps) {
  const columnsClassName = columns === 'auto'
    ? 'training-option-grid-auto'
    : columns
      ? optionColumnClassNames[columns]
      : undefined;

  return (
    <div
      {...groupProps}
      className={JoinClassNames('training-option-grid', columnsClassName, className)}
    >
      {children}
    </div>
  );
}

export function TrainingConfigNotice({
  title,
  description,
  className,
  ...noticeProps
}: TrainingConfigNoticeProps) {
  return (
    <section
      {...noticeProps}
      className={JoinClassNames(
        'training-setting',
        'training-setting-wide',
        'training-config-notice',
        className,
      )}
    >
      <strong>{title}</strong>
      <span>{description}</span>
    </section>
  );
}
