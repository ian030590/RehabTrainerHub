import type { SensorInput, SensorInputController } from './sensorInputBroker';

type SensorInputApi = { CreateController: (options?: { previewHost?: HTMLElement | null }) => SensorInputController };
const bundles: Record<SensorInput, [string, string]> = {
  pose: ['pose-tracking-1.0.0', 'TrainerHubPoseTracking'],
  microphone: ['microphone-1.0.0', 'TrainerHubMicrophone'],
  tongue: ['tongue-tracking-1.0.0', 'TrainerHubTongueTracking'],
};
const loaded = new Map<string, Promise<SensorInputApi>>();

// Loads a reviewed sensor proxy from the runner into the Hub page; the game itself never gets this script.
export function LoadSensorInput(origin: string, input: SensorInput): Promise<SensorInputApi> {
  const [directory, name] = bundles[input];
  const source = new URL(`/input/${directory}/index.js`, origin).href;
  const existing = loaded.get(source);
  if (existing) return existing;
  const pending = new Promise<SensorInputApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = source;
    script.crossOrigin = 'anonymous';
    const fail = () => { loaded.delete(source); script.remove(); reject(new Error('Sensor input unavailable')); };
    script.onload = () => {
      const api = (window as unknown as Record<string, SensorInputApi | undefined>)[name];
      if (api?.CreateController) resolve(api);
      else fail();
    };
    script.onerror = fail;
    document.head.append(script);
  });
  loaded.set(source, pending);
  return pending;
}
