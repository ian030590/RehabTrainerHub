import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { CreateSensorInputHost } from '../packages/ui/src/sensorInputHost.js';

const root = resolve(import.meta.dirname, '..');

function Fixture(inputs) {
  const posted = [];
  const brokers = {};
  const fullscreen = [];
  const preview = { hidden: true, style: {} };
  const shell = { requestFullscreen: async () => { fullscreen.push('enter'); page.fullscreenElement = shell; } };
  const page = { fullscreenElement: null, exitFullscreen: async () => { fullscreen.push('exit'); page.fullscreenElement = null; } };
  const host = CreateSensorInputHost({
    inputs, preview, shell, page,
    post: message => posted.push(message),
    createBroker: (input, send) => {
      brokers[input] = { send, starts: [], stops: 0, captures: [],
        Start(value) { this.starts.push(value); }, Stop() { this.stops++; }, Capture(...args) { this.captures.push(args); } };
      return brokers[input];
    },
  });
  return { host, posted, brokers, fullscreen, preview, shell, page };
}

test('the Hub routes each sensor request to its own proxy and numbers all replies on one sequence', () => {
  const { host, posted, brokers } = Fixture(['pose', 'microphone']);
  assert.equal(host.Handle({ type: 'input-start', payload: { input: 'microphone' } }), true);
  assert.deepEqual(brokers.microphone.starts, ['microphone']);
  assert.equal(brokers.pose.stops, 1, 'Starting one input stops the other.');
  assert.equal(host.Handle({ type: 'input-start', payload: { input: 'tongue' } }), false, 'An input the release did not declare is ignored.');
  assert.equal(host.Handle({ type: 'input-start', payload: { hand: 'left' } }), false, 'Hand input stays with the hand broker.');
  brokers.pose.send({ type: 'ready', payload: {} });
  brokers.microphone.send({ type: 'frame', payload: { timestamp: 1, rms: 0, highRatio: 0 } });
  assert.deepEqual(posted.map(message => [message.schema, message.sequence, message.type]),
    [['trainerhub.input/v1', 0, 'ready'], ['trainerhub.input/v1', 1, 'frame']]);
  host.Handle({ type: 'input-stop', payload: {} });
  assert.equal(brokers.microphone.stops, 1);
  host.Stop();
  assert.deepEqual([brokers.pose.stops, brokers.microphone.stops], [3, 2]);
});

test('the Hub places its own camera image where the game asks and enters fullscreen on its frame', async () => {
  const { host, preview, fullscreen, posted, brokers, page } = Fixture(['tongue']);
  host.Handle({ type: 'input-preview', payload: { visible: true, x: 0.07, y: 0, width: 0.29, height: 1 } });
  assert.equal(preview.hidden, false);
  assert.deepEqual([preview.style.left, preview.style.top, preview.style.width, preview.style.height], ['7%', '0%', '29%', '100%']);
  host.Handle({ type: 'input-preview', payload: { visible: false, x: 0, y: 0, width: 0, height: 0 } });
  assert.equal(preview.hidden, true);
  host.Handle({ type: 'input-capture', payload: { label: 'Tongue_Left', active: true } });
  assert.deepEqual(brokers.tongue.captures, [['Tongue_Left', true]]);
  host.Handle({ type: 'fullscreen-request', payload: {} });
  await new Promise(done => setImmediate(done));
  host.Handle({ type: 'fullscreen-request', payload: {} });
  assert.deepEqual(fullscreen, ['enter'], 'A second request while fullscreen does nothing.');
  host.FullscreenChanged();
  host.Handle({ type: 'fullscreen-exit', payload: {} });
  await new Promise(done => setImmediate(done));
  host.FullscreenChanged();
  assert.deepEqual(fullscreen, ['enter', 'exit']);
  assert.deepEqual(posted.map(message => [message.type, message.active]), [['fullscreen', true], ['fullscreen', false]]);
  assert.ok(posted.every(message => message.schema === 'trainerhub.game/v1'));
  page.fullscreenElement = {};
  host.Handle({ type: 'fullscreen-exit', payload: {} });
  assert.deepEqual(fullscreen, ['enter', 'exit'], 'The Hub never exits a fullscreen it did not enter.');
});

test('the Hub overlay wires sensor games through the host, consent copy, preview and transparent frame', async () => {
  const overlay = await readFile(resolve(root, 'apps/rehabtrainerhub/app/train/R2GameOverlay.tsx'), 'utf8');
  assert.match(overlay, /CreateSensorInputHost\(/);
  assert.match(overlay, /LoadSensorInput\(release\.origin, input\)/);
  assert.match(overlay, /className="training-input-preview"/);
  assert.match(overlay, /遊戲只收到雙手與髖、膝的座標/);
  assert.match(overlay, /遊戲只收到音量與高低頻比例/);
  assert.match(overlay, /遊戲只收到嘴部位置與舌頭方向/);
  assert.match(overlay, /遊戲只收到頭部轉動角度/);
  assert.match(overlay, /\(\['pose', 'microphone', 'tongue', 'head'\] as const\)\.filter\(input => SensorAllowed\(state, input\)\)/);
  assert.match(overlay, /\(\['pose', 'tongue', 'head'\] as const\)\.some\(input => SensorAllowed/, 'The head game gets the container preview.');
  assert.match(overlay, /sandbox="allow-scripts"/);
  assert.doesNotMatch(overlay, /allow-same-origin/);
  const styles = await readFile(resolve(root, 'apps/rehabtrainerhub/app/globals.css'), 'utf8');
  assert.match(styles, /\.training-input-preview \{/);
  assert.match(styles, /\.embedded-training-frame:fullscreen \{/);
});
