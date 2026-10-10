const sensitiveKey = /(auth|email|jwt|name|password|token|user|participant|secret|cookie|credential|phone)/i;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exact = (value, keys) => plain(value) && Object.keys(value).length === keys.length
  && keys.every(key => Object.hasOwn(value, key));
const metrics = value => plain(value) && Object.keys(value).length <= 12
  && Object.entries(value).every(([key, item]) => /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)
    && !sensitiveKey.test(key) && (item === null || (typeof item === 'number' && Number.isFinite(item) && Math.abs(item) <= 1e12)));

export function IsGameResult(payload, gameId) {
  if (!exact(payload, ['config', 'score']) || !plain(payload.config) || Object.keys(payload.config).length > 64) return false;
  if (!Object.entries(payload.config).every(([key, item]) => /^[a-z][A-Za-z0-9_]{0,63}$/.test(key)
    && !sensitiveKey.test(key) && (typeof item === 'boolean'
      || (typeof item === 'number' && Number.isFinite(item) && Math.abs(item) <= 1e9)
      || (typeof item === 'string' && item.length > 0 && item.length <= 80 && !/[\u0000-\u001f\u007f]/.test(item))))) return false;
  const score = payload.score;
  return exact(score, ['schema', 'gameId', 'summary', 'rounds']) && score.schema === 'rehab-trainer.game-score/v1'
    && score.gameId === gameId && metrics(score.summary) && Array.isArray(score.rounds)
    && score.rounds.length <= 4000 && score.rounds.every(metrics)
    && new TextEncoder().encode(JSON.stringify(payload)).byteLength <= 450 * 1024;
}

/** Called only on a port transferred to the exact sandboxed iframe window. */
export function AcceptGameMessage(message, state) {
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
    if (!state.capabilities?.includes('hand-tracking') || state.complete || !validPayload) return false;
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
