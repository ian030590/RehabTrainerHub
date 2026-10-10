import { CreateEyeTrackingController } from './eyeTrackingController.js';

let port = null;
let nonce = '';
let sequence = 0;
let received = -1;
const reply = (type, payload) => port?.postMessage({ schema: 'trainerhub.eye-proxy/v1', sessionNonce: nonce, sequence: sequence++, type, payload });
const controller = CreateEyeTrackingController({
  getUserMedia: constraints => navigator.mediaDevices.getUserMedia(constraints),
  requestFrame: callback => requestAnimationFrame(callback), cancelFrame: id => cancelAnimationFrame(id),
  createEngine: async stream => {
    window.TrainerHubEyeStream = stream;
    window.saveDataAcrossSessions = false;
    const engine = window.webgazer;
    engine.params.showVideoPreview = true;
    engine.params.videoViewerWidth = 180;
    engine.params.videoViewerHeight = 135;
    engine.removeMouseEventListeners();
    engine.getRegression().forEach(regression => regression.init());
    try {
      await engine.begin();
      engine.pause();
      engine.removeMouseEventListeners();
      engine.showPredictionPoints(false);
      await engine.getTracker().model;
    } catch (error) { stream.getTracks().forEach(track => track.stop()); throw error; }
    return { Predict: () => { engine.getTracker().predictionReady = false; return engine.getCurrentPrediction(); }, FaceDetected: () => engine.getTracker().predictionReady,
      Calibrate: (x, y) => engine.recordScreenPosition(x, y, 'click'),
      Reset: () => engine.getRegression().forEach(regression => regression.init()),
      Dispose: () => {
        engine.pause(); engine.removeMouseEventListeners();
        try { engine.end(); } catch { /* The document may already be detached. */ }
        void Promise.resolve(engine.getTracker().model).then(model => {
          model.dispose?.(); model.pipeline?.meshDetector?.dispose?.(); model.pipeline?.boundingBoxDetector?.blazeFaceModel?.dispose?.();
        }).catch(() => undefined);
        window.TrainerHubEyeStream = null;
      },
    };
  },
});
window.addEventListener('message', function Initialize(event) {
  const expected = new URL(document.referrer || location.origin).origin;
  if (port || event.source !== window.parent || event.origin !== expected || event.ports.length !== 1
    || event.data?.schema !== 'trainerhub.eye-proxy/v1' || event.data.type !== 'init' || !/^[a-f0-9]{64}$/.test(event.data.sessionNonce)) return;
  nonce = event.data.sessionNonce;
  port = event.ports[0];
  port.onmessage = ({ data }) => {
    if (data?.schema !== 'trainerhub.eye-proxy/v1' || data.sessionNonce !== nonce || !Number.isSafeInteger(data.sequence) || data.sequence <= received) return;
    if (data.type === 'calibrate') {
      if (!data.payload || Object.keys(data.payload).length !== 2 || !['x', 'y'].every(key => Number.isFinite(data.payload[key]) && data.payload[key] >= 0 && data.payload[key] <= 1)) return;
      controller.Calibrate(data.payload.x, data.payload.y);
    } else if (data.type === 'reset') controller.Reset();
    else if (data.type === 'stop') controller.Stop();
    else return;
    received = data.sequence;
  };
  port.onmessageerror = () => controller.Stop();
  port.start();
  void controller.Start(payload => reply('frame', payload), reason => reply('error', { reason })).then(started => { if (started) reply('ready', {}); });
});
window.addEventListener('pagehide', () => { controller.Stop(); port?.close(); });
