import type { ReactNode } from 'react';
import { StartTrainingButton } from './StartTrainingButton';

export interface TrainingConfigNavigationActionsProps {
  nextLabel: ReactNode;
  cancelLabel: ReactNode;
  onNext: () => void;
  onCancel: () => void;
  disabled?: boolean;
  loading?: boolean;
  children?: ReactNode;
}

export function TrainingConfigNavigationActions({
  nextLabel,
  cancelLabel,
  onNext,
  onCancel,
  disabled = false,
  loading = false,
  children,
}: TrainingConfigNavigationActionsProps) {
  return (
    <>
      {children}
      <StartTrainingButton
        aria-busy={loading || undefined}
        className={loading ? 'is-loading' : undefined}
        disabled={disabled || loading}
        onClick={onNext}
      >
        {nextLabel}
        {loading && <span className="loading-dot" />}
      </StartTrainingButton>
      <button className="btn btn-ghost btn-lg" type="button" onClick={onCancel}>
        {cancelLabel}
      </button>
    </>
  );
}
