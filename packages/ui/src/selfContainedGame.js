import { IsOculomotorCsvPayload, IsReferenceCsvPayload } from './oculomotorCsv.js';
import { IsUfovResultFile, IsUfovResultFileName } from './resultFiles.js';
const sensitiveKey = /(auth|email|jwt|name|password|token|user|participant|secret|cookie|credential|phone)/i;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exact = (value, keys) => plain(value) && Object.keys(value).length === keys.length
  && keys.every(key => Object.hasOwn(value, key));
const metrics = value => plain(value) && Object.keys(value).length <= 12
  && Object.entries(value).every(([key, item]) => /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)
    && !sensitiveKey.test(key) && (item === null || (typeof item === 'number' && Number.isFinite(item) && Math.abs(item) <= 1e12)));

/** Bounded primitive settings: at most 64 short, non-sensitive fields. Used for result config and saved settings. */
export function IsGameSettings(value) {
  return plain(value) && Object.keys(value).length <= 64 && Object.entries(value).every(([key, item]) => /^[a-z][A-Za-z0-9_]{0,63}$/.test(key)
    && !sensitiveKey.test(key) && (typeof item === 'boolean'
      || (typeof item === 'number' && Number.isFinite(item) && Math.abs(item) <= 1e9)
      || (typeof item === 'string' && item.length > 0 && item.length <= 80 && !/[\u0000-\u001f\u007f]/.test(item))));
}

export function IsGameResult(payload, gameId) {
  if (!exact(payload, ['config', 'score']) || !IsGameSettings(payload.config)) return false;
  const score = payload.score;
  return exact(score, ['schema', 'gameId', 'summary', 'rounds']) && score.schema === 'rehab-trainer.game-score/v1'
    && score.gameId === gameId && metrics(score.summary) && Array.isArray(score.rounds)
    && score.rounds.length <= 4000 && score.rounds.every(metrics)
    && new TextEncoder().encode(JSON.stringify(payload)).byteLength <= 450 * 1024;
}

// The game's last confirmed settings, kept by its container (Hub or standalone launcher) on this device.
// The launcher inlines these functions, so they only use helpers it also defines.
export function ReadSavedGameSettings(storage, gameId) {
  try {
    const text = storage?.getItem('trainerhub.game-settings/v1:' + gameId);
    if (typeof text !== 'string' || text.length > 16384) return null;
    const value = JSON.parse(text);
    return IsGameSettings(value) && Object.keys(value).length > 0 ? value : null;
  } catch { return null; }
}

export function WriteSavedGameSettings(storage, gameId, settings) {
  try {
    if (IsGameSettings(settings) && Object.keys(settings).length > 0) storage?.setItem('trainerhub.game-settings/v1:' + gameId, JSON.stringify(settings));
  } catch { /* Storage may be blocked or full; the game then starts from its defaults. */ }
}

/** A `settings` message from a game whose release declares settings storage. */
export function AcceptGameSettingsMessage(message, state) {
  if (!exact(message, ['schema', 'gameId', 'version', 'sessionNonce', 'sequence', 'type', 'payload'])
    || message.schema !== 'trainerhub.game/v1' || message.type !== 'settings' || message.gameId !== state.gameId
    || message.version !== state.version || message.sessionNonce !== state.sessionNonce
    || !Number.isSafeInteger(message.sequence) || message.sequence <= state.sequence
    || !state.capabilities?.includes('settings-storage')
    || !IsGameSettings(message.payload) || Object.keys(message.payload).length === 0) return false;
  state.sequence = message.sequence;
  return true;
}

// Reviewed sensor proxies: each input belongs to one official game and the capability its release declares.
// The standalone launcher inlines these helpers, so they only use helpers it also defines.
export function SensorAllowed(state, input) {
  const owners = { pose: ['every-ball-response', 'pose-tracking'], microphone: ['every-ball-response', 'microphone-level'],
    tongue: ['tongue-catch', 'tongue-tracking'], head: ['seagull-flight', 'head-tracking'] };
  return Object.hasOwn(owners, input) && state.gameId === owners[input][0] && state.capabilities?.includes(owners[input][1]) === true;
}

export function CameraSensorAllowed(state) { return ['pose', 'tongue', 'head'].some(input => SensorAllowed(state, input)); }

// The preview rectangle is relative to the game frame and has to stay inside it.
export function IsPreviewRect(value) {
  return exact(value, ['visible', 'x', 'y', 'width', 'height']) && typeof value.visible === 'boolean'
    && ['x', 'y', 'width', 'height'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0 && value[key] <= 1)
    && value.x + value.width <= 1 + 1e-9 && value.y + value.height <= 1 + 1e-9;
}

/** Called only on a port transferred to the exact sandboxed iframe window. */
export function AcceptGameMessage(message, state) {
  if (message?.type === 'settings') return AcceptGameSettingsMessage(message, state);
  if (!exact(message, ['schema', 'gameId', 'version', 'sessionNonce', 'sequence', 'type', 'payload'])
    || message.schema !== 'trainerhub.game/v1' || message.gameId !== state.gameId
    || message.version !== state.version || message.sessionNonce !== state.sessionNonce
    || !Number.isSafeInteger(message.sequence) || message.sequence <= state.sequence) return false;
  if (message.type === 'result') {
    if (state.complete || !IsGameResult(message.payload, state.gameId)) return false;
    state.complete = true;
  } else if (['ready', 'active', 'exit', 'retry'].includes(message.type)) {
    if (!exact(message.payload, []) || (state.complete && !['exit', 'retry'].includes(message.type))
      || (message.type === 'retry' && !state.complete)) return false;
  } else if (['input-start', 'input-stop'].includes(message.type)) {
    const validPayload = exact(message.payload, []) || (message.type === 'input-start'
      && exact(message.payload, ['hand']) && ['any', 'left', 'right'].includes(message.payload.hand));
    const eyeInput = state.gameId === 'oculomotor-training' && state.capabilities?.includes('eye-tracking') && exact(message.payload, []);
    const sensorInput = message.type === 'input-start'
      ? exact(message.payload, ['input']) && SensorAllowed(state, message.payload.input)
      : exact(message.payload, []) && ['pose', 'microphone', 'tongue', 'head'].some(input => SensorAllowed(state, input));
    if (state.complete || !(eyeInput || sensorInput || (state.capabilities?.includes('hand-tracking') && validPayload))) return false;
  } else if (message.type === 'input-preview') {
    if (state.complete || !CameraSensorAllowed(state) || !IsPreviewRect(message.payload)) return false;
  } else if (message.type === 'input-capture') {
    if (state.complete || !SensorAllowed(state, 'tongue') || !exact(message.payload, ['label', 'active'])
      || !['Rest', 'Tongue_Left', 'Tongue_Right'].includes(message.payload.label) || typeof message.payload.active !== 'boolean') return false;
  } else if (['fullscreen-request', 'fullscreen-exit'].includes(message.type)) {
    // The camera image sits behind the game frame, so the container enters fullscreen with both of them.
    if (!CameraSensorAllowed(state) || !exact(message.payload, [])) return false;
  } else if (['input-calibrate', 'input-reset', 'gaze-csv', 'csv-file', 'csv-download'].includes(message.type)) {
    if (state.gameId !== 'oculomotor-training' || !state.capabilities?.includes('eye-tracking')
      || (state.complete && message.type !== 'csv-download')) return false;
    if (message.type === 'input-calibrate') {
      if (!exact(message.payload, ['x', 'y']) || !['x', 'y'].every(key => typeof message.payload[key] === 'number'
        && Number.isFinite(message.payload[key]) && message.payload[key] >= 0 && message.payload[key] <= 1)) return false;
    } else if (message.type === 'gaze-csv') {
      if (!IsOculomotorCsvPayload(message.payload)) return false;
    } else if (message.type === 'csv-file') {
      if (!IsReferenceCsvPayload(message.payload)) return false;
    } else if (!exact(message.payload, [])) return false;
  } else if (['result-file', 'result-file-download'].includes(message.type)) {
    // Files are staged before the result; the download request may follow it from the results page.
    if (state.gameId !== 'ufov' || !state.capabilities?.includes('result-files')) return false;
    if (message.type === 'result-file' ? state.complete || !IsUfovResultFile(message.payload)
      : !exact(message.payload, ['fileName']) || !IsUfovResultFileName(message.payload.fileName)) return false;
  } else if (message.type === 'sample') {
    if (state.complete || !exact(message.payload, ['image', 'metadata'])
      || !(message.payload.image instanceof Blob) || message.payload.image.type !== 'image/png'
      || message.payload.image.size > 1024 * 1024 || !plain(message.payload.metadata)
      || JSON.stringify(message.payload.metadata).length > 8192
      || Object.keys(message.payload.metadata).some(key => sensitiveKey.test(key))) return false;
  } else return false;
  state.sequence = message.sequence;
  return true;
}
