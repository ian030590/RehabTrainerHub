import type { ReactNode } from 'react';
import {
  TrainingConfigOptionGroup,
  TrainingConfigPanel,
  type TrainingConfigOptionColumns,
} from './TrainingConfigPanel';

type TrainingSetupChoiceValue = string | number;

export interface TrainingSetupPanelProps {
  title: ReactNode;
  label?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export interface TrainingSetupRulesPanelProps {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export interface TrainingSetupChoice<Value extends TrainingSetupChoiceValue> {
  value: Value;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export interface TrainingSetupChoiceGridProps<Value extends TrainingSetupChoiceValue> {
  value: Value;
  choices: readonly TrainingSetupChoice<Value>[];
  onValueChange(value: Value): void;
  columns?: TrainingConfigOptionColumns;
  ariaLabel?: string;
}

export interface TrainingSetupCheckboxProps {
  checked: boolean;
  label: ReactNode;
  onCheckedChange(checked: boolean): void;
  disabled?: boolean;
}

function JoinClassNames(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

/**
 * Common visual frame for lightweight, module-owned training setup chunks.
 * The host supplies navigation as a slot; modules retain their fields,
 * validation, copy, and configuration ownership.
 */
export function TrainingSetupPanel({
  title,
  label,
  actions,
  children,
  className,
}: TrainingSetupPanelProps) {
  return (
    <TrainingConfigPanel
      actions={actions}
      bodyClassName="training-config-body-single"
      className={JoinClassNames('native-training-config', className)}
      label={label}
      title={title}
    >
      {children}
    </TrainingConfigPanel>
  );
}

export function TrainingSetupRulesPanel({
  title,
  actions,
  children,
  className,
}: TrainingSetupRulesPanelProps) {
  return (
    <TrainingConfigPanel
      actions={actions}
      bodyClassName="training-config-body-single training-rules-body"
      className={JoinClassNames('training-rules', 'native-training-config', className)}
      title={title}
    >
      <section className="training-setting training-setting-wide training-rule-section">
        {children}
      </section>
    </TrainingConfigPanel>
  );
}

export function TrainingSetupChoiceGrid<Value extends TrainingSetupChoiceValue>({
  value,
  choices,
  onValueChange,
  columns = 'auto',
  ariaLabel,
}: TrainingSetupChoiceGridProps<Value>) {
  return (
    <TrainingConfigOptionGroup aria-label={ariaLabel} columns={columns}>
      {choices.map((choice) => {
        const selected = choice.value === value;
        return (
          <button
            aria-pressed={selected}
            className={`training-option ${selected ? 'active' : ''}`}
            disabled={choice.disabled}
            key={String(choice.value)}
            onClick={() => onValueChange(choice.value)}
            type="button"
          >
            <span className="training-option-title">{choice.label}</span>
            {choice.description && <span className="training-option-meta">{choice.description}</span>}
          </button>
        );
      })}
    </TrainingConfigOptionGroup>
  );
}

export function TrainingSetupCheckbox({
  checked,
  label,
  onCheckedChange,
  disabled = false,
}: TrainingSetupCheckboxProps) {
  return (
    <label className="training-checkbox-row">
      <input
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.target.checked)}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
}
