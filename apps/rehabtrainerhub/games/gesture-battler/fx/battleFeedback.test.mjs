import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const gameRoot = resolve(import.meta.dirname, '..');
const scene = { width: 1000, height: 700, enemy: { x: 730, y: 220, scale: { x: 1 } },
  player: { x: 230, y: 380, scale: { x: 1 } } };

test('battle feedback plays gesture-specific one-shots at the enemy and interruption at the player', async () => {
  const dom = await CreateFeedbackHarness();
  const rendered = new Map();
  for (const event of [1, 2, 3, 4, 5, 'interrupted', 'defeated']) {
    dom.feedback.play(event, scene);
    dom.Step(40);
    dom.Step(40);
    assert.ok(dom.paints.length, String(event));
    assert.ok(dom.paints.at(-1).pixels.some((value, index) => index % 4 === 3 && value > 0), 'Actual pixelfx pixels are rendered.');
    const paint = dom.paints.at(-1);
    rendered.set(event, paint.pixels.toString());
    const target = event === 'interrupted' ? scene.player : scene.enemy;
    assert.ok(Math.abs(paint.x + paint.width / 2 - target.x) < 1, 'Effect is centered on the character.');
    assert.ok(paint.width <= (event === 'interrupted' ? 70 : 250), 'Feedback stays local to the character.');
    dom.Step(1000);
    assert.equal(dom.pending.size, 0, 'One-shot ends within one second without an idle rAF.');
    assert.equal(dom.visible, false);
  }
  assert.notEqual(rendered.get(1), rendered.get(2), 'Spell and strike have different silhouettes.');
  assert.notEqual(rendered.get(2), rendered.get(3), 'Leaf strike uses its green ramp and angle.');
  assert.notEqual(rendered.get(1), rendered.get(5), 'Thunder uses the existing yellow accent.');
  dom.feedback.dispose();
});

test('reduced motion never starts feedback and switching it on clears a running effect', async () => {
  const dom = await CreateFeedbackHarness(true);
  dom.feedback.play(1, scene);
  assert.equal(dom.pending.size, 0);
  assert.equal(dom.paints.length, 0);
  dom.motion.matches = false;
  dom.motion.dispatchEvent(new Event('change'));
  dom.feedback.play(1, scene);
  dom.Step(40);
  assert.equal(dom.visible, true);
  dom.motion.matches = true;
  dom.motion.dispatchEvent(new Event('change'));
  assert.equal(dom.pending.size, 0);
  assert.equal(dom.visible, false);
  dom.feedback.dispose();
});

test('blur, hidden page, portrait pause, resize and explicit stop clear feedback without replay', async () => {
  for (const reason of ['blur', 'visibilitychange', 'portrait', 'resize', 'pagehide', 'clear']) {
    const dom = await CreateFeedbackHarness();
    dom.feedback.play(2, scene);
    dom.Step(40);
    if (reason === 'visibilitychange') dom.document.hidden = true;
    if (reason === 'portrait') dom.portrait.matches = true;
    if (reason === 'clear') dom.feedback.clear();
    else if (reason === 'portrait') dom.portrait.dispatchEvent(new Event('change'));
    else (reason === 'visibilitychange' ? dom.document : dom.window).dispatchEvent(new Event(reason));
    assert.equal(dom.pending.size, 0, reason);
    assert.equal(dom.visible, false, reason);
    if (['blur', 'visibilitychange', 'portrait', 'pagehide'].includes(reason)) {
      dom.feedback.play(3, scene);
      assert.equal(dom.pending.size, 0, 'Suspended effects do not start from incoming camera frames.');
    }
    dom.feedback.dispose();
  }
});

test('disposal removes listeners, clears pixels and prevents late callbacks from starting effects', async () => {
  const dom = await CreateFeedbackHarness();
  dom.feedback.play('defeated', scene);
  dom.Step(40);
  dom.feedback.dispose();
  assert.equal(dom.pending.size, 0);
  assert.equal(dom.visible, false);
  assert.equal(dom.listeners.size, 0);
  dom.feedback.play(5, scene);
  dom.window.dispatchEvent(new Event('focus'));
  assert.equal(dom.pending.size, 0);
  dom.feedback.dispose();
});

test('feedback cannot consume gameplay randomness and vendored modules stay inside this package', async () => {
  const dom = await CreateFeedbackHarness();
  const originalRandom = Math.random;
  Math.random = () => { throw new Error('Feedback consumed gameplay randomness'); };
  try {
    for (const event of [1, 2, 3, 4, 5, 'interrupted', 'defeated']) {
      dom.feedback.play(event, scene);
      dom.Step(40);
      dom.Step(1000);
    }
  } finally { Math.random = originalRandom; dom.feedback.dispose(); }
  const vendorRoot = resolve(gameRoot, 'public/runtime/pixelfx');
  for (const file of (await readdir(vendorRoot, { recursive: true })).filter(file => file.endsWith('.js'))) {
    const source = await readFile(resolve(vendorRoot, file), 'utf8');
    assert.doesNotMatch(source, /@rehab-trainer\/|packages\/|\.\.\/games\//);
    for (const [, specifier] of source.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)) {
      assert.ok(resolve(vendorRoot, file, '..', specifier).startsWith(vendorRoot), specifier);
    }
  }
  assert.match(await readFile(resolve(vendorRoot, 'LICENSE-pixelfx.md'), 'utf8'), /MIT License[\s\S]*Hugo Duprez[\s\S]*Hollow Crown/);
});

test('battle integration is decorative, below the HUD, and cleaned up on phase changes and vision stop', async () => {
  const source = await readFile(resolve(gameRoot, 'GestureBattlerGame.tsx'), 'utf8');
  const css = await readFile(resolve(gameRoot, 'game.css'), 'utf8');
  assert.match(source, /<canvas[^>]*ref=\{feedbackCanvasRef\}[^>]*aria-hidden="true"/);
  assert.match(css, /\.gesture-battle-feedback\s*\{[^}]*pointer-events:\s*none[^}]*image-rendering:\s*pixelated/);
  assert.match(css, /\.gesture-camera,\s*\.gesture-combat-hud\s*\{\s*z-index:\s*2/);
  assert.match(source, /if \(nextPhase !== 'combat'\) battleFeedbackRef\.current\?\.clear\(\)/);
  assert.match(source, /const stopVision[\s\S]*?battleFeedbackRef\.current\?\.clear\(\)/);
  assert.match(source, /feedback\.dispose\(\)/);
  assert.match(source, /const resetHold[\s\S]*?progressMs >= 120[\s\S]*?\.play\('interrupted', sceneRef\.current\)/);
  assert.match(source, /await AnimateAttack\([^;]*\.play\(gesture, sceneRef\.current\)/);
  assert.match(source, /if \(nextHp <= 0\)\s*\{\s*battleFeedbackRef\.current\?\.play\('defeated', sceneRef\.current\)/);
});

test('impact feedback fires once at the existing 620ms hit without changing the 260ms recovery', async () => {
  const source = await readFile(resolve(gameRoot, 'GestureBattlerGame.tsx'), 'utf8');
  const ast = ts.createSourceFile('game.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const attack = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'AnimateAttack');
  const code = ts.transpileModule(attack.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  class Graphics {
    rect() { return this; }
    fill() { return this; }
    destroy() { this.destroyed = true; }
  }
  let tick;
  let recovery;
  let impacts = 0;
  const app = { ticker: { add(callback) { tick = callback; }, remove() { tick = null; } } };
  const battle = { ...scene, enemy: { ...scene.enemy }, playerBaseY: 380, enemyBaseY: 220, effects: { addChild() {} } };
  const animate = new Function('Graphics', 'Clamp', 'moveColors', 'window', `${code}; return AnimateAttack;`)(Graphics,
    (value, min, max) => Math.min(max, Math.max(min, value)), [1, 2, 3, 4, 5],
    { setTimeout(callback, duration) { assert.equal(duration, 260); recovery = callback; } });
  const pending = animate(app, battle, 2, () => impacts++);
  tick({ deltaMS: 619 });
  assert.equal(impacts, 0);
  tick({ deltaMS: 1 });
  assert.equal(impacts, 1);
  assert.equal(tick, null);
  recovery();
  await pending;
  assert.equal(battle.enemy.x, scene.enemy.x);
  assert.equal(battle.enemy.alpha, 1);
});

async function CreateFeedbackHarness(reduced = false) {
  const listeners = new Set();
  let nextTargetId = 0;
  class TrackedTarget extends EventTarget {
    listenerId = ++nextTargetId;
    addEventListener(type, listener, ...args) { listeners.add(`${this.listenerId}:${type}`); super.addEventListener(type, listener, ...args); }
    removeEventListener(type, listener, ...args) { listeners.delete(`${this.listenerId}:${type}`); super.removeEventListener(type, listener, ...args); }
  }
  const window = new TrackedTarget();
  const document = new TrackedTarget();
  const motion = new TrackedTarget();
  const portrait = new TrackedTarget();
  motion.matches = reduced;
  portrait.matches = false;
  document.hidden = false;
  window.matchMedia = query => query.includes('reduced-motion') ? motion : portrait;
  const pending = new Map();
  const paints = [];
  let now = 0;
  let nextId = 0;
  let visible = false;
  let scratchPixels;
  const context = { clearRect() { visible = false; },
    createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData(image) { scratchPixels = image.data.slice(); },
    drawImage(_canvas, x, y, width, height) { visible = true; paints.push({ x, y, width, height, pixels: scratchPixels }); },
  };
  document.createElement = () => ({ getContext: () => context });
  const canvas = { width: 0, height: 0, getContext: () => context };
  const modules = {};
  for (const path of ['core/index.js', 'fx/melee/sword-slash.js', 'fx/arcane/mana-burst.js', 'fx/impacts/hit-spark.js', 'fx/spawn/poof.js']) {
    modules[`../public/runtime/pixelfx/${path}`] = await import(pathToFileURL(resolve(gameRoot, 'public/runtime/pixelfx', path)));
  }
  const source = await readFile(resolve(gameRoot, 'fx/battleFeedback.ts'), 'utf8');
  const module = { exports: {} };
  new Function('module', 'exports', 'require', 'window', 'document', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(module, module.exports, path => modules[path], window, document, { now: () => now },
    callback => { pending.set(++nextId, callback); return nextId; }, id => pending.delete(id),
    () => ({ getPropertyValue: name => ({ '--heading': '#14212b', '--primary': '#005eb8', '--hp': '#538446', '--hand-point': '#fef08a', '--surface': '#ffffff' })[name] }));
  const feedback = module.exports.CreateBattleFeedback(canvas, { getBoundingClientRect: () => ({ width: 1000, height: 700 }) });
  return { feedback, window, document, motion, portrait, pending, paints, listeners, get visible() { return visible; },
    Step(milliseconds) { now += milliseconds; const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(now)); },
  };
}
