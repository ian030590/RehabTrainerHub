import { useEffect, type ReactNode } from 'react';
import {
  IsEmbeddedHubTraining,
  NotifyHubTrainingComplete,
  NotifyHubTrainingExit,
} from '../embeddedTraining';
import { ExitFullscreenIfActive } from '../fullscreen';

export interface TrainingResultActionsProps {
  backLabel: ReactNode;
  onBackHome: () => void;
  hubLabel: ReactNode;
  className?: string;
}

export function TrainingResultActions({
  backLabel,
  onBackHome,
  hubLabel,
  className = 'results-actions',
}: TrainingResultActionsProps) {
  const isEmbeddedHubTraining = IsEmbeddedHubTraining();

  useEffect(() => {
    void ExitFullscreenIfActive();
    NotifyHubTrainingComplete();
  }, []);

  return (
    <div className={className}>
      <button
        className="btn btn-primary btn-lg"
        type="button"
        onClick={isEmbeddedHubTraining ? NotifyHubTrainingExit : onBackHome}
      >
        {isEmbeddedHubTraining ? hubLabel : backLabel}
      </button>
    </div>
  );
}
