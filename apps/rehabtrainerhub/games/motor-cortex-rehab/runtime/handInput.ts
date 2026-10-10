export type NormalizedLandmark = { x: number; y: number; z: number; visibility?: number };
export type HandInputFrame = { timestamp: number; landmarks: NormalizedLandmark[] };
type InputState = { sessionNonce: string; sequence: number };
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

export function AcceptHandInput(message: unknown, state: InputState) {
  if (!exact(message, ['schema', 'sessionNonce', 'sequence', 'type', 'payload'])
    || message.schema !== 'trainerhub.input/v1' || message.sessionNonce !== state.sessionNonce
    || !Number.isSafeInteger(message.sequence) || (message.sequence as number) <= state.sequence) return false;
  const payload = message.payload;
  if (message.type === 'frame') {
    if (!exact(payload, ['timestamp', 'landmarks']) || typeof payload.timestamp !== 'number'
      || !Number.isFinite(payload.timestamp) || payload.timestamp < 0 || !Array.isArray(payload.landmarks)
      || ![0, 21].includes(payload.landmarks.length) || payload.landmarks.some(point =>
        !exact(point, ['x', 'y', 'z']) || ![point.x, point.y, point.z].every(value =>
          typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10))) return false;
  } else if (message.type === 'ready') {
    if (!exact(payload, [])) return false;
  } else if (message.type === 'error') {
    if (!exact(payload, ['reason']) || !['permission', 'unsupported', 'disconnected', 'initialization'].includes(payload.reason as string)) return false;
  } else return false;
  state.sequence = message.sequence as number;
  return true;
}
