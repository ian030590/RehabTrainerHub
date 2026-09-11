import { useId, useState, type HTMLAttributes, type ReactNode } from 'react';

export interface TrainingConfigSummaryItem {
  label?: ReactNode;
  value: ReactNode;
}

export interface TrainingRuleSection {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  items?: readonly ReactNode[];
  className?: string;
}

type PanelAriaProps = Pick<HTMLAttributes<HTMLElement>, 'aria-label' | 'aria-modal' | 'role'>;

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
  summaryItems = [],
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
    <section
      className={['training-config', 'training-rules', className].filter(Boolean).join(' ')}
      role={role}
      aria-label={ariaLabel}
      aria-modal={ariaModal}
    >
      <header className="training-config-header">
        <div className="training-config-title">
          {label && <p className="training-config-label">{label}</p>}
          <h2>{title}</h2>
        </div>
        {summaryItems.length > 0 && (
          <div className="training-config-header-side">
            <div className="config-summary">
              {summaryItems.map((item, index) => <span key={index}>{item.value}</span>)}
            </div>
          </div>
        )}
      </header>
      <div className={['training-config-body', 'training-config-body-single', 'training-rules-body', bodyClassName].filter(Boolean).join(' ')}>
        {sections.map((section, index) => (
          <TrainingRuleSectionView key={index} section={section} />
        ))}
        {children}
      </div>
      <nav aria-label="Training navigation" className="config-actions">
        <div className="training-config-navigation-actions">
          <div className="training-config-navigation-buttons">
            <button
              aria-busy={false}
              className={['btn', 'btn-primary', 'btn-lg', 'config-start-btn', startClassName].filter(Boolean).join(' ')}
              disabled={startDisabled}
              onClick={onStart}
              type="button"
            >
              <svg className="config-start-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7 4.8v14.4L18.5 12 7 4.8Z" />
              </svg>
              <span>{startLabel}</span>
            </button>
            <button className="btn btn-ghost btn-lg" type="button" onClick={onBack}>{backLabel}</button>
          </div>
        </div>
      </nav>
    </section>
  );
}

function TrainingRuleSectionView({ section }: { section: TrainingRuleSection }) {
  const descriptionId = useId();
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
  const hasDescription = section.description !== undefined && section.description !== null && section.description !== '';

  return (
    <section className={['training-setting', 'training-setting-wide', 'training-rule-section', section.className].filter(Boolean).join(' ')}>
      <div className="training-setting-header">
        <div>
          <div className="training-setting-title-row">
            <h3>{section.title}</h3>
            {hasDescription && (
              <button
                type="button"
                className={`training-setting-help ${isDescriptionOpen ? 'is-open' : ''}`}
                aria-controls={descriptionId}
                aria-expanded={isDescriptionOpen}
                aria-label="Show setting details"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsDescriptionOpen((open) => !open);
                }}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 10.5v6M12 7.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            )}
          </div>
          {hasDescription && <p id={descriptionId} className="training-setting-description" data-mobile-open={isDescriptionOpen ? 'true' : undefined}>{section.description}</p>}
        </div>
        {section.meta !== undefined && section.meta !== null && section.meta !== '' && <span>{section.meta}</span>}
      </div>
      {section.items && section.items.length > 0 && (
        <ol className="training-rule-list">
          {section.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
        </ol>
      )}
    </section>
  );
}
