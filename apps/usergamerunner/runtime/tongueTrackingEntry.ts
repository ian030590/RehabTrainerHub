import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import * as knnClassifier from '@tensorflow-models/knn-classifier';
import * as tf from '@tensorflow/tfjs-core';
// The full @tensorflow/tfjs package the original game used registers the chained tensor methods (toFloat, div…).
import '@tensorflow/tfjs-core/dist/public/chained_ops/register_all_chained_ops';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import { CreateCameraInputController } from './cameraInputController.js';
import { CreatePreviewVideo } from './previewVideo.js';
import { CreateTongueDetector } from './tongueDetector.js';
import { CreateSensorInputBroker } from '../../../packages/ui/src/sensorInputBroker.js';

const assetBase = new URL('./', (document.currentScript as HTMLScriptElement).src).href;
const featureWidth = 32;
const featureHeight = 24;
const lipIndices = Array.from(new Set(FaceLandmarker.FACE_LANDMARKS_LIPS.flatMap(connection => [connection.start, connection.end])));
type Options = { previewHost?: HTMLElement | null };

function Clamp(value: number, min: number, max: number) { return Math.min(Math.max(value, min), max); }

// The original game's mouth image: a mirrored 32×24 crop below the lips, normalized to zero mean and unit spread.
function ExtractMouthFeature(video: HTMLVideoElement, canvas: HTMLCanvasElement, landmarks: NormalizedLandmark[]): tf.Tensor {
  const points = lipIndices.map(index => landmarks[index]).filter(Boolean);
  const minX = Math.min(...points.map(point => point.x));
  const maxX = Math.max(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  const maxY = Math.max(...points.map(point => point.y));
  const mouthWidth = Math.max(maxX - minX, 0.04);
  const mouthHeight = Math.max(maxY - minY, 0.025);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2 + mouthHeight * 0.55;
  const cropWidth = mouthWidth * 1.65;
  const cropHeight = Math.max(mouthHeight * 3.2, cropWidth * 0.7);
  const sourceX = Clamp((centerX - cropWidth / 2) * video.videoWidth, 0, video.videoWidth - 1);
  const sourceY = Clamp((centerY - cropHeight / 2) * video.videoHeight, 0, video.videoHeight - 1);
  const sourceWidth = Math.min(cropWidth * video.videoWidth, video.videoWidth - sourceX);
  const sourceHeight = Math.min(cropHeight * video.videoHeight, video.videoHeight - sourceY);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return tf.zeros([featureWidth * featureHeight]);
  context.save();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width, 0);
  context.scale(-1, 1);
  context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
  context.restore();
  return tf.tidy(() => {
    const image = tf.browser.fromPixels(canvas, 1).toFloat().div(255);
    const moments = tf.moments(image);
    return image.sub(moments.mean).div(moments.variance.sqrt().add(0.05)).flatten();
  });
}

export function CreateController({ previewHost }: Options = {}) {
  return CreateCameraInputController({
    getUserMedia: navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices),
    createVideo: () => CreatePreviewVideo(previewHost),
    requestFrame: requestAnimationFrame.bind(window), cancelFrame: cancelAnimationFrame.bind(window),
  }, {
    intervalMs: 72,
    createDetector: async () => {
      await tf.ready();
      const vision = await FilesetResolver.forVisionTasks(assetBase + 'wasm');
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: assetBase + 'face_landmarker.task' }, runningMode: 'VIDEO', numFaces: 1,
        minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      const canvas = document.createElement('canvas');
      canvas.width = featureWidth;
      canvas.height = featureHeight;
      // A new classifier per session: calibration examples never outlive the session that captured them.
      return CreateTongueDetector({ landmarker, lipIndices, classifier: knnClassifier.create(),
        extractFeature: (video: HTMLVideoElement, landmarks: NormalizedLandmark[]) => ExtractMouthFeature(video, canvas, landmarks) });
    },
  });
}

export function CreateBroker(options: Record<string, unknown> & Options) {
  return CreateSensorInputBroker({ ...options, createController: async () => CreateController(options) } as never);
}
