import { version } from '../package.json';
import { DisposeAudioFeedback } from './soundManager';
const gameId = 'ufov';
const schema = 'trainerhub.game/v1';
let port: MessagePort | null = null;
let nonce = '';
let sequence = 0;
let resultPayload: unknown = null;
let resultFiles: { fileName: string; text: string }[] = [];
let standalone = false;
let savedSettings: Record<string, unknown> | null = null;
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
    standalone = message.mode === 'standalone';
    savedSettings = message.settings && typeof message.settings === 'object' && !Array.isArray(message.settings) ? message.settings : null;
    gameLanguage = message.language === 'en' ? 'en' : 'zh';
    window.dispatchEvent(new CustomEvent('game:language', { detail: gameLanguage }));
    port.onmessage = ({ data }) => {
      if (data?.schema !== schema || data.sessionNonce !== nonce) return;
      if (data.type === 'saved' && ['saving', 'saved', 'error'].includes(data.state) && !standalone) {
        window.dispatchEvent(new CustomEvent('game:saved', { detail: data.state }));
      }
      if (data.type === 'configure' && standalone) window.dispatchEvent(new Event('game:configure'));
    };
    port.start();
    SendGameEvent('ready');
    if (savedSettings) window.dispatchEvent(new Event('game:settings'));
    if (resultPayload) SendResult();
    window.removeEventListener('message', initialize);
  };
  window.addEventListener('message', initialize);
}

export function SendGameEvent(type: string, payload: unknown = {}) {
  port?.postMessage({ schema, gameId, version, sessionNonce: nonce, sequence: sequence++, type, payload });
}
// Result files go to the container first, so they are in place by the time it shows the results page.
function SendResult() {
  for (const file of resultFiles) SendGameEvent('result-file', file);
  SendGameEvent('result', resultPayload);
}
export function SendGameResult(config: Record<string, string | number | boolean>, summary: Record<string, number | null>, rounds: Record<string, number | null>[],
  files: { fileName: string; text: string }[] = []) {
  resultPayload = { config, score: { schema: 'rehab-trainer.game-score/v1', gameId, summary, rounds } };
  resultFiles = files;
  if (port) SendResult();
}
// The sandboxed game cannot download; it asks the container to save a file it already holds.
export function CanDownloadResultFiles() { return port !== null; }
export function RequestResultDownload(fileName: string) { SendGameEvent('result-file-download', { fileName }); }
export function RetryGameSave() { SendGameEvent('retry'); }
export function IsHubGame() { return port !== null && !standalone; }
export function GetGameLanguage() { return gameLanguage; }
export async function ExitGame() {
  DisposeAudioFeedback();
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
  if (port) SendGameEvent('exit'); else window.dispatchEvent(new Event('game:configure'));
}

// Delivers the device's last confirmed settings from the container, now or when they arrive.
export function OnSavedSettings(listener: (settings: Record<string, unknown>) => void) {
  const deliver = () => { if (savedSettings) listener(savedSettings); };
  deliver();
  window.addEventListener('game:settings', deliver);
  return () => window.removeEventListener('game:settings', deliver);
}
// The container keeps confirmed settings on this device; the sandboxed game cannot use storage itself.
export function SaveGameSettings(settings: object) { SendGameEvent('settings', { ...settings }); }
