import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function LoadAudioFeedback() {
  const source = await readFile('packages/ui/src/audioFeedback.ts', 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

function WithAudioContext(AudioContext, run) {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousAudioContext = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  globalThis.window = { AudioContext };
  globalThis.AudioContext = AudioContext;
  try {
    run();
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
    if (previousAudioContext) Object.defineProperty(globalThis, 'AudioContext', previousAudioContext);
    else delete globalThis.AudioContext;
  }
}

test('audio creation failure leaves preparation and result handling playable', async () => {
  const { CreateAudioFeedbackController } = await LoadAudioFeedback();
  const controller = CreateAudioFeedbackController(() => ({ enabled: true, volumePercent: 50 }));
  WithAudioContext(class AudioContext {
    constructor() { throw new Error('AudioContext unavailable'); }
  }, () => {
    assert.doesNotThrow(() => controller.PrepareAudioFeedback());
    assert.doesNotThrow(() => controller.PlayGameEndSound('Victory'));
  });
});

test('synchronous audio resume failure leaves preparation and result handling playable', async () => {
  const { CreateAudioFeedbackController } = await LoadAudioFeedback();
  const controller = CreateAudioFeedbackController(() => ({ enabled: true, volumePercent: 50 }));
  WithAudioContext(class AudioContext {
    state = 'suspended';
    currentTime = 0;
    resume() { throw new Error('Audio resume denied'); }
    createOscillator() { throw new Error('audio unavailable'); }
  }, () => {
    assert.doesNotThrow(() => controller.PrepareAudioFeedback());
    assert.doesNotThrow(() => controller.PlayGameEndSound('Victory'));
  });
});

test('audio node failure cannot interrupt game completion', async () => {
  const { CreateAudioFeedbackController } = await LoadAudioFeedback();
  const controller = CreateAudioFeedbackController(() => ({ enabled: true, volumePercent: 50 }));
  WithAudioContext(class AudioContext {
    state = 'running';
    currentTime = 0;
    createOscillator() { throw new Error('Oscillator unavailable'); }
  }, () => {
    assert.doesNotThrow(() => controller.PlayGameEndSound('Victory'));
    assert.doesNotThrow(() => controller.PlayGameEndSound('Defeat'));
  });
});
