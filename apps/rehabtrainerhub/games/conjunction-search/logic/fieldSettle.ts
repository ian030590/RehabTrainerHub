export interface FieldSize { width: number; height: number }
interface Clock { set: (callback: () => void, ms: number) => number; clear: (id: number) => void }
interface FieldSource extends Clock {
  request: Promise<void> | null;
  entered: () => boolean;
  size: () => FieldSize;
  frame: (callback: () => void) => number;
  cancelFrame: (id: number) => void;
}

export function WaitForField(source: FieldSource, ready: (size: FieldSize) => void): () => void {
  let finished = false, stable = 0;
  let previous = source.request === null || source.entered() ? source.size() : null;
  let frame: number | null = null;
  const cancel = () => {
    finished = true;
    source.clear(timer);
    if (frame !== null) source.cancelFrame(frame);
  };
  const finish = () => { if (!finished) { cancel(); ready(source.size()); } };
  const tick = () => {
    if (finished) return;
    if (source.request === null || source.entered()) {
      const current = source.size();
      stable = previous && current.width === previous.width && current.height === previous.height ? stable + 1 : 0;
      previous = current;
      if (stable >= 2) { finish(); return; }
    } else { previous = null; stable = 0; }
    frame = source.frame(tick);
  };
  const timer = source.set(finish, 1000);
  frame = source.frame(tick);
  void source.request?.then(undefined, finish);
  return cancel;
}

export function CreateLayoutRetry<T>(clock: Clock, layout: () => T, ready: (value: T) => void, failed: () => void) {
  let timer: number | null = null, cancelled = false;
  const clear = () => { if (timer !== null) clock.clear(timer); timer = null; };
  return {
    tryLayout() {
      if (cancelled) return;
      let value: T;
      try { value = layout(); } catch {
        if (timer === null) timer = clock.set(() => { timer = null; cancelled = true; failed(); }, 1000);
        return;
      }
      clear(); ready(value);
    },
    cancel() { cancelled = true; clear(); },
  };
}

export function CanRelayout(state: string, trialIndex: number): boolean {
  return trialIndex === 0 && (state === 'lead' || state === 'target');
}
