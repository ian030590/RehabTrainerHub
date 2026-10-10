import { version } from '../package.json';
const gameId = 'oculomotor-training';
const schema = 'trainerhub.game/v1';
let port: MessagePort | null = null;
let nonce = '';
let sequence = 0;
let inputSequence = -1;
let language: 'zh' | 'en' | null = null;
let standalone = true;

export function InstallHubBridge() {
  if (window.parent === window) return;
  const initialize = (event: MessageEvent) => {
    const data = event.data;
    const origin = new URL(document.referrer || 'https://trainerhub.cc').origin;
    if (port || event.source !== window.parent || event.origin !== origin || event.ports.length !== 1
      || data?.schema !== schema || data.type !== 'init' || data.gameId !== gameId || data.version !== version
      || !/^[a-f0-9]{64}$/.test(data.sessionNonce)) return;
    port = event.ports[0]; nonce = data.sessionNonce; standalone = data.mode === 'standalone';
    language = data.language === 'en' ? 'en' : 'zh';
    window.dispatchEvent(new CustomEvent('game:language', { detail: language }));
    port.onmessage = ({ data: message }) => {
      if (message?.sessionNonce !== nonce) return;
      if (message.schema === schema && message.type === 'saved' && ['saving', 'saved', 'error'].includes(message.state))
        window.dispatchEvent(new CustomEvent('game:saved', { detail: message.state }));
      if (message.schema === schema && message.type === 'configure' && standalone) window.dispatchEvent(new Event('game:configure'));
      if (message.schema !== 'trainerhub.input/v1' || !Number.isSafeInteger(message.sequence) || message.sequence <= inputSequence) return;
      const payload = message.payload;
      if (message.type === 'frame') {
        if (!payload || Object.keys(payload).length !== 4 || typeof payload.faceDetected !== 'boolean'
          || !Number.isFinite(payload.timestamp) || payload.timestamp < 0
          || !['x', 'y'].every(key => payload[key] === null || (Number.isFinite(payload[key]) && Math.abs(payload[key]) <= 10))) return;
      } else if (message.type === 'ready') { if (!payload || Object.keys(payload).length) return; }
      else if (message.type === 'error') { if (!payload || Object.keys(payload).length !== 1 || !['permission', 'initialization', 'disconnected'].includes(payload.reason)) return; }
      else return;
      inputSequence = message.sequence;
      window.dispatchEvent(new CustomEvent('game:input', { detail: { type: message.type, payload } }));
    };
    port.onmessageerror = () => window.dispatchEvent(new CustomEvent('game:input', { detail: { type: 'error', payload: { reason: 'disconnected' } } }));
    port.start(); SendGameEvent('ready');
    window.removeEventListener('message', initialize);
  };
  window.addEventListener('message', initialize);
}
export function SendGameEvent(type: string, payload: unknown = {}) {
  port?.postMessage({ schema, gameId, version, sessionNonce: nonce, sequence: sequence++, type, payload });
}
export function IsHubGame() { return port !== null && !standalone; }
export function GetGameLanguage() { return language; }
export async function ExitGame() {
  SendGameEvent('input-stop');
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
  if (port) SendGameEvent('exit'); else window.dispatchEvent(new Event('game:configure'));
}
