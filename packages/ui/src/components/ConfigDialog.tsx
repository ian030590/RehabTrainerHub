import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { TrainingConfigPanel } from './TrainingConfigPanel';

export interface ConfigDialogProps {
  children: ReactNode;
  onClose: () => void;
  ariaLabel: string;
  summary?: ReactNode;
}

export function ConfigDialog({ children, onClose, ariaLabel, summary }: ConfigDialogProps) {
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
        headerEnd={summary}
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
