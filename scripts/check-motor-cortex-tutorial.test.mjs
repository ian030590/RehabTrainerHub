import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const gameRoot = resolve(import.meta.dirname, '../apps/rehabtrainerhub/games/motor-cortex-rehab');

test('motor tutorials explain every real target in both languages', async () => {
  const { GetMotorTutorialSteps } = await LoadModule('rules/tutorialSteps.ts');
  for(const language of ['zh','en']) {
    const steps=GetMotorTutorialSteps(language);
    assert.deepEqual(steps.map(step=>step.target),['.motor-cortex-target','.motor-cortex-hand-cursor','.motor-cortex-hold-meter','.motor-cortex-hud','.motor-cortex-camera']);
    assert.match(steps[0].text,language==='en'?/Random/:/隨機/);
    assert.match(steps[2].text,language==='en'?/interrupt/:/中斷/);
    assert.match(steps[4].text,/MediaPipe/);
  }
});

test('spotlight follows targets and resize; finishing, skipping, back and disposal clean up', async () => {
  for (const action of ['finish', 'skip', 'back', 'dispose']) {
    const dom = CreateDocument();
    const { StartTour } = await LoadModule('runtime/tour.ts', dom);
    const events = [];
    const steps = [
      { target: '.camera', title: 'Camera', text: 'Camera instructions', place: 'bottom' },
      { target: '.moves', title: 'Moves', text: 'Hold instructions', place: 'top' },
    ];
    const dispose = StartTour(steps, { lang: 'en', onEvent: event => events.push(event),
      onBack: () => events.push('back') });
    const spotlight = dom.elements.find(element => element.className === 'game-tour-spotlight');
    const panel = dom.elements.find(element => element.className === 'game-tour');
    const blocker = dom.elements.find(element => element.className === 'game-tour-blocker');
    assert.ok(blocker, 'Tutorial prevents interaction with the underlying game.');
    assert.equal(spotlight.style.left, '92px');
    assert.equal(spotlight.style.width, '216px');
    assert.equal(panel.children[0].textContent, 'Camera');
    assert.equal(dom.document.activeElement, panel.children[2]);
    const keyboard = { key: 'Tab', preventDefault() { this.prevented = true; } };
    panel.onkeydown(keyboard);
    assert.equal(keyboard.prevented, true);
    assert.equal(dom.document.activeElement, panel.children[3]);
    dom.targets['.camera'].left = 160;
    dom.window.dispatchEvent({ type: 'resize' });
    assert.equal(spotlight.style.left, '152px');
    panel.children[2].onclick();
    assert.equal(panel.children[0].textContent, 'Moves');
    assert.equal(spotlight.style.left, '492px');
    if (action === 'finish') panel.children[2].onclick();
    if (action === 'skip') panel.children[3].onclick();
    if (action === 'back') panel.children[4].onclick();
    if (action === 'dispose') dispose();
    assert.equal(dom.elements.filter(element => !element.removed).length, 0);
    assert.equal(dom.listeners.size, 0);
    assert.equal(dom.document.activeElement, dom.previousFocus);
    assert.deepEqual(events, action === 'dispose' ? [] : [action === 'back' ? 'back' : `tour_${action === 'finish' ? 'done' : 'skip'}`]);
    dispose();
  }
});

test('Escape skips the tutorial and keeps the explanation inside a small viewport', async () => {
  const dom = CreateDocument();
  dom.window.innerWidth = 390;
  dom.window.innerHeight = 320;
  const { StartTour } = await LoadModule('runtime/tour.ts', dom);
  const events = [];
  StartTour([{ target: '.moves', title: 'Moves', text: 'Hold', place: 'bottom' }], {
    lang: 'zh-TW', onEvent: event => events.push(event), onBack: () => {},
  });
  const panel = dom.elements.find(element => element.className === 'game-tour');
  assert.ok(Number.parseFloat(panel.style.left) >= 8);
  assert.ok(Number.parseFloat(panel.style.top) >= 8);
  panel.onkeydown({ key: 'Escape', preventDefault() {} });
  assert.deepEqual(events, ['tour_skip']);
  assert.equal(dom.listeners.size, 0);
});

async function LoadModule(path, dom = {}) {
  const source = await readFile(resolve(gameRoot, path), 'utf8');
  const module = { exports: {} };
  new Function('module', 'exports', 'document', 'window', 'HTMLElement', ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(module, module.exports, dom.document, dom.window, dom.HTMLElement);
  return module.exports;
}

function CreateDocument() {
  const elements = [];
  const listeners = new Map();
  const targets = { '.camera': { left: 100, top: 100, width: 200, height: 120 },
    '.moves': { left: 500, top: 400, width: 280, height: 150 } };
  class Element {
    style = {};
    children = [];
    isConnected = true;
    setAttribute() {}
    append(...children) { this.children.push(...children); }
    getBoundingClientRect() { return { width: Math.min(300, window.innerWidth - 16), height: 200 }; }
    focus() { document.activeElement = this; }
    remove() { this.removed = true; this.isConnected = false; }
  }
  const previousFocus = new Element();
  const document = { activeElement: previousFocus,
    createElement: () => new Element(),
    body: { append: (...children) => elements.push(...children) },
    querySelector: target => targets[target] && { getBoundingClientRect: () => ({ ...targets[target],
      right: targets[target].left + targets[target].width, bottom: targets[target].top + targets[target].height }) },
  };
  const window = { innerWidth: 1024, innerHeight: 768,
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: type => listeners.delete(type),
    dispatchEvent: event => listeners.get(event.type)?.(event),
  };
  return { document, window, HTMLElement: Element, elements, listeners, targets, previousFocus };
}
