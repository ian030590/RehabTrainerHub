import type { EyeInputBroker } from './eyeTrackingInput';
import type { HandInputMessage } from './handTrackingInput';
export function CreateEyeTrackingBroker(options: {
  createController: () => Promise<{
    Start: (onFrame: (payload: unknown) => void, onError: (reason: string) => void) => Promise<boolean>;
    Stop: () => void;
    Calibrate: (x: number, y: number) => void;
    Reset: () => void;
  }>;
  send: (message: HandInputMessage) => void;
  requestConsent: () => Promise<boolean>;
  cancelConsent: () => void;
}): EyeInputBroker;
