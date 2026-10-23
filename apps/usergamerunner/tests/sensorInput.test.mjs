import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { build } from 'esbuild';
import { AcceptGameMessage } from '../../../packages/ui/src/selfContainedGame.js';
import { CreateSensorInputBroker } from '../../../packages/ui/src/sensorInputBroker.js';
import { HandleRequest } from '../functions/[[path]].js';
import { ValidateRelease } from '../functions/_lib/release.js';

const nonce = 'a'.repeat(64);
function Message(state, type, payload, sequence = 0) {
  return { schema: 'trainerhub.game/v1', gameId: state.gameId, version: state.version, sessionNonce: nonce, sequence, type, payload };
}
const ballState = () => ({ gameId: 'every-ball-response', version: '2.0.0', sessionNonce: nonce, sequence: -1, complete: false,
  capabilities: ['pose-tracking', 'microphone-level', 'settings-storage'] });
const tongueState = () => ({ gameId: 'tongue-catch', version: '2.0.0', sessionNonce: nonce, sequence: -1, complete: false,
  capabilities: ['tongue-tracking', 'settings-storage'] });
const headState = () => ({ gameId: 'seagull-flight', version: '1.0.0', sessionNonce: nonce, sequence: -1, complete: false,
  capabilities: ['head-tracking', 'settings-storage'] });

test('head input belongs to the seagull game and its head-tracking release only', () => {
  assert.equal(AcceptGameMessage(Message(headState(), 'input-start', { input: 'head' }), headState()), true);
  assert.equal(AcceptGameMessage(Message(headState(), 'input-stop', {}), headState()), true);
  assert.equal(AcceptGameMessage(Message(headState(), 'input-preview', { visible: true, x: 0, y: 0, width: 0.6, height: 1 }), headState()), true,
    'The seagull game shows the camera image while it finds the neutral head position.');
  assert.equal(AcceptGameMessage(Message(headState(), 'fullscreen-request', {}), headState()), true);
  for (const state of [{ ...headState(), gameId: 'tongue-catch' }, { ...headState(), gameId: 'oculomotor-training' }, { ...headState(), capabilities: ['settings-storage'] }]) {
    assert.equal(AcceptGameMessage(Message(state, 'input-start', { input: 'head' }), state), false, `${state.gameId} ${state.capabilities}`);
  }
  assert.equal(AcceptGameMessage(Message(headState(), 'input-start', { input: 'tongue' }), headState()), false, 'The seagull game cannot borrow the tongue proxy.');
  assert.equal(AcceptGameMessage(Message(tongueState(), 'input-start', { input: 'head' }), tongueState()), false);
  assert.equal(AcceptGameMessage(Message(headState(), 'input-capture', { label: 'Rest', active: true }), headState()), false,
    'The head proxy keeps no calibration samples.');
  assert.equal(AcceptGameMessage(Message(headState(), 'input-start', { input: 'head' }), { ...headState(), complete: true }), false);
});

// Column-major 4x4 rotation about one axis, as MediaPipe returns facial transformation matrices.
function Rotation(axis, degrees, translation = [0, 0, -40]) {
  const c = Math.cos(degrees * Math.PI / 180);
  const s = Math.sin(degrees * Math.PI / 180);
  const rows = { x: [[1, 0, 0], [0, c, -s], [0, s, c]], y: [[c, 0, s], [0, 1, 0], [-s, 0, c]], z: [[c, -s, 0], [s, c, 0], [0, 0, 1]] }[axis];
  const data = new Array(16).fill(0);
  for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) data[column * 4 + row] = rows[row][column] * 1.3;
  [data[12], data[13], data[14], data[15]] = [...translation, 1];
  return data;
}

test('head proxy turns the face matrix into yaw, pitch and roll and sends nothing else', async () => {
  const { CreateHeadPoseDetector, MatrixToHeadAngles } = await import('../runtime/headPoseDetector.js');
  // Signs follow FlyingMoo: yaw > 0 when the user turns to their own right, pitch > 0 when they look up.
  assert.deepEqual(MatrixToHeadAngles(Rotation('y', 0)), { yaw: 0, pitch: 0, roll: 0 });
  assert.deepEqual(MatrixToHeadAngles(Rotation('y', -20)), { yaw: 20, pitch: 0, roll: 0 });
  assert.deepEqual(MatrixToHeadAngles(Rotation('y', 15)), { yaw: -15, pitch: 0, roll: 0 });
  assert.deepEqual(MatrixToHeadAngles(Rotation('x', -12)), { yaw: 0, pitch: 12, roll: 0 });
  assert.deepEqual(MatrixToHeadAngles(Rotation('z', 8)), { yaw: 0, pitch: 0, roll: 8 });
  const fixture = { result: { faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]], facialTransformationMatrixes: [{ data: Rotation('y', -20.004) }] }, closed: 0 };
  const detector = CreateHeadPoseDetector({ landmarker: { detectForVideo: (video, timestamp) => ({ ...fixture.result, timestamp }), close: () => fixture.closed++ } });
  const video = { videoWidth: 960, videoHeight: 720 };
  assert.deepEqual(detector.Detect(video, 40), { timestamp: 40, videoWidth: 960, videoHeight: 720, face: true, yaw: 20, pitch: 0, roll: 0 });
  fixture.result = { faceLandmarks: [], facialTransformationMatrixes: [] };
  assert.deepEqual(detector.Detect(video, 80), { timestamp: 80, videoWidth: 960, videoHeight: 720, face: false, yaw: null, pitch: null, roll: null });
  fixture.result = { faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]], facialTransformationMatrixes: [{ data: new Array(16).fill(Number.NaN) }] };
  assert.equal(detector.Detect(video, 120).face, false, 'An unreadable matrix counts as no face, not as a turn.');
  detector.Close();
  assert.equal(fixture.closed, 1);
  const { readFile } = await import('node:fs/promises');
  const entry = await readFile(new URL('../runtime/headTrackingEntry.ts', import.meta.url), 'utf8');
  assert.match(entry, /outputFacialTransformationMatrixes: true/);
  assert.match(entry, /modelAssetPath: assetBase \+ 'face_landmarker\.task'/);
  assert.doesNotMatch(entry, /tensorflow|https?:\/\//, 'The head proxy uses only the reviewed face model from the runner.');
});

test('sensor input requests are limited to the reviewed game and capability', () => {
  assert.equal(AcceptGameMessage(Message(ballState(), 'input-start', { input: 'pose' }), ballState()), true);
  assert.equal(AcceptGameMessage(Message(ballState(), 'input-start', { input: 'microphone' }), ballState()), true);
  assert.equal(AcceptGameMessage(Message(tongueState(), 'input-start', { input: 'tongue' }), tongueState()), true);
  for (const payload of [{}, { input: 'tongue' }, { input: 'pose', model: 'https://evil.example/model' }, { input: 'camera' }]) {
    assert.equal(AcceptGameMessage(Message(ballState(), 'input-start', payload), ballState()), false, JSON.stringify(payload));
  }
  assert.equal(AcceptGameMessage(Message(ballState(), 'input-start', { input: 'pose' }), { ...ballState(), capabilities: ['microphone-level'] }), false);
  assert.equal(AcceptGameMessage(Message(ballState(), 'input-start', { input: 'microphone' }), { ...ballState(), capabilities: ['pose-tracking'] }), false);
  const otherGame = { ...ballState(), gameId: 'gesture-battler' };
  assert.equal(AcceptGameMessage(Message(otherGame, 'input-start', { input: 'pose' }), otherGame), false, 'Another game cannot borrow the pose proxy.');
  const otherTongue = { ...tongueState(), gameId: 'every-ball-response' };
  assert.equal(AcceptGameMessage(Message(otherTongue, 'input-start', { input: 'tongue' }), otherTongue), false);
  assert.equal(AcceptGameMessage(Message(ballState(), 'input-start', { input: 'pose' }), { ...ballState(), complete: true }), false,
    'A finished session cannot restart the camera.');
  assert.equal(AcceptGameMessage(Message(ballState(), 'input-stop', {}), ballState()), true);
  assert.equal(AcceptGameMessage(Message(tongueState(), 'input-stop', {}), tongueState()), true);
  assert.equal(AcceptGameMessage(Message(ballState(), 'input-stop', { input: 'pose' }), ballState()), false);
});

test('only camera sensor games place the container preview, inside the game frame', () => {
  const preview = { visible: true, x: 0.6, y: 0.65, width: 0.38, height: 0.33 };
  assert.equal(AcceptGameMessage(Message(ballState(), 'input-preview', preview), ballState()), true);
  assert.equal(AcceptGameMessage(Message(tongueState(), 'input-preview', { visible: false, x: 0, y: 0, width: 0, height: 0 }), tongueState()), true);
  for (const payload of [{ ...preview, x: 0.7 }, { ...preview, y: -0.1 }, { ...preview, width: Number.NaN }, { ...preview, visible: 'yes' },
    { ...preview, opacity: 0.5 }, { visible: true, x: 0, y: 0, width: 1 }]) {
    assert.equal(AcceptGameMessage(Message(ballState(), 'input-preview', payload), ballState()), false, JSON.stringify(payload));
  }
  assert.equal(AcceptGameMessage(Message(ballState(), 'input-preview', preview), { ...ballState(), capabilities: ['microphone-level'] }), false,
    'A microphone-only session has no camera image to place.');
  const hand = { ...ballState(), gameId: 'gesture-battler', capabilities: ['hand-tracking'] };
  assert.equal(AcceptGameMessage(Message(hand, 'input-preview', preview), hand), false);
});

test('tongue calibration captures only fixed labels and only for the tongue game', () => {
  for (const label of ['Rest', 'Tongue_Left', 'Tongue_Right']) {
    assert.equal(AcceptGameMessage(Message(tongueState(), 'input-capture', { label, active: true }), tongueState()), true, label);
  }
  assert.equal(AcceptGameMessage(Message(tongueState(), 'input-capture', { label: 'Rest', active: false }), tongueState()), true);
  for (const payload of [{ label: 'Smile', active: true }, { label: 'Rest' }, { label: 'Rest', active: 1 }, { label: 'Rest', active: true, samples: [] }]) {
    assert.equal(AcceptGameMessage(Message(tongueState(), 'input-capture', payload), tongueState()), false, JSON.stringify(payload));
  }
  assert.equal(AcceptGameMessage(Message(ballState(), 'input-capture', { label: 'Rest', active: true }), ballState()), false);
  assert.equal(AcceptGameMessage(Message(tongueState(), 'input-capture', { label: 'Rest', active: true }), { ...tongueState(), complete: true }), false);
});

test('camera sensor games ask the container for fullscreen so the preview stays visible', () => {
  assert.equal(AcceptGameMessage(Message(ballState(), 'fullscreen-request', {}), ballState()), true);
  assert.equal(AcceptGameMessage(Message(tongueState(), 'fullscreen-exit', {}), tongueState()), true);
  assert.equal(AcceptGameMessage(Message(ballState(), 'fullscreen-exit', {}), { ...ballState(), complete: true }), true,
    'The results page can still leave fullscreen.');
  assert.equal(AcceptGameMessage(Message(ballState(), 'fullscreen-request', { element: 'body' }), ballState()), false);
  const plain = { ...ballState(), gameId: 'ufov', capabilities: ['settings-storage'] };
  assert.equal(AcceptGameMessage(Message(plain, 'fullscreen-request', {}), plain), false, 'Other games keep using their own fullscreen.');
});

test('sensor broker asks consent per input, passes only the chosen input and discards late controllers', async () => {
  let resolveConsent;
  let resolveController;
  const consents = [];
  const created = [];
  const messages = [];
  let stops = 0;
  const broker = CreateSensorInputBroker({
    requestConsent: input => { consents.push(input); return new Promise(done => { resolveConsent = done; }); },
    cancelConsent: () => resolveConsent?.(false),
    createController: input => { created.push(input); return new Promise(done => { resolveController = done; }); },
    send: message => messages.push(message),
  });
  const cancelled = broker.Start('pose');
  await broker.Start('pose');
  assert.deepEqual(consents, ['pose'], 'Repeated starts do not reopen the consent dialog.');
  broker.Stop();
  await cancelled;
  assert.deepEqual(messages, []);
  const late = broker.Start('pose');
  resolveConsent(true);
  await new Promise(done => setImmediate(done));
  broker.Stop();
  resolveController({ Start: async () => assert.fail('A stopped session never starts its camera'), Stop: () => stops++ });
  await late;
  assert.equal(stops, 1, 'The controller that loaded after exit is closed.');
  const declined = broker.Start('microphone');
  resolveConsent(false);
  await declined;
  assert.deepEqual(messages, [{ type: 'error', payload: { reason: 'permission' } }], 'The container adds schema, nonce and sequence.');
  assert.deepEqual(consents, ['pose', 'pose', 'microphone']);
  assert.deepEqual(created, ['pose']);
});

test('sensor broker reports ready, forwards frames and tongue captures, and switches inputs cleanly', async () => {
  const messages = [];
  const events = [];
  let frame;
  const broker = CreateSensorInputBroker({
    requestConsent: async () => true, cancelConsent() {}, send: message => messages.push(message),
    createController: async input => ({
      Start: async (onFrame) => { events.push(`start:${input}`); frame = onFrame; return true; },
      Stop: () => events.push(`stop:${input}`),
      Capture: (label, active) => events.push(`capture:${label}:${active}`),
    }),
  });
  await broker.Start('tongue');
  frame({ timestamp: 1 });
  broker.Capture('Tongue_Left', true);
  await broker.Start('pose');
  assert.deepEqual(events, ['start:tongue', 'capture:Tongue_Left:true', 'stop:tongue', 'start:pose']);
  assert.deepEqual(messages.map(message => message.type), ['ready', 'frame', 'ready']);
  broker.Stop();
  assert.deepEqual(events.at(-1), 'stop:pose');
});

function CameraFixture() {
  const callbacks = new Map();
  const events = new Map();
  const fixture = { callbacks, events, trackStops: 0, removed: 0, closed: 0 };
  const track = { stop: () => fixture.trackStops++, addEventListener: (type, listener) => events.set(type, listener) };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const video = { readyState: 2, currentTime: 1, videoWidth: 960, videoHeight: 720, srcObject: null, play: async () => {}, pause() {}, remove: () => fixture.removed++ };
  const detector = { Detect: (_video, timestamp) => ({ timestamp }), Close: () => fixture.closed++ };
  let nextId = 0;
  Object.assign(fixture, { stream, video, detector,
    constraints: null,
    environment: {
      getUserMedia: async constraints => { fixture.constraints = constraints; return stream; },
      createVideo: () => video,
      requestFrame: callback => { callbacks.set(++nextId, callback); return nextId; },
      cancelFrame: id => callbacks.delete(id),
    },
    Tick: timestamp => { const [id, callback] = [...callbacks][0]; callbacks.delete(id); callback(timestamp); },
  });
  return fixture;
}

test('camera input proxy throttles detection, stops camera, model and timers, and never sends video', async () => {
  const { CreateCameraInputController } = await import('../runtime/cameraInputController.js');
  const fixture = CameraFixture();
  const frames = [];
  const proxy = CreateCameraInputController(fixture.environment, { intervalMs: 70, createDetector: async () => fixture.detector });
  assert.equal(await proxy.Start(frame => frames.push(frame), assert.fail), true);
  assert.equal(fixture.constraints.audio, false, 'The camera proxy never opens the microphone.');
  fixture.Tick(100);
  fixture.video.currentTime++;
  fixture.Tick(140);
  fixture.Tick(200);
  assert.deepEqual(frames, [{ timestamp: 100 }, { timestamp: 200 }], 'Detection waits for a new video frame and the 70 ms interval.');
  assert.equal(fixture.video.srcObject, fixture.stream);
  proxy.Stop();
  assert.equal(fixture.trackStops, 1);
  assert.equal(fixture.closed, 1);
  assert.equal(fixture.removed, 1, 'The preview video leaves the container.');
  assert.equal(fixture.video.srcObject, null);
  assert.equal(fixture.callbacks.size, 0);
});

test('camera input proxy disposes late initialization and reports retryable errors', async () => {
  const { CreateCameraInputController } = await import('../runtime/cameraInputController.js');
  for (const stage of ['camera', 'model']) {
    const fixture = CameraFixture();
    let finish;
    const pending = new Promise(done => { finish = done; });
    if (stage === 'camera') fixture.environment.getUserMedia = () => pending;
    const proxy = CreateCameraInputController(fixture.environment, { intervalMs: 70,
      createDetector: stage === 'model' ? () => pending : async () => fixture.detector });
    const start = proxy.Start(() => assert.fail('No frame after exit'), () => assert.fail('No stale error'));
    await new Promise(done => setImmediate(done));
    proxy.Stop();
    finish(stage === 'camera' ? fixture.stream : fixture.detector);
    assert.equal(await start, false);
    assert.equal(fixture.trackStops, 1, stage);
    assert.equal(fixture.closed, stage === 'model' ? 1 : 0, stage);
    assert.equal(fixture.callbacks.size, 0);
  }
  for (const reason of ['permission', 'unsupported', 'disconnected', 'initialization']) {
    const fixture = CameraFixture();
    const errors = [];
    if (reason === 'permission') fixture.environment.getUserMedia = async () => { throw Object.assign(new Error('Denied'), { name: 'NotAllowedError' }); };
    if (reason === 'unsupported') fixture.environment.getUserMedia = undefined;
    const proxy = CreateCameraInputController(fixture.environment, { intervalMs: 70, createDetector: async () => fixture.detector });
    await proxy.Start(() => {}, error => errors.push(error));
    if (reason === 'disconnected') fixture.events.get('ended')();
    if (reason === 'initialization') { fixture.detector.Detect = () => { throw new Error('Inference failed'); }; fixture.Tick(100); }
    assert.deepEqual(errors, [reason]);
    assert.equal(fixture.callbacks.size, 0, reason);
  }
});

test('camera input proxy skips a tick while an earlier classification is still running', async () => {
  const { CreateCameraInputController } = await import('../runtime/cameraInputController.js');
  const fixture = CameraFixture();
  const frames = [];
  let release;
  let calls = 0;
  fixture.detector.Detect = (_video, timestamp) => { calls++; return new Promise(done => { release = () => done({ timestamp }); }); };
  const proxy = CreateCameraInputController(fixture.environment, { intervalMs: 70, createDetector: async () => fixture.detector });
  await proxy.Start(frame => frames.push(frame), assert.fail);
  fixture.Tick(100);
  fixture.video.currentTime++;
  fixture.Tick(200);
  assert.equal(calls, 1);
  release();
  await new Promise(done => setImmediate(done));
  assert.deepEqual(frames, [{ timestamp: 100 }]);
  fixture.Tick(300);
  assert.equal(calls, 2);
  proxy.Stop();
  release();
  await new Promise(done => setImmediate(done));
  assert.equal(frames.length, 1, 'A classification that finishes after exit is dropped.');
});

const Point = (x, y, z = 0) => ({ x, y, z, visibility: 0.9, presence: 0.8 });

test('pose proxy sends two hands and the four hip and knee points as xyz only', async () => {
  const { CreatePoseDetector } = await import('../runtime/poseDetector.js');
  const hand = Array.from({ length: 21 }, (_, index) => Point(index / 40, 0.5));
  const pose = Array.from({ length: 33 }, (_, index) => Point(index / 50, index / 40));
  let closed = 0;
  const detector = CreatePoseDetector({
    handLandmarker: { detectForVideo: () => ({ landmarks: [hand, hand, hand] }), close: () => closed++ },
    poseLandmarker: { detectForVideo: () => ({ landmarks: [pose] }), close: () => closed++ },
  });
  const frame = detector.Detect({ videoWidth: 960, videoHeight: 720 }, 120);
  assert.deepEqual(Object.keys(frame), ['timestamp', 'videoWidth', 'videoHeight', 'hands', 'pose']);
  assert.equal(frame.hands.length, 2);
  assert.deepEqual(frame.hands[0][3], { x: 3 / 40, y: 0.5, z: 0 });
  assert.deepEqual(frame.pose, [23, 24, 25, 26].map(index => ({ x: index / 50, y: index / 40, z: 0 })));
  const empty = CreatePoseDetector({
    handLandmarker: { detectForVideo: () => ({ landmarks: [] }), close() {} },
    poseLandmarker: { detectForVideo: () => ({ landmarks: [] }), close() {} },
  }).Detect({ videoWidth: 960, videoHeight: 720 }, 200);
  assert.deepEqual([empty.hands, empty.pose], [[], []]);
  const invalid = CreatePoseDetector({
    handLandmarker: { detectForVideo: () => ({ landmarks: [hand.slice(0, 20)] }), close() {} },
    poseLandmarker: { detectForVideo: () => ({ landmarks: [] }), close() {} },
  });
  assert.throws(() => invalid.Detect({ videoWidth: 960, videoHeight: 720 }, 300));
  detector.Close();
  assert.equal(closed, 2);
});

function TongueFixture() {
  const counts = {};
  const fixture = { added: [], cleared: [], disposed: 0, predictions: 0, closed: 0, face: true };
  const lips = [0, 1, 2, 3];
  const landmarks = [Point(0.25, 0.5), Point(0.75, 0.5), Point(0.5, 0.25), Point(0.5, 0.75)];
  fixture.classifier = {
    addExample: (feature, label) => { fixture.added.push(label); counts[label] = (counts[label] ?? 0) + 1; },
    clearClass: label => { fixture.cleared.push(label); delete counts[label]; },
    getClassExampleCount: () => ({ ...counts }),
    predictClass: async () => { fixture.predictions++; return { label: 'Tongue_Right', confidences: { Rest: 0, Tongue_Left: 1 / 3, Tongue_Right: 2 / 3 } }; },
    dispose: () => fixture.closed++,
  };
  fixture.options = {
    landmarker: { detectForVideo: () => ({ faceLandmarks: fixture.face ? [landmarks] : [] }), close: () => fixture.closed++ },
    lipIndices: lips,
    extractFeature: () => ({ dispose: () => fixture.disposed++ }),
    classifier: fixture.classifier,
  };
  return fixture;
}

test('tongue proxy keeps calibration samples to itself and sends only mouth, label and confidence', async () => {
  const { CreateTongueDetector } = await import('../runtime/tongueDetector.js');
  const fixture = TongueFixture();
  const detector = CreateTongueDetector(fixture.options);
  const video = { videoWidth: 960, videoHeight: 720 };
  const idle = await detector.Detect(video, 10);
  assert.deepEqual(idle, { timestamp: 10, videoWidth: 960, videoHeight: 720, face: true, mouth: { x: 0.5, y: 0.5 }, label: null, confidence: 0,
    samples: { Rest: 0, Tongue_Left: 0, Tongue_Right: 0 } });
  assert.equal(fixture.predictions, 0, 'No prediction before all three directions are calibrated.');
  for (const label of ['Rest', 'Tongue_Left', 'Tongue_Right']) {
    detector.Capture(label, true);
    await detector.Detect(video, 20);
    const frame = await detector.Detect(video, 30);
    assert.equal(frame.samples[label], 2, label);
    assert.equal(frame.label, null, 'Captured frames are not classified.');
    detector.Capture(label, false);
  }
  detector.Capture('Rest', true);
  assert.deepEqual(fixture.cleared, ['Rest'], 'A new capture replaces the earlier samples of that direction.');
  assert.equal((await detector.Detect(video, 40)).samples.Rest, 1);
  detector.Capture('Rest', false);
  const predicted = await detector.Detect(video, 50);
  assert.deepEqual([predicted.label, predicted.confidence], ['Tongue_Right', 2 / 3]);
  assert.equal(fixture.disposed, 9, 'Every extracted mouth image is released.');
  fixture.face = false;
  assert.deepEqual(await detector.Detect(video, 60), { timestamp: 60, videoWidth: 960, videoHeight: 720, face: false, mouth: null, label: null, confidence: 0,
    samples: { Rest: 1, Tongue_Left: 2, Tongue_Right: 2 } });
  detector.Close();
  assert.equal(fixture.closed, 2);
});

test('microphone proxy sends only level and spectrum balance and closes the audio device', async () => {
  const { CreateMicrophoneController } = await import('../runtime/microphoneController.js');
  const callbacks = new Map();
  let constraints;
  let trackStops = 0;
  let closed = 0;
  let ended;
  const analyser = { fftSize: 0, frequencyBinCount: 4, smoothingTimeConstant: 0, disconnect() {},
    getFloatTimeDomainData: samples => samples.fill(0.5),
    getByteFrequencyData: samples => samples.set([10, 10, 30, 50]) };
  const source = { connect: target => assert.equal(target, analyser), disconnect() {} };
  const context = { state: 'running', resume: async () => {}, close: async () => { closed++; context.state = 'closed'; },
    createMediaStreamSource: () => source, createAnalyser: () => analyser };
  const track = { stop: () => trackStops++, addEventListener: (type, listener) => { if (type === 'ended') ended = listener; } };
  let nextId = 0;
  const environment = {
    getUserMedia: async value => { constraints = value; return { getTracks: () => [track], getAudioTracks: () => [track] }; },
    createAudioContext: () => context,
    requestFrame: callback => { callbacks.set(++nextId, callback); return nextId; },
    cancelFrame: id => callbacks.delete(id),
  };
  const frames = [];
  const errors = [];
  const proxy = CreateMicrophoneController(environment);
  assert.equal(await proxy.Start(frame => frames.push(frame), error => errors.push(error)), true);
  assert.deepEqual(constraints, { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
  assert.equal(analyser.fftSize, 1024);
  assert.equal(analyser.smoothingTimeConstant, 0.45);
  const [id, callback] = [...callbacks][0];
  callbacks.delete(id);
  callback(250);
  assert.deepEqual(frames, [{ timestamp: 250, rms: 0.5, highRatio: 90 / 100 }], 'The split sits at 38% of the bins, as in the original game.');
  ended();
  assert.deepEqual(errors, ['disconnected']);
  assert.equal(trackStops, 1);
  await new Promise(done => setImmediate(done));
  assert.equal(closed, 1);
  assert.equal(callbacks.size, 0);
  const unsupported = CreateMicrophoneController({ ...environment, createAudioContext: () => null });
  const reasons = [];
  assert.equal(await unsupported.Start(() => {}, reason => reasons.push(reason)), false);
  assert.deepEqual(reasons, ['unsupported']);
});

function Release(gameId, capabilities) {
  const bytes = Buffer.from('<!doctype html><title>Sensor</title>');
  const files = [{ path: 'index.html', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }];
  return { bytes, release: { schemaVersion: 1, status: 'approved', gameId, version: '2.0.0', name: 'Sensor game', entry: 'index.html',
    runtime: { name: 'native', major: 1 }, presentation: 'game', capabilities, files,
    contentSha256: createHash('sha256').update(JSON.stringify(files)).digest('hex') } };
}

test('sensor capabilities validate only for their official games', () => {
  const Validate = release => ValidateRelease(release, release.gameId, release.version);
  assert.doesNotThrow(() => Validate(Release('every-ball-response', ['pose-tracking', 'microphone-level']).release));
  assert.doesNotThrow(() => Validate(Release('tongue-catch', ['tongue-tracking']).release));
  assert.doesNotThrow(() => Validate(Release('seagull-flight', ['head-tracking']).release));
  for (const [gameId, capability] of [['gesture-battler', 'pose-tracking'], ['ufov', 'microphone-level'], ['every-ball-response', 'tongue-tracking'],
    ['tongue-catch', 'head-tracking'], ['oculomotor-training', 'head-tracking'], ['seagull-flight', 'tongue-tracking']]) {
    assert.throws(() => Validate(Release(gameId, [capability]).release), /restricted/, `${gameId} ${capability}`);
  }
  const { presentation, ...embed } = Release('tongue-catch', ['tongue-tracking']).release;
  assert.equal(presentation, 'game');
  assert.throws(() => Validate(embed), /restricted/, 'An embedded third-party presentation cannot use the tongue proxy.');
});

async function Serve(gameId, capabilities, official = true) {
  const { bytes, release } = Release(gameId, capabilities);
  const catalog = { schemaVersion: 1, gameId, currentVersion: release.version, releases: { [release.version]: { contentSha256: release.contentSha256 } } };
  const bucket = { get: async key => {
    const source = key.startsWith('official-games/') ? (official ? JSON.stringify(catalog) : null)
      : key.endsWith('/release.json') ? JSON.stringify(release) : null;
    if (source) return { size: Buffer.byteLength(source), text: async () => source };
    if (key.endsWith('/files/index.html')) return { size: bytes.length, body: bytes,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    return null;
  } };
  return path => HandleRequest({ request: new Request(`https://runner.example/games/${gameId}/2.0.0/${path}`), env: { GAME_RELEASE_BUCKET: bucket } });
}

test('trusted sensor launchers get exactly the devices they declare; game packages stay closed', async () => {
  const ball = await Serve('every-ball-response', ['pose-tracking', 'microphone-level', 'settings-storage']);
  const launcher = await ball('');
  assert.equal(launcher.status, 200);
  assert.match(launcher.headers.get('permissions-policy'), /camera=\(self\)/);
  assert.match(launcher.headers.get('permissions-policy'), /microphone=\(self\)/);
  assert.match(launcher.headers.get('content-security-policy'), /script-src 'nonce-[^']+' 'self' 'wasm-unsafe-eval'/);
  assert.doesNotMatch(launcher.headers.get('content-security-policy'), /'unsafe-eval'/);
  const html = await launcher.text();
  assert.match(html, /src="\/input\/pose-tracking-1\.0\.0\/index\.js"/);
  assert.match(html, /src="\/input\/microphone-1\.0\.0\/index\.js"/);
  assert.match(html, /sandbox="allow-scripts"/);
  assert.doesNotMatch(html, /allow-same-origin|allow="[^"]*(camera|microphone)/);
  const game = await ball('package/index.html');
  assert.match(game.headers.get('permissions-policy'), /camera=\(\)/);
  assert.match(game.headers.get('permissions-policy'), /microphone=\(\)/);
  assert.match(game.headers.get('content-security-policy'), /connect-src 'none'/);
  const worker = await (await ball('sw.js')).text();
  for (const path of ['/input/pose-tracking-1.0.0/index.js', '/input/pose-tracking-1.0.0/hand_landmarker.task',
    '/input/pose-tracking-1.0.0/pose_landmarker_lite.task', '/input/pose-tracking-1.0.0/wasm/vision_wasm_internal.wasm', '/input/microphone-1.0.0/index.js']) {
    assert.ok(worker.includes(JSON.stringify(path).slice(1, -1)), `The PWA works offline with ${path}`);
  }

  const tongue = await Serve('tongue-catch', ['tongue-tracking', 'settings-storage']);
  const tongueLauncher = await tongue('');
  assert.match(tongueLauncher.headers.get('permissions-policy'), /camera=\(self\)/);
  assert.match(tongueLauncher.headers.get('permissions-policy'), /microphone=\(\)/, 'The tongue game never gets the microphone.');
  assert.match(await tongueLauncher.text(), /src="\/input\/tongue-tracking-1\.0\.0\/index\.js"/);
  assert.match(await (await tongue('sw.js')).text(), /\/input\/tongue-tracking-1\.0\.0\/face_landmarker\.task/);

  const head = await Serve('seagull-flight', ['head-tracking', 'settings-storage']);
  const headLauncher = await head('');
  assert.match(headLauncher.headers.get('permissions-policy'), /camera=\(self\)/);
  assert.match(headLauncher.headers.get('permissions-policy'), /microphone=\(\)/, 'The seagull game never gets the microphone.');
  assert.match(headLauncher.headers.get('content-security-policy'), /script-src 'nonce-[^']+' 'self' 'wasm-unsafe-eval'/);
  const headHtml = await headLauncher.text();
  assert.match(headHtml, /src="\/input\/head-tracking-1\.0\.0\/index\.js"/);
  assert.match(headHtml, /<div id="input-preview"[^>]*hidden/);
  assert.match(headHtml, /遊戲只收到頭部轉動角度/);
  const headWorker = await (await head('sw.js')).text();
  for (const path of ['/input/head-tracking-1.0.0/index.js', '/input/head-tracking-1.0.0/face_landmarker.task', '/input/head-tracking-1.0.0/wasm/vision_wasm_internal.wasm']) {
    assert.ok(headWorker.includes(path), `The seagull PWA works offline with ${path}`);
  }

  const unofficial = await Serve('tongue-catch', ['tongue-tracking'], false);
  assert.equal((await unofficial('')).status, 404, 'A release missing from the official catalog gets no device access.');
});

test('production-bundled sensor launcher wires preview and fullscreen without opening a device on load', async () => {
  const output = await build({ entryPoints: [resolve(import.meta.dirname, '../functions/_lib/handTrackingLauncher.js')],
    bundle: true, keepNames: true, format: 'esm', platform: 'neutral', write: false });
  const { RenderHandTrackingLauncher } = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'));
  const html = RenderHandTrackingLauncher({ gameId: 'every-ball-response', version: '2.0.0', capabilities: ['pose-tracking', 'microphone-level', 'settings-storage'] },
    '/games/every-ball-response/2.0.0/', 'test-nonce');
  assert.match(html, /<div id="input-preview"[^>]*hidden/);
  const inline = html.match(/<script nonce="test-nonce">([\s\S]*?)<\/script>/)[1];
  const Element = () => ({ hidden: true, style: {}, addEventListener(type, listener) { this[type] = listener; }, focus() {} });
  const elements = new Map(['game-frame', 'game-shell', 'input-preview', 'camera-consent', 'camera-consent-title', 'camera-consent-text', 'camera-enable', 'camera-cancel', 'install-button']
    .map(id => [id, Element()]));
  const frame = elements.get('game-frame');
  frame.contentWindow = { postMessage: (message, origin, ports) => { frame.init = { message, ports }; } };
  let ready;
  const brokers = [];
  const posted = [];
  const fullscreen = [];
  elements.get('game-shell').requestFullscreen = async () => fullscreen.push('enter');
  const channels = [];
  class Channel { constructor() { channels.push(this); this.port1 = { postMessage: message => posted.push(message), start() {}, close() {} }; this.port2 = {}; } }
  const document = { addEventListener: (type, listener) => { if (type === 'DOMContentLoaded') ready = listener; }, getElementById: id => elements.get(id),
    fullscreenElement: null, exitFullscreen: async () => fullscreen.push('exit') };
  const Broker = name => options => { const broker = { name, options, starts: [], Start(...args) { broker.starts.push(args); }, Stop() {}, Capture() {} }; brokers.push(broker); return broker; };
  const context = {
    document, MessageChannel: Channel, crypto, Uint8Array, URLSearchParams, location: { search: '' },
    TrainerHubPoseTracking: { CreateBroker: Broker('pose') }, TrainerHubMicrophone: { CreateBroker: Broker('microphone') },
    navigator: {}, window: { addEventListener() {} }, setInterval: () => 0,
  };
  runInNewContext(inline, context);
  // Messages arrive as structured clones in the launcher's own realm.
  const Local = value => runInNewContext('JSON', context).parse(JSON.stringify(value));
  ready();
  assert.deepEqual(brokers.map(broker => broker.name), ['pose', 'microphone']);
  assert.equal(brokers[0].options.previewHost, elements.get('input-preview'), 'Only the camera proxy draws into the container preview.');
  assert.equal(brokers.every(broker => broker.starts.length === 0), true, 'Opening the launcher does not start a device.');
  frame.load();
  assert.equal(frame.init.message.gameId, 'every-ball-response');
  const port = channels[0].port1;
  const Send = (sequence, type, payload) => port.onmessage({ data: Local({ schema: 'trainerhub.game/v1', gameId: 'every-ball-response', version: '2.0.0',
    sessionNonce: frame.init.message.sessionNonce, sequence, type, payload }) });
  Send(0, 'fullscreen-request', {});
  assert.deepEqual(fullscreen, ['enter'], 'The container, not the game frame, enters fullscreen.');
  Send(1, 'input-preview', { visible: true, x: 0.6, y: 0.65, width: 0.38, height: 0.33 });
  const preview = elements.get('input-preview');
  assert.equal(preview.hidden, false);
  assert.deepEqual([preview.style.left, preview.style.top, preview.style.width, preview.style.height], ['60%', '65%', '38%', '33%']);
  Send(2, 'input-start', { input: 'microphone' });
  assert.deepEqual(brokers[1].starts, [['microphone']]);
  assert.deepEqual(brokers[0].starts, []);
  Send(3, 'input-preview', { visible: true, x: 0.7, y: 0, width: 0.5, height: 1 });
  assert.equal(preview.style.left, '60%', 'An out-of-frame preview request is ignored.');
  brokers[0].options.send({ type: 'ready', payload: {} });
  brokers[1].options.send({ type: 'frame', payload: { timestamp: 1, rms: 0, highRatio: 0 } });
  const input = posted.filter(message => message.schema === 'trainerhub.input/v1');
  assert.deepEqual(input.map(message => message.sequence), [0, 1], 'Both proxies share one increasing input sequence.');
  assert.ok(input.every(message => message.sessionNonce === frame.init.message.sessionNonce));
});

test('sensor proxy files are immutable, CORS-readable static assets with a WASM type', async () => {
  const { readFile } = await import('node:fs/promises');
  const headers = (await readFile(new URL('../public/_headers', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
  const Block = pattern => headers.split('\n\n').find(block => block.split('\n')[0] === pattern) ?? '';
  for (const directory of ['pose-tracking-1.0.0', 'tongue-tracking-1.0.0', 'head-tracking-1.0.0', 'microphone-1.0.0']) {
    const block = Block(`/input/${directory}/*`);
    assert.match(block, /Access-Control-Allow-Origin: \*/, directory);
    assert.match(block, /Cross-Origin-Resource-Policy: cross-origin/, directory);
    assert.match(block, /Cache-Control: public, max-age=31536000, immutable/, directory);
  }
  for (const directory of ['pose-tracking-1.0.0', 'tongue-tracking-1.0.0', 'head-tracking-1.0.0']) {
    assert.match(Block(`/input/${directory}/wasm/*.wasm`), /Content-Type: application\/wasm/, directory);
  }
});
