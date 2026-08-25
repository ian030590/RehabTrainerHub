import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CreateTrainerHubGameBridge,
  NormalizeAggregateResult,
} from './index.js';

const maximumResultDurationMs = 86_400_000;
const maximumResultPayloadBytes = 16_000;
const maximumResultTrialCount = 100_000;
const textEncoder = new TextEncoder();

test('normalizes bounded aggregate results', () => {
  assert.deepEqual(NormalizeAggregateResult({
    score: 8,
    durationMs: 1200,
    trialCount: 10,
    metrics: { accuracy: 0.8, usedHint: false },
  }, 'completed'), {
    status: 'completed',
    score: 8,
    durationMs: 1200,
    trialCount: 10,
    metrics: { accuracy: 0.8, usedHint: false },
  });
});

test('rejects identifying and free-text result fields', () => {
  assert.throws(() => NormalizeAggregateResult({ metrics: { userName: 1 } }, 'completed'));
  assert.throws(() => NormalizeAggregateResult({ notes: 'raw trial data' }, 'completed'));
});

test('matches the game-runs API numeric and request-envelope byte limits', () => {
  assert.deepEqual(NormalizeAggregateResult({
    durationMs: maximumResultDurationMs,
    trialCount: maximumResultTrialCount,
  }, 'completed'), {
    status: 'completed',
    durationMs: maximumResultDurationMs,
    trialCount: maximumResultTrialCount,
  });
  assert.throws(() => NormalizeAggregateResult({ durationMs: maximumResultDurationMs + 1 }, 'completed'));
  assert.throws(() => NormalizeAggregateResult({ durationMs: 1.5 }, 'completed'));
  assert.throws(() => NormalizeAggregateResult({ trialCount: maximumResultTrialCount + 1 }, 'completed'));

  const maximumPayload = NormalizeAggregateResult(CreateBoundaryResultPayload(22));
  assert.equal(JsonBytes(maximumPayload), maximumResultPayloadBytes);
  assert.equal(JsonBytes({
    releaseId: 'r'.repeat(128),
    clientRunId: 'c'.repeat(128),
    runSessionToken: 't'.repeat(64),
    result: maximumPayload,
  }), 16 * 1024);
  assert.throws(() => NormalizeAggregateResult(CreateBoundaryResultPayload(23)));
});

test('uses the one-time private message port for lifecycle and commands', async (context) => {
  const originalWindow = globalThis.window;
  const parent = {};
  let messageListener;
  globalThis.window = {
    parent,
    addEventListener(type, listener) {
      if (type === 'message') messageListener = listener;
    },
    removeEventListener(type, listener) {
      if (type === 'message' && listener === messageListener) messageListener = undefined;
    },
  };
  context.after(() => {
    globalThis.window = originalWindow;
  });

  const bridge = CreateTrainerHubGameBridge();
  const channel = new MessageChannel();
  const sessionId = 'a'.repeat(48);
  const sessionNonce = 'b'.repeat(48);
  messageListener({
    source: parent,
    ports: [channel.port2],
    data: {
      schema: 'trainerhub.game-platform/v1',
      type: 'trainerhub.host:init',
      gameId: 'sample-game',
      gameVersion: '1.0.0',
      sessionId,
      sessionNonce,
    },
  });
  assert.equal((await bridge.Ready).sessionNonce, sessionNonce);

  const lifecycle = new Promise((resolve) => {
    channel.port1.addEventListener('message', (event) => resolve(event.data), { once: true });
    channel.port1.start();
  });
  bridge.ReportLifecycle('ready', 0);
  assert.deepEqual(await lifecycle, {
    schema: 'trainerhub.game-platform/v1',
    type: 'trainerhub.game:lifecycle',
    sessionNonce,
    sequence: 0,
    payload: { phase: 'ready', progress: 0 },
  });

  const command = new Promise((resolve) => bridge.AddCommandListener(resolve));
  channel.port1.postMessage({
    schema: 'trainerhub.game-platform/v1',
    type: 'trainerhub.host:command',
    sessionId,
    sessionNonce,
    command: 'pause',
  });
  assert.deepEqual(await command, { command: 'pause' });
  bridge.Dispose();
  channel.port1.close();
});

function CreateBoundaryResultPayload(finalMetricKeyLength) {
  const metrics = Object.fromEntries(Array.from({ length: 231 }, (_, index) => [
    `m${index.toString(36).padStart(3, '0')}${'x'.repeat(60)}`,
    0,
  ]));
  metrics[`z${'q'.repeat(finalMetricKeyLength - 1)}`] = 0;
  return { status: 'completed', metrics };
}

function JsonBytes(value) {
  return textEncoder.encode(JSON.stringify(value)).byteLength;
}
