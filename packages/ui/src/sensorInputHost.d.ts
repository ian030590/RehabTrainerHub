import type { SensorInput, SensorInputBroker, SensorInputReply } from './sensorInputBroker';
export type SensorInputHost = {
  Handle: (message: { type: string; payload: Record<string, unknown> }) => boolean;
  Stop: () => void;
  FullscreenChanged: () => void;
};
export function CreateSensorInputHost(options: {
  inputs: SensorInput[];
  createBroker: (input: SensorInput, send: (message: SensorInputReply) => void) => SensorInputBroker;
  post: (message: Record<string, unknown>) => void;
  preview: HTMLElement | null;
  shell: HTMLElement | null;
  page: Pick<Document, 'fullscreenElement' | 'exitFullscreen'>;
}): SensorInputHost;
