import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { TrainingConfigPanel } from './TrainingConfigPanel';
import type { TrainingConfigSummaryItem } from './TrainingConfigSummary';

export interface ConfigDialogProps {
  children: ReactNode;
  onClose: () => void;
  ariaLabel: string;
  summaryItems?: readonly TrainingConfigSummaryItem[];
}

export function ConfigDialog({ children, onClose, ariaLabel, summaryItems = [] }: ConfigDialogProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="config-modal-overlay fade-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <TrainingConfigPanel
        title={ariaLabel}
        summaryItems={summaryItems}
        className="config-modal-panel"
        bodyClassName="training-config-body-single config-dialog-body"
        role="dialog"
        aria-modal
        aria-label={ariaLabel}
      >
        {children}
      </TrainingConfigPanel>
    </div>
  );
}
