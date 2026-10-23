import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import { CreateCameraInputController } from './cameraInputController.js';
import { CreatePoseDetector } from './poseDetector.js';
import { CreatePreviewVideo } from './previewVideo.js';
import { CreateSensorInputBroker } from '../../../packages/ui/src/sensorInputBroker.js';

const assetBase = new URL('./', (document.currentScript as HTMLScriptElement).src).href;
type Options = { previewHost?: HTMLElement | null };

// Same models and thresholds as the original Every Ball game: two hands plus the lite body model, every 70 ms.
export function CreateController({ previewHost }: Options = {}) {
  return CreateCameraInputController({
    getUserMedia: navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices),
    createVideo: () => CreatePreviewVideo(previewHost),
    requestFrame: requestAnimationFrame.bind(window), cancelFrame: cancelAnimationFrame.bind(window),
  }, {
    intervalMs: 70,
    createDetector: async () => {
      const vision = await FilesetResolver.forVisionTasks(assetBase + 'wasm');
      const handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: assetBase + 'hand_landmarker.task' }, runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: 0.48, minHandPresenceConfidence: 0.48, minTrackingConfidence: 0.48,
      });
      try {
        const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: assetBase + 'pose_landmarker_lite.task' }, runningMode: 'VIDEO', numPoses: 1,
          minPoseDetectionConfidence: 0.45, minPosePresenceConfidence: 0.45, minTrackingConfidence: 0.45,
        });
        return CreatePoseDetector({ handLandmarker, poseLandmarker });
      } catch (error) { handLandmarker.close(); throw error; }
    },
  });
}

export function CreateBroker(options: Record<string, unknown> & Options) {
  return CreateSensorInputBroker({ ...options, createController: async () => CreateController(options) } as never);
}
