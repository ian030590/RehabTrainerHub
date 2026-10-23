type InputState = { sessionNonce: string; sequence: number };
const labels = ['Rest', 'Tongue_Left', 'Tongue_Right'];
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const finite = (value: unknown, minimum: number, maximum: number) => typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;

// A mouth point comes only with a face; the sample counts say how far calibration has got.
function IsTongueFrame(payload: unknown) {
  if (!exact(payload, ['timestamp', 'videoWidth', 'videoHeight', 'face', 'mouth', 'label', 'confidence', 'samples'])) return false;
  const { face, mouth, samples } = payload;
  return finite(payload.timestamp, 0, Number.MAX_SAFE_INTEGER)
    && [payload.videoWidth, payload.videoHeight].every(size => Number.isInteger(size) && finite(size, 1, 8192))
    && typeof face === 'boolean' && (face ? exact(mouth, ['x', 'y']) && finite(mouth.x, -10, 10) && finite(mouth.y, -10, 10) : mouth === null)
    && (payload.label === null || labels.includes(payload.label as string)) && finite(payload.confidence, 0, 1)
    && exact(samples, labels) && labels.every(label => Number.isSafeInteger(samples[label]) && (samples[label] as number) >= 0);
}

// Messages from the container's mouth proxy: numbers and labels only, in order, for this session.
export function AcceptSensorInput(message: unknown, state: InputState) {
  if (!exact(message, ['schema', 'sessionNonce', 'sequence', 'type', 'payload'])
    || message.schema !== 'trainerhub.input/v1' || message.sessionNonce !== state.sessionNonce
    || !Number.isSafeInteger(message.sequence) || (message.sequence as number) <= state.sequence) return false;
  const payload = message.payload;
  if (message.type === 'frame') {
    if (!IsTongueFrame(payload)) return false;
  } else if (message.type === 'ready') {
    if (!exact(payload, [])) return false;
  } else if (message.type === 'error') {
    if (!exact(payload, ['reason']) || !['permission', 'unsupported', 'disconnected', 'initialization'].includes(payload.reason as string)) return false;
  } else return false;
  state.sequence = message.sequence as number;
  return true;
}
