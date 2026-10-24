type InputState = { sessionNonce: string; sequence: number };
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const finite = (value: unknown, minimum: number, maximum: number) => typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;

// Head angles in degrees come only with a face; without one all three are null.
function IsHeadFrame(payload: unknown) {
  if (!exact(payload, ['timestamp', 'videoWidth', 'videoHeight', 'face', 'yaw', 'pitch', 'roll'])) return false;
  const angles = [payload.yaw, payload.pitch, payload.roll];
  return finite(payload.timestamp, 0, Number.MAX_SAFE_INTEGER)
    && [payload.videoWidth, payload.videoHeight].every(size => Number.isInteger(size) && finite(size, 1, 8192))
    && typeof payload.face === 'boolean'
    && (payload.face ? angles.every(angle => finite(angle, -180, 180)) : angles.every(angle => angle === null));
}

// Messages from the container's head proxy: numbers only, in order, for this session.
export function AcceptSensorInput(message: unknown, state: InputState) {
  if (!exact(message, ['schema', 'sessionNonce', 'sequence', 'type', 'payload'])
    || message.schema !== 'trainerhub.input/v1' || message.sessionNonce !== state.sessionNonce
    || !Number.isSafeInteger(message.sequence) || (message.sequence as number) <= state.sequence) return false;
  const payload = message.payload;
  if (message.type === 'frame') {
    if (!IsHeadFrame(payload)) return false;
  } else if (message.type === 'ready') {
    if (!exact(payload, [])) return false;
  } else if (message.type === 'error') {
    if (!exact(payload, ['reason']) || !['permission', 'unsupported', 'disconnected', 'initialization'].includes(payload.reason as string)) return false;
  } else return false;
  state.sequence = message.sequence as number;
  return true;
}
