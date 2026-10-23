export type SensorInput = 'pose' | 'microphone' | 'tongue';
export type SensorInputReply = { type: 'ready' | 'frame' | 'error'; payload: unknown };
export type SensorInputController = {
  Start: (onFrame: (payload: unknown) => void, onError: (reason: string) => void) => Promise<boolean>;
  Stop: () => void;
  Capture?: (label: string, capturing: boolean) => void;
};
export type SensorInputBroker = { Start: (input: SensorInput) => Promise<void>; Stop: () => void; Capture: (label: string, capturing: boolean) => void };
export function CreateSensorInputBroker(options: {
  createController: (input: SensorInput) => Promise<SensorInputController>;
  send: (message: SensorInputReply) => void;
  requestConsent: (input: SensorInput) => Promise<boolean>;
  cancelConsent: () => void;
}): SensorInputBroker;
