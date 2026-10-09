export type HandInputMessage = { schema: string; sequence: number; type: string; payload: unknown };
type InputController = { Start: (onFrame: (payload: unknown) => void, onError: (reason: string) => void) => Promise<boolean>; Stop: () => void };
export type HandInputBroker = { Start: () => Promise<void>; Stop: () => void };
type HandInputApi = { CreateController: () => InputController };
const loaded = new Map<string, Promise<HandInputApi>>();

export function LoadHandTrackingInput(origin: string): Promise<HandInputApi> {
  const source = new URL('/input/hand-tracking-1.0.0/index.js', origin).href;
  const existing = loaded.get(source);
  if (existing) return existing;
  const pending = new Promise<HandInputApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = source;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      const api = (window as unknown as { TrainerHubHandTracking?: HandInputApi }).TrainerHubHandTracking;
      if (api?.CreateController) resolve(api);
      else { loaded.delete(source); script.remove(); reject(new Error('Hand input unavailable')); }
    };
    script.onerror = () => { loaded.delete(source); script.remove(); reject(new Error('Hand input unavailable')); };
    document.head.append(script);
  });
  loaded.set(source, pending);
  return pending;
}
