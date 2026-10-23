import type { ActionResponse, ResponseAction, ResponseSource } from './everyBallResponse';

interface Clock {
  now: () => number;
  setTimeout: (callback: () => void, milliseconds: number) => number;
  clearTimeout: (timer: number) => void;
}

// Takes the first response inside each window; camera, sound, keys and buttons all report here.
export function CreateResponseWindow(clock: Clock) {
  let pending: {
    startedAt: number; milliseconds: number; closesAt: number; timer: number; resolve: (response: ActionResponse | null) => void;
  } | null = null;
  const Cancel = () => {
    if (!pending) return;
    const { timer, resolve } = pending;
    pending = null;
    clock.clearTimeout(timer);
    resolve(null);
  };
  const CloseAfter = (milliseconds: number) => {
    const timer = clock.setTimeout(() => {
      if (pending?.timer !== timer) return;
      const { resolve } = pending;
      pending = null;
      resolve(null);
    }, milliseconds);
    return timer;
  };
  const WaitForResponse = (milliseconds: number) => {
    Cancel();
    return new Promise<ActionResponse | null>(resolve => {
      const startedAt = clock.now();
      pending = { startedAt, milliseconds, closesAt: startedAt + milliseconds, timer: CloseAfter(milliseconds), resolve };
    });
  };
  // A sound that started in time is still being sorted into a clap or a thigh tap: keep the window open that long.
  const Hold = (milliseconds: number) => {
    if (!pending || clock.now() + milliseconds <= pending.closesAt) return;
    clock.clearTimeout(pending.timer);
    pending.closesAt = clock.now() + milliseconds;
    pending.timer = CloseAfter(milliseconds);
  };
  // delayMs is how long ago the response started; anything that started after the window is too late.
  const Emit = (action: ResponseAction, source: ResponseSource, delayMs = 0) => {
    if (!pending) return false;
    const { startedAt, milliseconds, timer, resolve } = pending;
    const rtMs = Math.max(0, clock.now() - delayMs - startedAt);
    if (rtMs > milliseconds) return false;
    pending = null;
    clock.clearTimeout(timer);
    resolve({ action, source, rtMs });
    return true;
  };
  return { WaitForResponse, Hold, Emit, Cancel };
}
