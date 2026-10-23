type InputState = { sessionNonce: string; sequence: number };
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const finite = (value: unknown, minimum: number, maximum: number) => typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
const IsPoints = (points: unknown, counts: number[]) => Array.isArray(points) && counts.includes(points.length)
  && points.every(point => exact(point, ['x', 'y', 'z']) && [point.x, point.y, point.z].every(value => finite(value, -10, 10)));

function IsPoseFrame(payload: Record<string, unknown>) {
  return exact(payload, ['timestamp', 'videoWidth', 'videoHeight', 'hands', 'pose']) && finite(payload.timestamp, 0, Number.MAX_SAFE_INTEGER)
    && [payload.videoWidth, payload.videoHeight].every(size => Number.isInteger(size) && finite(size, 1, 8192))
    && Array.isArray(payload.hands) && payload.hands.length <= 2 && payload.hands.every(hand => IsPoints(hand, [21])) && IsPoints(payload.pose, [0, 4]);
}

function IsMicrophoneFrame(payload: Record<string, unknown>) {
  return exact(payload, ['timestamp', 'rms', 'highRatio']) && finite(payload.timestamp, 0, Number.MAX_SAFE_INTEGER)
    && finite(payload.rms, 0, 10) && finite(payload.highRatio, 0, 1);
}

// Messages from the container's pose and microphone proxies: numbers only, in order, for this session.
export function AcceptSensorInput(message: unknown, state: InputState) {
  if (!exact(message, ['schema', 'sessionNonce', 'sequence', 'type', 'payload'])
    || message.schema !== 'trainerhub.input/v1' || message.sessionNonce !== state.sessionNonce
    || !Number.isSafeInteger(message.sequence) || (message.sequence as number) <= state.sequence) return false;
  const payload = message.payload as Record<string, unknown>;
  if (message.type === 'frame') {
    if (payload === null || typeof payload !== 'object' || !(IsPoseFrame(payload) || IsMicrophoneFrame(payload))) return false;
  } else if (message.type === 'ready') {
    if (!exact(payload, [])) return false;
  } else if (message.type === 'error') {
    if (!exact(payload, ['reason']) || !['permission', 'unsupported', 'disconnected', 'initialization'].includes(payload.reason as string)) return false;
  } else return false;
  state.sequence = message.sequence as number;
  return true;
}
