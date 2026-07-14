import { useCallback, useRef } from 'react';
import { enterFullscreenFromUserGesture, waitForFullscreenLayout } from '../fullscreen';

export function useFullscreenTrainingRoot<TElement extends HTMLElement = HTMLDivElement>() {
  const fullscreenRootRef = useRef<TElement | null>(null);

  const enterTrainingFullscreen = useCallback(async () => {
    const entered = await enterFullscreenFromUserGesture(fullscreenRootRef.current);
    await waitForFullscreenLayout();
    return entered;
  }, []);

  return {
    fullscreenRootRef,
    enterTrainingFullscreen,
  };
}
