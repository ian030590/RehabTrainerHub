import { useCallback, useEffect, useRef } from 'react';
import { SendGameEvent } from './hubBridge';
export function useFullscreenTrainingRoot<T extends HTMLElement>() {
  const fullscreenRootRef = useRef<T>(null);
  const enterTrainingFullscreen = useCallback(async () => {
    try { await fullscreenRootRef.current?.requestFullscreen?.(); } catch { /* Full viewport play is still available. */ }
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }, []);
  return { fullscreenRootRef, enterTrainingFullscreen };
}
export function useTrainingAbort({ active, onAbort }: { active: boolean; onAbort: () => void }) {
  const abort = useRef(onAbort);
  abort.current = onAbort;
  useEffect(() => {
    if (!active) return;
    SendGameEvent('active');
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') abort.current(); };
    const fullscreen = () => { if (!document.fullscreenElement) abort.current(); };
    window.addEventListener('keydown', key);
    document.addEventListener('fullscreenchange', fullscreen);
    return () => {
      window.removeEventListener('keydown', key);
      document.removeEventListener('fullscreenchange', fullscreen);
    };
  }, [active]);
}
