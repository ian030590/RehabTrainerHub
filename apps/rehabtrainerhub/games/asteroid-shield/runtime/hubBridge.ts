import { version } from '../package.json';
const gameId = 'asteroid-shield';
const schema = 'trainerhub.game/v1';
let port: MessagePort | null = null;
let nonce = '';
let sequence = 0;
let resultPayload: unknown = null;
let gameLanguage: 'zh' | 'en' | null = null;

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
    gameLanguage = message.language === 'en' ? 'en' : 'zh';
    window.dispatchEvent(new CustomEvent('game:language', { detail: gameLanguage }));
    port.onmessage = ({ data }) => {
      if (data?.schema !== schema || data.sessionNonce !== nonce) return;
      if (data.type === 'saved' && ['saving', 'saved', 'error'].includes(data.state)) {
        window.dispatchEvent(new CustomEvent('game:saved', { detail: data.state }));
      }
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
export function IsHubGame() { return port !== null; }
export function GetGameLanguage() { return gameLanguage; }
export async function ExitGame() {
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
  if (IsHubGame()) SendGameEvent('exit');
  else window.dispatchEvent(new Event('game:configure'));
}
