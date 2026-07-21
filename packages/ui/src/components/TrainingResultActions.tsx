import { useEffect, type ReactNode } from 'react';
import { ExitFullscreenIfActive } from '../fullscreen';

export interface TrainingResultActionsProps {
  downloadLabel: ReactNode;
  restartLabel: ReactNode;
  backLabel: ReactNode;
  onDownloadCsv: () => void;
  onRestart: () => void;
  onBackHome: () => void;
  className?: string;
}

export function TrainingResultActions({
  downloadLabel,
  restartLabel,
  backLabel,
  onDownloadCsv,
  onRestart,
  onBackHome,
  className = 'results-actions',
}: TrainingResultActionsProps) {
  useEffect(() => {
    void ExitFullscreenIfActive();
  }, []);

  return (
    <div className={className}>
      <button className="btn btn-primary btn-lg" type="button" onClick={onDownloadCsv}>
        {downloadLabel}
      </button>
      <button className="btn btn-secondary btn-lg" type="button" onClick={onRestart}>
        {restartLabel}
      </button>
      <button className="btn btn-ghost btn-lg" type="button" onClick={onBackHome}>
        {backLabel}
      </button>
    </div>
  );
}
