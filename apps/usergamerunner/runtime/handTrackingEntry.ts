import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { CreateHandTrackingController } from './handTrackingController.js';
import { CreateHandTrackingBroker } from '../../../packages/ui/src/handTrackingBroker.js';

const assetBase = new URL('./', (document.currentScript as HTMLScriptElement).src).href;

export function CreateBroker(options: Record<string, unknown>) {
  return CreateHandTrackingBroker({ ...options, createController: CreateController });
}

export function CreateController() {
  return CreateHandTrackingController({
    getUserMedia: navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices),
    createVideo: () => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.hidden = true;
      document.body.append(video);
      return video;
    },
    createLandmarker: async () => {
      const vision = await FilesetResolver.forVisionTasks(assetBase + 'wasm');
      return HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: assetBase + 'hand_landmarker.task' },
        runningMode: 'VIDEO', numHands: 1,
        minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
      });
    },
    requestFrame: requestAnimationFrame.bind(window), cancelFrame: cancelAnimationFrame.bind(window),
  });
}
