import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const compilerOptions = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };
const embeddedSource = await readFile(new URL('../packages/ui/src/embeddedTraining.ts', import.meta.url), 'utf8');
const embeddedCode = ts.transpileModule(embeddedSource, { compilerOptions }).outputText;
const embeddedUrl = `data:text/javascript;base64,${Buffer.from(embeddedCode).toString('base64')}`;
const embeddedTraining = await import(embeddedUrl);

test('embedded training reports active state to its verified Hub origin', (context) => {
  const messages = [];
  const windowMock = {
    location: { search: '?embed=hub' },
    parent: {
      postMessage: (...args) => messages.push(args),
    },
    top: {},
  };
  windowMock.self = windowMock;

  Object.defineProperty(globalThis, 'window', { configurable: true, value: windowMock });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      documentElement: {},
      fullscreenElement: null,
      referrer: 'https://trainerhub.cc/train/?module=motor%3Aasteroid-shield',
    },
  });
  context.after(() => {
    delete globalThis.document;
    delete globalThis.window;
  });

  embeddedTraining.NotifyHubTrainingActive(true);
  assert.deepEqual(messages.shift(), [
    { type: 'rehab-trainer:training-active', active: true },
    'https://trainerhub.cc',
  ]);

  embeddedTraining.NotifyHubTrainingActive(false);
  assert.deepEqual(messages.shift(), [
    { type: 'rehab-trainer:training-active', active: false },
    'https://trainerhub.cc',
  ]);
  assert.equal(embeddedTraining.IsHubTrainingActiveMessage({
    type: 'rehab-trainer:training-active',
    active: true,
  }), true);
  assert.equal(embeddedTraining.IsHubTrainingActiveMessage({
    type: 'rehab-trainer:training-active',
    active: 'true',
  }), false);

  embeddedTraining.NotifyHubTrainingAbort();
  assert.deepEqual(messages.shift(), [
    { type: 'rehab-trainer:training-active', active: false },
    'https://trainerhub.cc',
  ]);
  assert.deepEqual(messages.shift(), [
    { type: 'rehab-trainer:training-exit' },
    'https://trainerhub.cc',
  ]);

  embeddedTraining.NotifyHubTrainingExit();
  assert.deepEqual(messages.shift(), [
    { type: 'rehab-trainer:training-exit' },
    'https://trainerhub.cc',
  ]);
  assert.equal(embeddedTraining.IsHubTrainingExitMessage({
    type: 'rehab-trainer:training-exit',
  }), true);
  assert.equal(embeddedTraining.IsHubTrainingExitMessage({
    type: 'rehab-trainer:training-complete',
  }), false);
});
