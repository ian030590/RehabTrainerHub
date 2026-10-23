import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { CreateCameraInputController } from './cameraInputController.js';
import { CreatePreviewVideo } from './previewVideo.js';
import { CreateHeadPoseDetector } from './headPoseDetector.js';
import { CreateSensorInputBroker } from '../../../packages/ui/src/sensorInputBroker.js';

const assetBase = new URL('./', (document.currentScript as HTMLScriptElement).src).href;
type Options = { previewHost?: HTMLElement | null };

// About 30 readings a second: enough to see each nod of a head movement exercise.
export function CreateController({ previewHost }: Options = {}) {
  return CreateCameraInputController({
    getUserMedia: navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices),
    createVideo: () => CreatePreviewVideo(previewHost),
    requestFrame: requestAnimationFrame.bind(window), cancelFrame: cancelAnimationFrame.bind(window),
  }, {
    intervalMs: 33,
    createDetector: async () => {
      const vision = await FilesetResolver.forVisionTasks(assetBase + 'wasm');
      const options = (delegate: 'GPU' | 'CPU') => ({
        baseOptions: { modelAssetPath: assetBase + 'face_landmarker.task', delegate }, runningMode: 'VIDEO' as const, numFaces: 1,
        outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      // Some devices cannot start the GPU delegate; the CPU one is slower but works everywhere.
      const landmarker = await FaceLandmarker.createFromOptions(vision, options('GPU'))
        .catch(() => FaceLandmarker.createFromOptions(vision, options('CPU')));
      return CreateHeadPoseDetector({ landmarker });
    },
  });
}

export function CreateBroker(options: Record<string, unknown> & Options) {
  return CreateSensorInputBroker({ ...options, createController: async () => CreateController(options) } as never);
}
