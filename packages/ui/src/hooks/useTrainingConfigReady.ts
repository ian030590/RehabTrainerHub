import { useEffect } from 'react';
import { NotifyHubTrainingReady } from '../embeddedTraining';

export function useTrainingConfigReady(active = true) {
  useEffect(() => {
    if (active) NotifyHubTrainingReady();
  }, [active]);
}
