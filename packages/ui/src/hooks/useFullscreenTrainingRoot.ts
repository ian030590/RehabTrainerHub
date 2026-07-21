import { useCallback, useRef } from 'react';
import { EnterFullscreenFromUserGesture, WaitForFullscreenLayout } from '../fullscreen';

export function useFullscreenTrainingRoot<TElement extends HTMLElement = HTMLDivElement>() {
  const fullscreenRootRef = useRef<TElement | null>(null);

  const enterTrainingFullscreen = useCallback(async () => {
    const entered = await EnterFullscreenFromUserGesture(fullscreenRootRef.current);
    await WaitForFullscreenLayout();
    return entered;
  }, []);

  return {
    fullscreenRootRef,
    enterTrainingFullscreen,
  };
}
