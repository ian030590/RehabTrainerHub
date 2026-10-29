const handColumns = Array.from({ length: 2 }, (_, hand) => [
  `hand_${hand}_present`,
  ...Array.from({ length: 21 }, (_, point) => ['x', 'y', 'z'].map(axis => `hand_${hand}_${point}_${axis}`)).flat(),
]).flat();
export const rawCoordinateColumns = Object.freeze({
  hand: Object.freeze(['t_ms', ...handColumns]),
  pose: Object.freeze(['t_ms', ...handColumns, 'pose_present',
    ...['left_hip', 'right_hip', 'left_knee', 'right_knee'].flatMap(point => ['x', 'y', 'z'].map(axis => `${point}_${axis}`))]),
  tongue: Object.freeze(['t_ms', 'mouth_x', 'mouth_y', 'direction', 'confidence']),
  head: Object.freeze(['t_ms', 'yaw', 'pitch', 'roll', 'face_found']),
});
const maximumRows = 36000;
const maximumBytes = 20 * 1024 * 1024;
const numeric = value => typeof value === 'number' && Number.isFinite(value) ? value : '';
const xyz = points => Array.from({ length: 21 }, (_, index) => ['x', 'y', 'z'].map(axis => numeric(points?.[index]?.[axis]))).flat();
const hands = points => [0, 1].flatMap(index => [Number(points?.[index]?.length === 21), ...xyz(points?.[index])]);

export function CreateRawCoordinateRecorder(kinds) {
  const buffers = new Map(kinds.filter(kind => Object.hasOwn(rawCoordinateColumns, kind)).map(kind => [kind, {
    lines: [], bytes: rawCoordinateColumns[kind].join(',').length + 1, first: null, last: null, truncated: false,
  }]));
  const Record = (kind, message) => {
    const buffer = buffers.get(kind);
    const frame = message?.payload;
    if (!buffer || message?.type !== 'frame' || !Number.isFinite(frame?.timestamp) || frame.timestamp < 0) return;
    if (buffer.first === null) buffer.first = frame.timestamp;
    if (buffer.last !== null && frame.timestamp - buffer.last < 1000 / 30) return;
    const time = Math.round((frame.timestamp - buffer.first) * 1000) / 1000;
    if (!Number.isFinite(time)) return;
    let values;
    if (kind === 'hand') values = hands([frame.landmarks]);
    else if (kind === 'pose') values = [...hands(frame.hands), Number(frame.pose?.length === 4),
      ...Array.from({ length: 4 }, (_, index) => ['x', 'y', 'z'].map(axis => numeric(frame.pose?.[index]?.[axis]))).flat()];
    else if (kind === 'tongue') values = [numeric(frame.mouth?.x), numeric(frame.mouth?.y),
      frame.label === 'Rest' ? 0 : frame.label === 'Tongue_Left' ? -1 : frame.label === 'Tongue_Right' ? 1 : '', numeric(frame.confidence)];
    else values = [numeric(frame.yaw), numeric(frame.pitch), numeric(frame.roll), Number(frame.face === true)];
    const line = [time, ...values].join(',') + '\n';
    if (buffer.lines.length >= maximumRows || buffer.bytes + line.length > maximumBytes) { buffer.truncated = true; return; }
    buffer.lines.push(line);
    buffer.bytes += line.length;
    buffer.last = frame.timestamp;
  };
  const Files = () => [...buffers].filter(([, buffer]) => buffer.lines.length > 0).map(([kind, buffer]) => ({
    kind, csv: rawCoordinateColumns[kind].join(',') + '\n' + buffer.lines.join(''), rows: buffer.lines.length, truncated: buffer.truncated,
  }));
  const Reset = () => buffers.forEach((buffer, kind) => { buffer.lines = []; buffer.bytes = rawCoordinateColumns[kind].join(',').length + 1;
    buffer.first = null; buffer.last = null; buffer.truncated = false; });
  return { Record, Files, Reset };
}

export function ValidateRawCoordinateCsv(kind, csv) {
  if (!Object.hasOwn(rawCoordinateColumns, kind) || typeof csv !== 'string' || csv.includes('\r')) return null;
  const lines = csv.split('\n', maximumRows + 3);
  if (lines.pop() !== '' || lines.shift() !== rawCoordinateColumns[kind].join(',') || lines.length < 1 || lines.length > maximumRows) return null;
  const numberPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
  let last = -Infinity;
  for (const line of lines) {
    const cells = line.split(',', rawCoordinateColumns[kind].length + 1);
    if (cells.length !== rawCoordinateColumns[kind].length || cells[0] === ''
      || cells.some(cell => cell !== '' && (!numberPattern.test(cell) || !Number.isFinite(Number(cell))))) return null;
    const time = Number(cells[0]);
    if (time < 0 || (last === -Infinity ? time !== 0 : time - last < 1000 / 30 - 0.001)) return null;
    last = time;
  }
  return lines.length;
}
