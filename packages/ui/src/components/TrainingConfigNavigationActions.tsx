import type { ReactNode } from 'react';
import { StartTrainingButton } from './StartTrainingButton';

export interface TrainingConfigNavigationActionsProps {
  nextLabel: ReactNode;
  cancelLabel: ReactNode;
  onNext: () => void;
  onCancel: () => void;
  disabled?: boolean;
  loading?: boolean;
  nextClassName?: string;
  children?: ReactNode;
}

export function TrainingConfigNavigationActions({
  nextLabel,
  cancelLabel,
  onNext,
  onCancel,
  disabled = false,
  loading = false,
  nextClassName,
  children,
}: TrainingConfigNavigationActionsProps) {
  return (
    <div className="training-config-navigation-actions">
      {children && (
        <div className="training-config-action-feedback">
          {children}
        </div>
      )}
      <div className="training-config-navigation-buttons">
        <StartTrainingButton
          aria-busy={loading || undefined}
          className={[nextClassName, loading && 'is-loading'].filter(Boolean).join(' ')}
          disabled={disabled || loading}
          onClick={onNext}
        >
          {nextLabel}
          {loading && <span className="loading-dot" />}
        </StartTrainingButton>
        <button className="btn btn-ghost btn-lg" type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
