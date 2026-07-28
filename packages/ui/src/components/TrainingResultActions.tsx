import { useEffect, type ReactNode } from 'react';
import {
  IsEmbeddedHubTraining,
  NotifyHubTrainingComplete,
  NotifyHubTrainingExit,
} from '../embeddedTraining';
import { ExitFullscreenIfActive } from '../fullscreen';

export interface TrainingResultActionsProps {
  downloadLabel: ReactNode;
  restartLabel: ReactNode;
  backLabel: ReactNode;
  onDownloadCsv: () => void;
  onRestart: () => void;
  onBackHome: () => void;
  hubLabel?: ReactNode;
  className?: string;
}

export function TrainingResultActions({
  downloadLabel,
  restartLabel,
  backLabel,
  onDownloadCsv,
  onRestart,
  onBackHome,
  hubLabel = '返回大廳',
  className = 'results-actions',
}: TrainingResultActionsProps) {
  const isEmbeddedHubTraining = IsEmbeddedHubTraining();

  useEffect(() => {
    void ExitFullscreenIfActive();
    NotifyHubTrainingComplete();
  }, []);

  return (
    <div className={className}>
      <button className="btn btn-primary btn-lg" type="button" onClick={onDownloadCsv}>
        {downloadLabel}
      </button>
      <button className="btn btn-secondary btn-lg" type="button" onClick={onRestart}>
        {restartLabel}
      </button>
      <button
        className="btn btn-ghost btn-lg"
        type="button"
        onClick={isEmbeddedHubTraining ? NotifyHubTrainingExit : onBackHome}
      >
        {isEmbeddedHubTraining ? hubLabel : backLabel}
      </button>
    </div>
  );
}
