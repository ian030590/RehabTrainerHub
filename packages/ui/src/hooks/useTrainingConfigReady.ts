import { useEffect } from 'react';
import { NotifyHubTrainingReady } from '../embeddedTraining';

export const trainingConfigReadyEvent = 'rehabtrainerhub:training-config-ready';

export function useTrainingConfigReady(active = true) {
  useEffect(() => {
    if (!active) return;

    NotifyHubTrainingReady();
    queueMicrotask(() => {
      window.dispatchEvent(new CustomEvent(trainingConfigReadyEvent));
    });
  }, [active]);
}
