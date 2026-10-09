import { version } from '../package.json';
import { AcceptHandInput } from './handInput';
const gameId = 'gesture-battler';
const schema = 'trainerhub.game/v1';
let port: MessagePort | null = null;
let nonce = '';
let sequence = 0;
let language: 'zh' | 'en' | null = null;
let standalone = true;
let resultPayload: unknown = null;
let cancelStart: (() => void) | null = null;

export function GetGameLanguage() { return language; }
export function InstallHubBridge() {
  if (window.parent === window) return;
  const initialize = (event: MessageEvent) => {
    const message = event.data;
    const parentOrigin = new URL(document.referrer || 'https://trainerhub.cc').origin;
    if (port || event.source !== window.parent || event.origin !== parentOrigin
      || message?.schema !== schema || message.type !== 'init' || message.gameId !== gameId
      || message.version !== version || !/^[a-f0-9]{64}$/.test(message.sessionNonce)
      || event.ports.length !== 1) return;
    nonce = message.sessionNonce;
    port = event.ports[0];
    standalone = message.mode === 'standalone';
    language = message.language === 'en' ? 'en' : 'zh';
    const inputState = { sessionNonce: nonce, sequence: -1 };
    window.dispatchEvent(new CustomEvent('game:language', { detail: language }));
    port.onmessage = ({ data }) => {
      if (AcceptHandInput(data, inputState)) {
        window.dispatchEvent(new CustomEvent('game:input', { detail: data }));
        return;
      }
      if (data?.schema !== schema || data.sessionNonce !== nonce) return;
      if (data.type === 'saved' && ['saving', 'saved', 'error'].includes(data.state) && !standalone) {
        window.dispatchEvent(new CustomEvent('game:saved', { detail: data.state }));
      }
      if (data.type === 'configure' && standalone) window.dispatchEvent(new Event('game:configure'));
    };
    port.start();
    SendGameEvent('ready');
    if (resultPayload) SendGameEvent('result', resultPayload);
    window.removeEventListener('message', initialize);
  };
  window.addEventListener('message', initialize);
}
export function SendGameEvent(type: string, payload: unknown = {}) {
  port?.postMessage({ schema, gameId, version, sessionNonce: nonce, sequence: sequence++, type, payload });
}
export function SendGameResult(config: Record<string, string | number | boolean>, summary: Record<string, number | null>, rounds: Record<string, number | null>[]) {
  resultPayload = { config, score: { schema: 'rehab-trainer.game-score/v1', gameId, summary, rounds } };
  SendGameEvent('result', resultPayload);
}
export function RetryGameSave() { SendGameEvent('retry'); }
export function IsHubGame() { return port !== null && !standalone; }
export function ExitGame() { SendGameEvent('input-stop'); if (port) SendGameEvent('exit'); else window.dispatchEvent(new Event('game:configure')); }
export function StopHandInput() { cancelStart?.(); SendGameEvent('input-stop'); }
export function StartHandInput(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!port) { reject(new Error('unsupported')); return; }
    const stop = () => { cancelStart = null; window.clearTimeout(timeout); window.removeEventListener('game:input', receive); };
    const receive = (event: Event) => {
      const message = (event as CustomEvent).detail;
      if (message.type === 'ready') { stop(); resolve(); }
      if (message.type === 'error') { stop(); reject(new Error(message.payload.reason)); }
    };
    const timeout = window.setTimeout(() => { stop(); StopHandInput(); reject(new Error('initialization')); }, 120000);
    cancelStart = () => { stop(); reject(new Error('cancelled')); };
    window.addEventListener('game:input', receive);
    SendGameEvent('input-start');
  });
}
