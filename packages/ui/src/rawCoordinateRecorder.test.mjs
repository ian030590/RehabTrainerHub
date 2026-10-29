import assert from 'node:assert/strict';
import test from 'node:test';
import { CreateRawCoordinateRecorder, rawCoordinateColumns } from './rawCoordinateRecorder.js';

const points = Array.from({ length: 21 }, (_, index) => ({ x: index / 100, y: 0.2, z: -0.1, image: 'private' }));
const frame = payload => ({ type: 'frame', payload });

test('records only declared numeric proxy fields, relative time and at most 30 rows per second', () => {
  const recorder = CreateRawCoordinateRecorder(['hand', 'head']);
  recorder.Record('hand', frame({ timestamp: 100, landmarks: points, name: 'private', image: 'secret' }));
  recorder.Record('hand', frame({ timestamp: 110, landmarks: points }));
  recorder.Record('hand', frame({ timestamp: 134, landmarks: [] }));
  recorder.Record('microphone', frame({ timestamp: 100, rms: 0.5 }));
  recorder.Record('tongue', frame({ timestamp: 100, label: 'Rest' }));
  recorder.Record('head', frame({ timestamp: 100, yaw: 3, pitch: 2, roll: 1, face: true }));
  recorder.Record('head', frame({ timestamp: 134, yaw: NaN, pitch: Infinity, roll: null, face: false }));
  const files = recorder.Files();
  assert.deepEqual(files.map(file => file.kind), ['hand', 'head']);
  assert.equal(files[0].rows, 2);
  assert.equal(files[0].csv.split('\n')[1].split(',')[0], '0');
  assert.equal(files[0].csv.split('\n')[2].split(',')[0], '34');
  assert.doesNotMatch(files[0].csv, /private|secret|image|name/);
  assert.equal(files[1].csv, 't_ms,yaw,pitch,roll,face_found\n0,3,2,1,1\n34,,,,0\n');
  assert.equal(files[0].csv.split('\n')[0], rawCoordinateColumns.hand.join(','));
  assert.ok(files[0].csv.split('\n').slice(1, -1).every(row => row.split(',').length === rawCoordinateColumns.hand.length));
  recorder.Reset();
  assert.deepEqual(recorder.Files(), []);
});

test('pose keeps only two hands and four body points; tongue encodes reviewed direction labels', () => {
  const recorder = CreateRawCoordinateRecorder(['pose', 'tongue']);
  recorder.Record('pose', frame({ timestamp: 500, hands: [points, points], pose: points.slice(0, 4), videoWidth: 1920 }));
  for (const [index, label] of ['Rest', 'Tongue_Left', 'Tongue_Right', 'private'].entries()) {
    recorder.Record('tongue', frame({ timestamp: 500 + index * 40, mouth: { x: 0.5, y: 0.64 }, label, confidence: 0.9 }));
  }
  const files = recorder.Files();
  assert.equal(files[0].csv.split('\n')[1].split(',').length, rawCoordinateColumns.pose.length);
  assert.equal(files[1].csv, 't_ms,mouth_x,mouth_y,direction,confidence\n0,0.5,0.64,0,0.9\n40,0.5,0.64,-1,0.9\n80,0.5,0.64,1,0.9\n120,0.5,0.64,,0.9\n');
});

test('prototype names cannot turn a direction into text, and reset preserves the byte ceiling', () => {
  const recorder = CreateRawCoordinateRecorder(['tongue']);
  recorder.Record('tongue', frame({ timestamp: 0, mouth: null, label: '__proto__', confidence: 0 }));
  assert.equal(recorder.Files()[0].csv, 't_ms,mouth_x,mouth_y,direction,confidence\n0,,,,0\n');
  recorder.Reset();
  recorder.Record('tongue', frame({ timestamp: 0, label: 'constructor', confidence: 0 }));
  assert.equal(recorder.Files()[0].csv, 't_ms,mouth_x,mouth_y,direction,confidence\n0,,,,0\n');
});

test('timestamps that would overflow the relative clock do not create non-finite cells', () => {
  const recorder = CreateRawCoordinateRecorder(['head']);
  recorder.Record('head', frame({ timestamp: 0, face: false }));
  recorder.Record('head', frame({ timestamp: Number.MAX_VALUE, face: false }));
  assert.equal(recorder.Files()[0].rows, 1);
  assert.doesNotMatch(recorder.Files()[0].csv, /Infinity|NaN/);
});

test('row and byte limits truncate safely and snapshots remain stable for retries', () => {
  const recorder = CreateRawCoordinateRecorder(['head', 'hand']);
  const hugePoints = points.map(() => ({ x: Number.MAX_VALUE, y: -Number.MAX_VALUE, z: Number.MIN_VALUE }));
  for (let index = 0; index < 36002; index++) {
    recorder.Record('head', frame({ timestamp: index * 34, face: true, yaw: 1, pitch: 2, roll: 3 }));
    recorder.Record('hand', frame({ timestamp: index * 34, landmarks: hugePoints }));
  }
  const files = recorder.Files();
  for (const file of files) {
    assert.ok(file.rows <= 36000);
    assert.ok(Buffer.byteLength(file.csv) <= 20 * 1024 * 1024);
    assert.equal(file.truncated, true);
  }
  assert.deepEqual(recorder.Files(), files);
});
