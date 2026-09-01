import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { platformRuntimeContract } from '../apps/usergamerunner/functions/_lib/runtime.js';

const compilerOptions = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };
const source = await readFile(new URL('../packages/ui/src/gamePlatform.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions }).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const gamePlatform = await import(moduleUrl);
const sessionNonce = '3U4qHf2dZVY2e8SmP5wLc7tK9nBxRaQ1';
const textEncoder = new TextEncoder();

function CreateLifecycleMessage(overrides = {}) {
  return {
    schema: gamePlatform.gamePlatformMessageSchema,
    type: gamePlatform.gamePlatformLifecycleMessageType,
    sessionNonce,
    sequence: 0,
    payload: { phase: 'ready' },
    ...overrides,
  };
}

function CreateResultMessage(overrides = {}) {
  return {
    schema: gamePlatform.gamePlatformMessageSchema,
    type: gamePlatform.gamePlatformResultMessageType,
    sessionNonce,
    sequence: 1,
    payload: {
      status: 'completed',
      score: 93.5,
      durationMs: 12_400,
      trialCount: 20,
      metrics: { accuracy: 0.95, passed: true, misses: 1 },
    },
    ...overrides,
  };
}

test('validates a versioned jsPsych game manifest and rejects unsafe variants', () => {
  assert.equal(gamePlatform.gamePlatformMaxFiles, 192);
  const manifest = {
    schemaVersion: 1,
    id: 'developer.target-game',
    version: '1.2.0',
    title: 'Target Game',
    entry: 'index.html',
    files: ['index.html', 'assets/target.png', 'assets/success.mp3'],
    capabilities: ['audio', 'keyboard', 'pointer'],
    jsPsychVersion: platformRuntimeContract.jsPsychVersion,
  };

  assert.equal(gamePlatform.IsGamePlatformManifest(manifest), true);
  assert.equal(gamePlatform.IsGamePlatformManifest({ ...manifest, entry: '../index.html' }), false);
  assert.equal(gamePlatform.IsGamePlatformManifest({ ...manifest, jsPsychVersion: '7.3.4' }), false);
  assert.equal(gamePlatform.IsGamePlatformManifest({ ...manifest, authToken: 'never-allowed' }), false);
  assert.equal(gamePlatform.IsGamePlatformManifest({
    ...manifest,
    files: [
      'index.html',
      ...Array.from({ length: gamePlatform.gamePlatformMaxFiles }, (_, index) => `assets/${index}.png`),
    ],
  }), false);
});

test('pins uploaded games to runner-owned, versioned runtime URLs', async () => {
  assert.deepEqual(platformRuntimeContract, {
    jsPsychVersion: '8.2.3',
    gameSdkVersion: '0.1.0',
    jsPsychUrl: '/runtime/jspsych-8.2.3.js',
    jsPsychCssUrl: '/runtime/jspsych-8.2.3.css',
    gameSdkUrl: '/runtime/trainerhub-game-sdk-0.1.0.js',
    noticesUrl: '/runtime/THIRD_PARTY_NOTICES-0.1.0.txt',
    icon192Url: '/runtime/icons/trainerhub-192-v1.png',
    icon512Url: '/runtime/icons/trainerhub-512-v1.png',
  });

  const sample = await readFile(
    new URL('../packages/game-sdk/examples/minimal-game.html', import.meta.url),
    'utf8',
  );
  assert.ok(sample.includes(platformRuntimeContract.jsPsychUrl));
  assert.ok(sample.includes(platformRuntimeContract.jsPsychCssUrl));
  assert.ok(sample.includes(platformRuntimeContract.gameSdkUrl));
  assert.match(sample, /initJsPsych: jsPsychModule\.initJsPsych/);
  assert.doesNotMatch(sample, /vendor\/jspsych|trainerhub-game-sdk\.js/);
});

test('accepts valid lifecycle and aggregate result messages', () => {
  const lifecycleMessage = CreateLifecycleMessage({
    payload: { phase: 'started', progress: 0.25 },
  });
  const resultMessage = CreateResultMessage();

  assert.equal(gamePlatform.IsGamePlatformLifecycleMessage(lifecycleMessage, sessionNonce, -1), true);
  assert.equal(gamePlatform.IsGamePlatformResultMessage(resultMessage, sessionNonce, 0), true);
  assert.equal(gamePlatform.IsGamePlatformMessage(lifecycleMessage, sessionNonce, -1), true);
  assert.equal(gamePlatform.IsGamePlatformMessage(resultMessage, sessionNonce, 0), true);

  assert.equal(gamePlatform.IsGamePlatformLifecycleMessage({
    ...lifecycleMessage,
    payload: { phase: 'started', progress: Number.POSITIVE_INFINITY },
  }, sessionNonce, -1), false);
  assert.equal(gamePlatform.IsGamePlatformResultMessage({
    ...resultMessage,
    payload: { ...resultMessage.payload, score: Number.NaN },
  }, sessionNonce, 0), false);
  assert.equal(gamePlatform.IsGamePlatformResultMessage({
    ...resultMessage,
    payload: { ...resultMessage.payload, userId: 42 },
  }, sessionNonce, 0), false);
  assert.equal(gamePlatform.IsGamePlatformResultMessage({
    ...resultMessage,
    payload: { ...resultMessage.payload, metrics: { email: 1 } },
  }, sessionNonce, 0), false);

  const messageWithPrototype = Object.assign(Object.create({}), lifecycleMessage);
  assert.equal(gamePlatform.IsGamePlatformLifecycleMessage(messageWithPrototype, sessionNonce, -1), false);

  const messageWithHiddenField = CreateLifecycleMessage();
  Object.defineProperty(messageWithHiddenField, 'authToken', { value: 'never-allowed' });
  assert.equal(gamePlatform.IsGamePlatformLifecycleMessage(messageWithHiddenField, sessionNonce, -1), false);
});

test('rejects forged opaque-sandbox messages and replayed sequences', () => {
  const expectedContentWindow = {};
  const event = {
    data: CreateLifecycleMessage(),
    origin: 'null',
    source: expectedContentWindow,
  };

  assert.equal(gamePlatform.IsTrustedGamePlatformFrameMessage(
    event,
    expectedContentWindow,
    sessionNonce,
    -1,
  ), true);
  assert.equal(gamePlatform.IsTrustedGamePlatformFrameMessage(
    { ...event, origin: 'https://rehab-user-games.com' },
    expectedContentWindow,
    sessionNonce,
    -1,
  ), false);
  assert.equal(gamePlatform.IsTrustedGamePlatformFrameMessage(
    { ...event, source: {} },
    expectedContentWindow,
    sessionNonce,
    -1,
  ), false);
  assert.equal(gamePlatform.IsTrustedGamePlatformFrameMessage(
    { ...event, data: CreateLifecycleMessage({ sessionNonce: `${sessionNonce}x` }) },
    expectedContentWindow,
    sessionNonce,
    -1,
  ), false);
  assert.equal(gamePlatform.IsTrustedGamePlatformFrameMessage(
    event,
    expectedContentWindow,
    sessionNonce,
    0,
  ), false);
});

test('binds runner readiness and lifecycle commands to the opaque frame session', () => {
  const expectedContentWindow = {};
  const readyMessage = {
    schema: gamePlatform.gamePlatformMessageSchema,
    type: gamePlatform.gamePlatformRunnerReadyMessageType,
    gameId: 'reviewed-game',
    gameVersion: '1.2.3',
    sessionId: 'runner_session_1234567890abcdef1234567890abcdef',
    sessionNonce,
  };
  const event = {
    data: readyMessage,
    origin: 'null',
    source: expectedContentWindow,
  };

  assert.equal(gamePlatform.IsTrustedGamePlatformRunnerReadyMessage(
    event,
    expectedContentWindow,
    sessionNonce,
    'reviewed-game',
    '1.2.3',
  ), true);
  assert.equal(gamePlatform.IsTrustedGamePlatformRunnerReadyMessage(
    { ...event, source: {} },
    expectedContentWindow,
    sessionNonce,
    'reviewed-game',
    '1.2.3',
  ), false);
  assert.equal(gamePlatform.IsTrustedGamePlatformRunnerReadyMessage(
    event,
    expectedContentWindow,
    sessionNonce,
    'another-game',
    '1.2.3',
  ), false);
  assert.deepEqual(
    gamePlatform.CreateGamePlatformRunnerCommandMessage(
      readyMessage.sessionId,
      sessionNonce,
      'exit',
    ),
    {
      schema: gamePlatform.gamePlatformMessageSchema,
      type: gamePlatform.gamePlatformRunnerCommandMessageType,
      sessionId: readyMessage.sessionId,
      sessionNonce,
      command: 'exit',
    },
  );
  assert.throws(() => gamePlatform.CreateGamePlatformRunnerCommandMessage(
    'too-short',
    sessionNonce,
    'exit',
  ));
});

test('binds selected settings to the opaque runner session', () => {
  const sessionId = 'runner_session_1234567890abcdef1234567890abcdef';
  const message = gamePlatform.CreateGamePlatformRunnerSettingsMessage(
    sessionId,
    sessionNonce,
    { difficulty: 'normal', rounds: 12, sound: true },
  );

  assert.deepEqual(message, {
    schema: gamePlatform.gamePlatformMessageSchema,
    type: gamePlatform.gamePlatformRunnerSettingsMessageType,
    sessionId,
    sessionNonce,
    settings: { difficulty: 'normal', rounds: 12, sound: true },
  });
  assert.equal(gamePlatform.IsGamePlatformRunnerSettingsMessage(
    message,
    sessionId,
    sessionNonce,
  ), true);
  assert.equal(gamePlatform.IsGamePlatformRunnerSettingsMessage(
    { ...message, sessionNonce: `${sessionNonce}x` },
    sessionId,
    sessionNonce,
  ), false);
  assert.throws(() => gamePlatform.CreateGamePlatformRunnerSettingsMessage(
    sessionId,
    sessionNonce,
    { token: 'never-allowed' },
  ));
});

test('matches the game-runs API numeric and UTF-8 byte limits', () => {
  assert.equal(gamePlatform.gamePlatformMaxResultDurationMs, 86_400_000);
  assert.equal(gamePlatform.gamePlatformMaxResultTrialCount, 100_000);
  assert.equal(gamePlatform.gamePlatformMaxPayloadBytes, 16_000);

  const maximumNumericMessage = CreateResultMessage({
    payload: {
      status: 'completed',
      durationMs: gamePlatform.gamePlatformMaxResultDurationMs,
      trialCount: gamePlatform.gamePlatformMaxResultTrialCount,
    },
  });
  assert.equal(gamePlatform.IsGamePlatformResultMessage(maximumNumericMessage, sessionNonce, 0), true);
  assert.equal(gamePlatform.IsGamePlatformResultMessage(CreateResultMessage({
    payload: { status: 'completed', durationMs: gamePlatform.gamePlatformMaxResultDurationMs + 1 },
  }), sessionNonce, 0), false);
  assert.equal(gamePlatform.IsGamePlatformResultMessage(CreateResultMessage({
    payload: { status: 'completed', durationMs: 1.5 },
  }), sessionNonce, 0), false);
  assert.equal(gamePlatform.IsGamePlatformResultMessage(CreateResultMessage({
    payload: { status: 'completed', trialCount: gamePlatform.gamePlatformMaxResultTrialCount + 1 },
  }), sessionNonce, 0), false);

  const maximumPayload = CreateBoundaryResultPayload(22);
  assert.equal(JsonBytes(maximumPayload), gamePlatform.gamePlatformMaxPayloadBytes);
  assert.equal(gamePlatform.IsGamePlatformResultMessage(CreateResultMessage({
    payload: maximumPayload,
  }), sessionNonce, 0), true);
  assert.equal(JsonBytes(JSON.stringify({
    releaseId: 'r'.repeat(128),
    clientRunId: 'c'.repeat(128),
    runSessionToken: 't'.repeat(gamePlatform.gamePlatformRunSessionTokenLength),
    result: maximumPayload,
  })), 16 * 1024);

  const oversizedPayload = CreateBoundaryResultPayload(23);
  assert.equal(JsonBytes(oversizedPayload), gamePlatform.gamePlatformMaxPayloadBytes + 1);
  assert.equal(gamePlatform.IsGamePlatformResultMessage(CreateResultMessage({
    payload: oversizedPayload,
  }), sessionNonce, 0), false);
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
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return textEncoder.encode(serialized).byteLength;
}
