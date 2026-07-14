import type { HTMLAttributes, ReactNode } from 'react';
import { StartTrainingButton } from './StartTrainingButton';
import { TrainingConfigPanel } from './TrainingConfigPanel';
import type { TrainingConfigSummaryItem } from './TrainingConfigSummary';

type PanelAriaProps = Pick<HTMLAttributes<HTMLDivElement>, 'aria-label' | 'aria-modal' | 'role'>;

export interface TrainingRuleSection {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  items?: readonly ReactNode[];
  className?: string;
}

export interface TrainingRulesPanelProps extends PanelAriaProps {
  title: ReactNode;
  label?: ReactNode;
  summaryTitle?: ReactNode;
  summaryItems?: readonly TrainingConfigSummaryItem[];
  sections?: readonly TrainingRuleSection[];
  children?: ReactNode;
  startLabel: ReactNode;
  backLabel: ReactNode;
  onStart: () => void;
  onBack: () => void;
  startDisabled?: boolean;
  startClassName?: string;
  className?: string;
  bodyClassName?: string;
}

export function TrainingRulesPanel({
  title,
  label,
  summaryTitle,
  summaryItems,
  sections = [],
  children,
  startLabel,
  backLabel,
  onStart,
  onBack,
  startDisabled = false,
  startClassName,
  className,
  bodyClassName,
  role,
  'aria-label': ariaLabel,
  'aria-modal': ariaModal,
}: TrainingRulesPanelProps) {
  return (
    <TrainingConfigPanel
      className={['training-rules', className].filter(Boolean).join(' ')}
      bodyClassName={['training-config-body-single', 'training-rules-body', bodyClassName].filter(Boolean).join(' ')}
      label={label}
      title={title}
      summaryTitle={summaryTitle}
      summaryItems={summaryItems}
      role={role}
      aria-label={ariaLabel}
      aria-modal={ariaModal}
      actions={(
        <>
          <StartTrainingButton
            className={startClassName}
            disabled={startDisabled}
            onClick={onStart}
          >
            {startLabel}
          </StartTrainingButton>
          <button className="btn btn-ghost btn-lg" type="button" onClick={onBack}>
            {backLabel}
          </button>
        </>
      )}
    >
      {sections.map((section, index) => (
        <section
          className={['training-setting', 'training-setting-wide', 'training-rule-section', section.className]
            .filter(Boolean)
            .join(' ')}
          key={index}
        >
          <div className="training-setting-header">
            <div>
              <h2>{section.title}</h2>
              {section.description && <p>{section.description}</p>}
            </div>
            {section.meta && <span>{section.meta}</span>}
          </div>
          {section.items && section.items.length > 0 && (
            <ol className="training-rule-list">
              {section.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
            </ol>
          )}
        </section>
      ))}
      {children}
    </TrainingConfigPanel>
  );
}
