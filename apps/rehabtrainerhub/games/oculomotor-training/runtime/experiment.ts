import { SendGameEvent } from './hubBridge';
import type { OculomotorSettings } from '../settings';
declare global {
  interface Window {
    OculomotorInput: { Calibrate: (x: number, y: number) => void; Reset: () => void; Stop: () => void; FaceDetected: () => boolean; Prediction: () => { x: number | null; y: number | null; sample_performance_ms?: number } | null };
    OculomotorDownload: (fileName: string, text: string) => void;
    oculomotorExperiment: { Start: (settings: OculomotorSettings) => void; Stop: () => void };
  }
}
let loading: Promise<void> | null = null;
let gaze: { x: number | null; y: number | null; faceDetected: boolean; timestamp: number } | null = null;
let receivedAt = -Infinity;
export function InstallEyeInput() {
  window.addEventListener('game:input', (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail.type === 'frame') { gaze = detail.payload; receivedAt = performance.now(); }
    else if (detail.type === 'error') { gaze = null; receivedAt = -Infinity; }
  });
  window.OculomotorInput = {
    Calibrate: (x, y) => SendGameEvent('input-calibrate', { x: x / innerWidth, y: y / innerHeight }),
    Reset: () => { gaze = null; SendGameEvent('input-reset'); },
    Stop: () => { gaze = null; receivedAt = -Infinity; SendGameEvent('input-stop'); },
    FaceDetected: () => performance.now() - receivedAt <= 500 && Boolean(gaze?.faceDetected),
    Prediction: () => {
      if (!gaze || performance.now() - receivedAt > 250) return null;
      const sourceTime = gaze.timestamp - performance.timeOrigin;
      return { x: gaze.x === null ? null : gaze.x * innerWidth, y: gaze.y === null ? null : gaze.y * innerHeight,
        ...(sourceTime >= 0 && sourceTime <= receivedAt ? { sample_performance_ms: sourceTime } : {}) };
    },
  };
  window.OculomotorDownload = (fileName, text) => SendGameEvent('csv-file', { fileName, text });
}
export function PrepareExperiment(): Promise<void> {
  if (window.oculomotorExperiment) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = './reference/experiment.js';
    script.onload = () => { if (window.oculomotorExperiment) resolve(); else { loading = null; reject(new Error('Experiment unavailable')); } };
    script.onerror = () => { loading = null; script.remove(); reject(new Error('Experiment unavailable')); };
    document.head.append(script);
  });
  return loading;
}
