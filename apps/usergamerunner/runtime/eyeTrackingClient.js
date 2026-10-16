import { AcceptGameMessage } from '../../../packages/ui/src/selfContainedGame.js';
import { CreateEyeTrackingBroker } from '../../../packages/ui/src/eyeTrackingBroker.js';
import { IsReferenceCsvPayload } from '../../../packages/ui/src/oculomotorCsv.js';
(() => {
  const inputOrigin = new URL(document.currentScript.src).origin;
  const inputBase = new URL('.', document.currentScript.src);
  const createController = () => {
    let frame = null;
    let port = null;
    let sequence = -1;
    let requestSequence = 0;
    let pending = null;
    let timer = null;
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
    const send = (type, payload = {}) => port?.postMessage({ schema: 'trainerhub.eye-proxy/v1', sessionNonce: nonce, sequence: requestSequence++, type, payload });
    const Stop = () => {
      send('stop'); port?.close(); port = null;
      frame?.remove(); frame = null;
      clearTimeout(timer); pending?.(false); pending = null;
    };
    const Start = (onFrame, onError) => new Promise(resolve => {
      Stop(); sequence = -1; requestSequence = 0; pending = resolve;
      frame = document.createElement('iframe');
      frame.title = 'WebGazer camera preview';
      frame.allow = 'camera';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      // This fixed first-party input document has no Hub credentials and never loads game code.
      Object.assign(frame.style, { position: 'fixed', width: '180px', height: '140px', left: '16px', bottom: '16px', zIndex: '10000', border: '0' });
      frame.onload = () => {
        if (!frame || port) return;
        const channel = new MessageChannel(); port = channel.port1;
        port.onmessage = ({ data }) => {
          if (data?.schema !== 'trainerhub.eye-proxy/v1' || data.sessionNonce !== nonce
            || !Number.isSafeInteger(data.sequence) || data.sequence <= sequence) return;
          const payload = data.payload;
          if (data.type === 'frame') {
            if (!payload || Object.keys(payload).length !== 4 || typeof payload.faceDetected !== 'boolean'
              || !Number.isFinite(payload.timestamp) || payload.timestamp < 0
              || !['x', 'y'].every(key => payload[key] === null || (Number.isFinite(payload[key]) && Math.abs(payload[key]) <= 10))) return;
            onFrame({ timestamp: payload.timestamp, x: payload.x, y: payload.y, faceDetected: payload.faceDetected });
          } else if (data.type === 'ready') { clearTimeout(timer); pending?.(true); pending = null; }
          else if (data.type === 'error' && ['permission', 'initialization', 'disconnected'].includes(payload?.reason)) { Stop(); onError(payload.reason); }
          else return;
          sequence = data.sequence;
        };
        port.onmessageerror = () => { Stop(); onError('disconnected'); };
        port.start();
        frame.contentWindow.postMessage({ schema: 'trainerhub.eye-proxy/v1', type: 'init', sessionNonce: nonce }, inputOrigin, [channel.port2]);
      };
      timer = setTimeout(() => { Stop(); onError('initialization'); }, 30000);
      frame.src = new URL('preview.html', inputBase).href;
      (document.querySelector('dialog[open]') || document.body).append(frame);
    });
    return { Start, Stop, Calibrate: (x, y) => send('calibrate', { x, y }), Reset: () => send('reset') };
  };
  window.TrainerHubEyeTracking = { CreateController: createController,
    CreateBroker: options => CreateEyeTrackingBroker({ ...options, createController }), AcceptGameMessage,
    DownloadCsv: payload => {
      if (!IsReferenceCsvPayload(payload)) return;
      const url = URL.createObjectURL(new Blob(['\uFEFF', payload.text], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = payload.fileName; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    },
  };
})();
