export type EyeInputBroker = { Start: () => Promise<void>; Stop: () => void; Calibrate: (x: number, y: number) => void; Reset: () => void };
type EyeInputApi = { CreateController: () => {
  Start: (onFrame: (payload: unknown) => void, onError: (reason: string) => void) => Promise<boolean>;
  Stop: () => void; Calibrate: (x: number, y: number) => void; Reset: () => void;
} };
let loading: Promise<EyeInputApi> | null = null;
export function LoadEyeTrackingInput(origin: string): Promise<EyeInputApi> {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('/input/eye-tracking-1.0.0/index.js', origin).href;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      const api = (window as unknown as { TrainerHubEyeTracking?: EyeInputApi }).TrainerHubEyeTracking;
      if (api?.CreateController) resolve(api);
      else { loading = null; script.remove(); reject(new Error('Eye input unavailable')); }
    };
    script.onerror = () => { loading = null; script.remove(); reject(new Error('Eye input unavailable')); };
    document.head.append(script);
  });
  return loading;
}
