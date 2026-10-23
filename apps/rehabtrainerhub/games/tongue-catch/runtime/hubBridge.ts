import { version } from '../package.json';
import { DisposeAudioFeedback } from './soundManager';
import { AcceptSensorInput } from './sensorInput';
const gameId = 'tongue-catch';
const schema = 'trainerhub.game/v1';
let port: MessagePort | null = null;
let nonce = '';
let sequence = 0;
let language: 'zh' | 'en' | null = null;
let standalone = true;
let resultPayload: unknown = null;
let savedSettings: Record<string, unknown> | null = null;
let cancelStart: (() => void) | null = null;
let containerFullscreen = false;

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
    savedSettings = message.settings && typeof message.settings === 'object' && !Array.isArray(message.settings) ? message.settings : null;
    language = message.language === 'en' ? 'en' : 'zh';
    const inputState = { sessionNonce: nonce, sequence: -1 };
    window.dispatchEvent(new CustomEvent('game:language', { detail: language }));
    port.onmessage = ({ data }) => {
      if (AcceptSensorInput(data, inputState)) {
        window.dispatchEvent(new CustomEvent('game:input', { detail: data }));
        return;
      }
      if (data?.schema !== schema || data.sessionNonce !== nonce) return;
      // The container enters fullscreen with the camera image, so it tells the game when that changes.
      if (data.type === 'fullscreen' && Object.keys(data).length === 4 && typeof data.active === 'boolean') {
        containerFullscreen = data.active;
        window.dispatchEvent(new CustomEvent('game:fullscreen', { detail: data.active }));
      }
      if (data.type === 'saved' && ['saving', 'saved', 'error'].includes(data.state) && !standalone) {
        window.dispatchEvent(new CustomEvent('game:saved', { detail: data.state }));
      }
      if (data.type === 'configure' && standalone) window.dispatchEvent(new Event('game:configure'));
    };
    port.start();
    SendGameEvent('ready');
    if (savedSettings) window.dispatchEvent(new Event('game:settings'));
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
export function IsContainerFullscreen() { return containerFullscreen; }

function WaitForFullscreen(active: boolean, timeoutMs = 1500) {
  return new Promise<boolean>(resolve => {
    if (containerFullscreen === active) { resolve(true); return; }
    const finish = (value: boolean) => { window.clearTimeout(timer); window.removeEventListener('game:fullscreen', change); resolve(value); };
    const change = () => { if (containerFullscreen === active) finish(true); };
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    window.addEventListener('game:fullscreen', change);
  });
}
// Resolves false when the container stays windowed (the browser refused, or the reply is late); play continues either way.
export function RequestContainerFullscreen() {
  if (!port) return Promise.resolve(false);
  if (containerFullscreen) return Promise.resolve(true);
  SendGameEvent('fullscreen-request');
  return WaitForFullscreen(true);
}
export async function ExitContainerFullscreen() {
  if (!port || !containerFullscreen) return;
  SendGameEvent('fullscreen-exit');
  await WaitForFullscreen(false);
}
export async function ExitGame() {
  DisposeAudioFeedback();
  SendGameEvent('input-stop');
  await ExitContainerFullscreen();
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
  if (port) SendGameEvent('exit'); else window.dispatchEvent(new Event('game:configure'));
}

export function StopSensorInput() { cancelStart?.(); SendGameEvent('input-stop'); }
export function StartSensorInput(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!port) { reject(new Error('unsupported')); return; }
    const stop = () => { cancelStart = null; window.clearTimeout(timeout); window.removeEventListener('game:input', receive); };
    const receive = (event: Event) => {
      const message = (event as CustomEvent).detail;
      if (message.type === 'ready') { stop(); resolve(); }
      if (message.type === 'error') { stop(); reject(new Error(message.payload.reason)); }
    };
    const timeout = window.setTimeout(() => { stop(); StopSensorInput(); reject(new Error('initialization')); }, 120000);
    cancelStart = () => { stop(); reject(new Error('cancelled')); };
    window.addEventListener('game:input', receive);
    SendGameEvent('input-start', { input: 'tongue' });
  });
}

// Calibration: the container's classifier takes samples for this label while active is true.
export function SetInputCapture(label: 'Rest' | 'Tongue_Left' | 'Tongue_Right', active: boolean) { SendGameEvent('input-capture', { label, active }); }

// The camera area as fractions of the game frame; both edges are rounded so it never reaches past the frame.
export function ToPreviewRect(rect: { left: number; top: number; width: number; height: number }, viewportWidth: number, viewportHeight: number) {
  const fraction = (value: number, size: number) => Math.round(Math.min(Math.max(value / size, 0), 1) * 10000) / 10000;
  const x = fraction(rect.left, viewportWidth);
  const y = fraction(rect.top, viewportHeight);
  const right = fraction(rect.left + rect.width, viewportWidth);
  const bottom = fraction(rect.top + rect.height, viewportHeight);
  return { x, y, width: Math.round((right - x) * 10000) / 10000, height: Math.round((bottom - y) * 10000) / 10000 };
}
// The container draws the camera image behind the transparent game in this area; the game never sees the image.
export function SetInputPreview(rect: { x: number; y: number; width: number; height: number } | null) {
  SendGameEvent('input-preview', rect ? { visible: true, ...rect } : { visible: false, x: 0, y: 0, width: 0, height: 0 });
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
