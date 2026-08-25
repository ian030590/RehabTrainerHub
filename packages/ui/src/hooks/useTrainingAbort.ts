import { useEffect, useRef } from 'react';
import { NotifyHubTrainingAbort, NotifyHubTrainingActive } from '../embeddedTraining';
import { ExitFullscreenIfActive } from '../fullscreen';

export interface UseTrainingAbortArgs {
  active: boolean;
  onAbort: () => void;
  exitFullscreen?: boolean;
  abortOnFullscreenExit?: boolean;
  abortOnEscape?: boolean;
}

export function useTrainingAbort({
  active,
  onAbort,
  exitFullscreen = true,
  abortOnFullscreenExit = true,
  abortOnEscape = true,
}: UseTrainingAbortArgs) {
  const abortingRef = useRef(false);
  const onAbortRef = useRef(onAbort);

  useEffect(() => {
    onAbortRef.current = onAbort;
  }, [onAbort]);

  useEffect(() => {
    NotifyHubTrainingActive(active);
    return () => {
      if (active) NotifyHubTrainingActive(false);
    };
  }, [active]);

  useEffect(() => {
    if (!active) {
      abortingRef.current = false;
      return undefined;
    }

    const abortTraining = () => {
      if (abortingRef.current) return;
      abortingRef.current = true;
      NotifyHubTrainingAbort();
      onAbortRef.current();
      if (exitFullscreen) {
        void ExitFullscreenIfActive();
      }
      window.setTimeout(() => {
        abortingRef.current = false;
      }, 0);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      abortTraining();
    };

    const handleFullscreenChange = () => {
      if (!exitFullscreen || !abortOnFullscreenExit || document.fullscreenElement) return;
      abortTraining();
    };

    if (abortOnEscape) {
      window.addEventListener('keydown', handleKeyDown, { capture: true });
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      if (abortOnEscape) {
        window.removeEventListener('keydown', handleKeyDown, { capture: true });
      }
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [abortOnEscape, abortOnFullscreenExit, active, exitFullscreen]);
}
