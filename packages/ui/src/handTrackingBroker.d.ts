import type { HandInputBroker, HandInputMessage } from './handTrackingInput';
export function CreateHandTrackingBroker(options: {
  createController: () => Promise<{
    Start: (onFrame: (payload: unknown) => void, onError: (reason: string) => void, hand?: 'any' | 'left' | 'right') => Promise<boolean>;
    Stop: () => void;
  }>;
  send: (message: HandInputMessage) => void;
  requestConsent: () => Promise<boolean>;
  cancelConsent: () => void;
}): HandInputBroker;
