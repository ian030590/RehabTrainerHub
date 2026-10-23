import { CreateMicrophoneController } from './microphoneController.js';
import { CreateSensorInputBroker } from '../../../packages/ui/src/sensorInputBroker.js';

export function CreateController() {
  return CreateMicrophoneController({
    getUserMedia: navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices),
    createAudioContext: () => {
      const audioContextType = window.AudioContext ?? window.webkitAudioContext;
      return audioContextType ? new audioContextType() : null;
    },
    requestFrame: requestAnimationFrame.bind(window), cancelFrame: cancelAnimationFrame.bind(window),
  });
}

export function CreateBroker(options) {
  return CreateSensorInputBroker({ ...options, createController: async () => CreateController() });
}
