import { useEffect, type ReactNode } from 'react';
import {
  IsEmbeddedHubTraining,
  NotifyHubTrainingComplete,
  NotifyHubTrainingExit,
  RequestHubTrainingConfiguration,
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
  const isStandaloneGame = !isEmbeddedHubTraining && typeof window !== 'undefined' && window.location.pathname.startsWith('/games/');
  const entryLabel = typeof document !== 'undefined' && document.documentElement.lang.startsWith('en') ? 'Back to entry' : '返回入口';

  useEffect(() => {
    void ExitFullscreenIfActive();
    NotifyHubTrainingComplete();
  }, []);

  return (
    <div className={className}>
      <button
        className="btn btn-primary btn-lg"
        type="button"
        onClick={isEmbeddedHubTraining ? NotifyHubTrainingExit : () => {
          if (!RequestHubTrainingConfiguration()) onBackHome();
        }}
      >
        {isEmbeddedHubTraining ? hubLabel : isStandaloneGame ? entryLabel : backLabel}
      </button>
    </div>
  );
}
