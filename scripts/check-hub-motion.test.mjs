import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const appRoot = new URL('../apps/rehabtrainerhub/app/', import.meta.url);
async function LoadModule(path) {
  const source = await readFile(path, 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

function Element(id = '', top = 0) {
  const properties = new Map();
  const children = new Map();
  const listeners = new Map();
  return {
    id, isConnected: true, dataset: { runtimeId: id }, tagName: 'DIV', offsetWidth: 180, offsetHeight: 90,
    style: { setProperty: (name, value) => properties.set(name, value), getPropertyValue: name => properties.get(name) ?? '', removeProperty: name => properties.delete(name) },
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {}, focus() {},
    addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name),
    click: () => listeners.get('click')?.(),
    querySelector: selector => { if (!children.has(selector)) children.set(selector, Element(selector)); return children.get(selector); },
    getBoundingClientRect: () => ({ top, bottom: top + 200, left: 0, right: 300, width: 300, height: 200 }),
  };
}

function InstallGlobals(values) {
  const old = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  return () => { for (const [key, descriptor] of old) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } };
}

function CssRules(source) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectors, declarations]) => ({
    selectors: selectors.split(',').map(selector => selector.trim().replace(/\s*([()[\]])\s*/g, '$1')),
    declarations: Object.fromEntries(declarations.split(';')
      .map(declaration => declaration.trim().split(/\s*:\s*/, 2))
      .filter(parts => parts.length === 2)),
  }));
}

test('open game overlays release the stable lobby gutter and lock root scrolling', async context => {
  const [motionCss, globalsCss] = await Promise.all([
    readFile(new URL('hubMotion.css', appRoot), 'utf8'),
    readFile(new URL('globals.css', appRoot), 'utf8'),
  ]);
  const motionRules = CssRules(motionCss);
  const globalRules = CssRules(globalsCss);
  assert.ok(motionRules.some(rule => rule.selectors.includes('html')
    && rule.declarations['scrollbar-gutter'] === 'stable'), 'The lobby keeps its stable gutter when no game overlay is open.');
  for (const overlayClass of ['training-overlay', 'package-game-overlay']) {
    await context.test(overlayClass, () => {
      const selector = `html:has(dialog.${overlayClass}[open])`;
      const rule = globalRules.find(candidate => candidate.selectors.includes(selector));
      assert.ok(rule, `${overlayClass} needs a root scroll-lock rule while open.`);
      assert.equal(rule.declarations.overflow, 'hidden', `${overlayClass} must hide the lobby scrollbar.`);
      assert.equal(rule.declarations['scrollbar-gutter'], 'auto', `${overlayClass} must release the reserved gutter to fill the visible viewport.`);
    });
  }
});

test('card stagger animates only newly visible results and keeps every action available', async () => {
  const motion = await LoadModule(new URL('hubMotion.ts', appRoot));
  const cards = [Element('retained'), Element('first', 20), Element('second', 240), Element('offscreen', 1200)];
  const animations = [];
  for (const card of cards) card.animate = (frames, options) => {
    const animation = { card, frames, options, cancelled: false, cancel() { this.cancelled = true; } };
    animations.push(animation); return animation;
  };
  const restore = InstallGlobals({ window: { innerHeight: 800, innerWidth: 1000, matchMedia: () => ({ matches: false }) } });
  try {
    const stop = motion.AnimateVisibleGameCards({ querySelectorAll: () => cards }, new Set(['retained']));
    assert.deepEqual(animations.map(item => item.card.id), ['first', 'second']);
    assert.ok(animations[0].options.delay < animations[1].options.delay, 'visible new cards have a short ordered stagger');
    assert.ok(animations.every(item => item.options.delay + item.options.duration <= 300));
    assert.ok(animations.every(item => item.frames.every(frame => frame.opacity === undefined || frame.opacity > 0)), 'actions never disappear during the stagger');
    stop();
    assert.ok(animations.every(item => item.cancelled), 'a changed result list cancels the previous animations');
  } finally { restore(); }
});

test('reduced motion and unsupported animation APIs leave cards immediately usable', async () => {
  const motion = await LoadModule(new URL('hubMotion.ts', appRoot));
  let animated = false;
  const card = { ...Element('first'), animate: () => { animated = true; } };
  const restore = InstallGlobals({ window: { innerHeight: 800, innerWidth: 1000, matchMedia: () => ({ matches: true }) } });
  try {
    motion.AnimateVisibleGameCards({ querySelectorAll: () => [card] }, new Set())();
    assert.equal(animated, false);
    window.matchMedia = () => ({ matches: false });
    delete card.animate;
    assert.doesNotThrow(() => motion.AnimateVisibleGameCards({ querySelectorAll: () => [card] }, new Set())());
  } finally { restore(); }
});

test('shared surface transitions from the selected card to the dialog and cleans up', async () => {
  const motion = await LoadModule(new URL('hubMotion.ts', appRoot));
  const source = Element('selected'); const target = Element('dialog-surface');
  let resolveFinished; let render; let updated = 0;
  const transition = { skipTransition() {}, ready: Promise.resolve(), finished: new Promise(resolve => { resolveFinished = resolve; }) };
  const restore = InstallGlobals({ window: { matchMedia: () => ({ matches: false }) }, document: {
    startViewTransition: callback => { assert.equal(source.style.getPropertyValue('view-transition-name'), 'hub-game-surface'); render = callback; return transition; },
  } });
  try {
    motion.TransitionGameSurface(source, () => { updated++; return target; });
    assert.equal(updated, 0, 'capture the selected card before mounting the dialog');
    await render();
    assert.equal(updated, 1);
    assert.equal(source.style.getPropertyValue('view-transition-name'), '', 'the connected source card must release its name before the new dialog snapshot');
    assert.equal(target.style.getPropertyValue('view-transition-name'), 'hub-game-surface');
    resolveFinished(); await transition.finished; await Promise.resolve();
    assert.equal(source.style.getPropertyValue('view-transition-name'), '');
    assert.equal(target.style.getPropertyValue('view-transition-name'), '');
  } finally { motion.CancelHubGameTransition(); restore(); }
});

test('superseding a transition cancels motion and prevents a stale dialog from opening', async () => {
  const motion = await LoadModule(new URL('hubMotion.ts', appRoot));
  const callbacks = []; const transitions = []; const opened = [];
  const restore = InstallGlobals({ window: { matchMedia: () => ({ matches: false }) }, document: {
    startViewTransition: callback => {
      callbacks.push(callback);
      const transition = { skipped: false, skipTransition() { this.skipped = true; }, ready: Promise.reject(new Error('Skipped')), finished: Promise.resolve() };
      transitions.push(transition); return transition;
    },
  } });
  try {
    motion.TransitionGameSurface(Element('a'), () => { opened.push('a'); return Element('a-dialog'); });
    motion.TransitionGameSurface(Element('b'), () => { opened.push('b'); return Element('b-dialog'); });
    assert.equal(transitions[0].skipped, true);
    await callbacks[0](); await callbacks[1]();
    assert.deepEqual(opened, ['b']);
  } finally { motion.CancelHubGameTransition(); restore(); }
});

test('shared transitions fall back to immediate navigation with reduced motion or unsupported browsers', async () => {
  const motion = await LoadModule(new URL('hubMotion.ts', appRoot));
  let updates = 0; let starts = 0;
  const restore = InstallGlobals({ window: { matchMedia: () => ({ matches: true }) }, document: { startViewTransition: () => { starts++; } } });
  try {
    motion.TransitionGameSurface(Element('a'), () => { updates++; return null; });
    assert.equal(starts, 0); assert.equal(updates, 1);
    window.matchMedia = () => ({ matches: false }); delete document.startViewTransition;
    motion.TransitionGameSurface(Element('a'), () => { updates++; return null; });
    assert.equal(updates, 2);
  } finally { motion.CancelHubGameTransition(); restore(); }
});

function TourEnvironment(reducedMotion) {
  const elements = new Map(); const timers = new Map(); const scrolls = []; let timerId = 0;
  const target = index => {
    const element = Element(`target-${index}`, 100 + index * 300);
    element.scrollIntoView = options => scrolls.push({ index, options }); return element;
  };
  const targets = [target(0), target(1)];
  const fakeDocument = {
    body: { appendChild: element => elements.set(element.id, element), contains: element => elements.get(element.id) === element },
    getElementById: id => elements.get(id), createElement: () => Element(),
    querySelector: selector => targets[Number(selector.slice(-1))],
    addEventListener() {}, removeEventListener() {},
  };
  const fakeWindow = { innerWidth: 1000, innerHeight: 800, getComputedStyle: () => ({ borderRadius: '8px' }), matchMedia: () => ({ matches: reducedMotion }) };
  const restore = InstallGlobals({ document: fakeDocument, window: fakeWindow,
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id),
    localStorage: { setItem() {}, getItem() { return null; }, removeItem() {} },
  });
  return { elements, timers, scrolls, restore, steps: targets.map((_, index) => ({ target: `.target-${index}`, text: `Step ${index}` })) };
}

test('tour respects reduced motion when scrolling to a step', async () => {
  const tour = await LoadModule(new URL('../packages/ui/src/tour/toutourEngine.ts', import.meta.url));
  const env = TourEnvironment(true);
  try {
    tour.StartTour(env.steps);
    for (const [id, callback] of env.timers) { env.timers.delete(id); callback(); }
    assert.equal(env.scrolls.length, 1);
    assert.equal(env.scrolls[0].options.behavior, 'instant');
  } finally { tour.EndTour(); env.restore(); }
});

test('tour cancels superseded and dismissed step scrolls', async () => {
  const tour = await LoadModule(new URL('../packages/ui/src/tour/toutourEngine.ts', import.meta.url));
  const env = TourEnvironment(false);
  try {
    tour.StartTour(env.steps);
    env.elements.get('ttTip').querySelector('#ttNext').click();
    assert.equal(env.timers.size, 1, 'only the current step may keep a pending scroll');
    for (const [id, callback] of env.timers) { env.timers.delete(id); callback(); }
    assert.deepEqual(env.scrolls.map(item => item.index), [1]);
    env.elements.get('ttTip').querySelector('#ttPrev').click();
    tour.EndTour();
    assert.equal(env.timers.size, 0, 'closing the tour cancels its pending scroll');
  } finally { tour.EndTour(); env.restore(); }
});

test('lobby actions expose game titles and connect the card to an isolated dialog surface', async () => {
  const lobby = await readFile(new URL('TrainingLobby.tsx', appRoot), 'utf8');
  const overlay = await readFile(new URL('train/GameOverlay.tsx', appRoot), 'utf8');
  assert.match(lobby, /aria-label=\{[^\n]*copy\.start[^\n]*game\.title/);
  assert.match(lobby, /aria-label=\{[^\n]*platformCopy\.install[^\n]*game\.title/);
  assert.match(lobby, /AnimateVisibleGameCards/); assert.match(lobby, /TransitionGameSurface/);
  assert.match(overlay, /hub-game-transition-surface/);
  assert.match(overlay, /aria-hidden="true"/);
});
