import { useEffect, useRef } from 'react';
import { ExitFullscreenIfActive } from '../fullscreen';

export interface UseTrainingAbortArgs {
  active: boolean;
  onAbort: () => void;
  exitFullscreen?: boolean;
  abortOnFullscreenExit?: boolean;
}

export function useTrainingAbort({
  active,
  onAbort,
  exitFullscreen = true,
  abortOnFullscreenExit = true,
}: UseTrainingAbortArgs) {
  const abortingRef = useRef(false);
  const onAbortRef = useRef(onAbort);

  useEffect(() => {
    onAbortRef.current = onAbort;
  }, [onAbort]);

  useEffect(() => {
    if (!active) {
      abortingRef.current = false;
      return undefined;
    }

    const abortTraining = () => {
      if (abortingRef.current) return;
      abortingRef.current = true;
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

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [abortOnFullscreenExit, active, exitFullscreen]);
}
