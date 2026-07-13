import { useEffect } from 'react';
import type { ReactNode } from 'react';

export interface ConfigDialogProps {
  children: ReactNode;
  onClose: () => void;
  ariaLabel: string;
}

export function ConfigDialog({ children, onClose, ariaLabel }: ConfigDialogProps) {
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
      <div className="training-config config-modal-panel" role="dialog" aria-modal="true" aria-label={ariaLabel}>
        <header className="training-config-header">
          <div>
            <h1>{ariaLabel}</h1>
          </div>
        </header>
        <div className="training-config-body training-config-body-single config-dialog-body">
          {children}
        </div>
      </div>
    </div>
  );
}
