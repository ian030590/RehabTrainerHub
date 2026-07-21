export async function EnterFullscreenFromUserGesture(element?: HTMLElement | null) {
  if (typeof document === 'undefined') return false;
  if (document.fullscreenElement) return true;

  const target = element ?? document.documentElement;
  if (!target.requestFullscreen) return false;

  try {
    await target.requestFullscreen();
    return true;
  } catch {
    return false;
  }
}

export async function ExitFullscreenIfActive() {
  if (typeof document === 'undefined') return false;
  if (!document.fullscreenElement || !document.exitFullscreen) return false;

  try {
    await document.exitFullscreen();
    return true;
  } catch {
    return false;
  }
}

export function WaitForFullscreenLayout() {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}
