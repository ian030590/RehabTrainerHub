import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, GameRoot, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'whack-a-mole';
const LoadLogic = () => LoadGameModule(gameId, 'logic/whackAMole.ts');
const Sequence = (...values) => { let index = 0; return () => values[index++ % values.length]; };

test('Target Click keeps the original boards, mole times, gaps, session lengths and sound setting', async () => {
  const { defaultSettings, durationRange, ValidateSettings } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { difficulty: 'medium', durationSec: 60, soundEnabled: true });
  assert.deepEqual(durationRange, { min: 30, max: 300, step: 15 });
  assert.equal(ValidateSettings(defaultSettings), true);
  for (const change of [{ difficulty: 'easy' }, { difficulty: 'hard' }, { durationSec: 30 }, { durationSec: 45 }, { durationSec: 300 }, { soundEnabled: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ difficulty: 'expert' }, { durationSec: 15 }, { durationSec: 50 }, { durationSec: 315 }, { durationSec: '60' }, { soundEnabled: 'yes' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
  const { whackConfig, firstTargetMs } = await LoadLogic();
  assert.deepEqual(whackConfig, {
    easy: { gridSize: 3, targetMs: 1100, minDelayMs: 350, maxDelayMs: 900 },
    medium: { gridSize: 3, targetMs: 850, minDelayMs: 250, maxDelayMs: 720 },
    hard: { gridSize: 4, targetMs: 720, minDelayMs: 180, maxDelayMs: 580 },
  });
  assert.equal(firstTargetMs, 600, 'The first mole appears 0.6 s after the start, as in the original game.');
});

test('a mole is a hit, a miss when it ducks, or a miss when another hole is tapped', async () => {
  const { WhackMatch } = await LoadLogic();
  const match = new WhackMatch('easy', Sequence(0.5, 0.1, 0.95, 0));
  assert.deepEqual([match.gridSize, match.targetMs], [3, 1100]);
  assert.deepEqual(match.tap(4, 900), { accepted: false, outcome: null }, 'A tap with no mole up is ignored, as in the original game.');
  assert.equal(match.show(1000), 4);
  assert.equal(match.show(1100), null, 'Only one mole is up at a time.');
  assert.deepEqual(match.tap(2, 1300), { accepted: true, outcome: 'wrong' });
  assert.equal(match.active, null, 'A wrong tap sends the mole down.');
  assert.equal(match.show(2000), 0);
  match.stampOnset(2016);
  assert.deepEqual(match.tap(0, 2366), { accepted: true, outcome: 'hit' });
  assert.equal(match.show(3000), 8);
  assert.equal(match.expire(4100), true);
  assert.equal(match.expire(4200), false, 'A mole that is already down cannot expire again.');
  assert.deepEqual(match.rows, [
    { trial: 1, outcome: 3, responseMs: null, targetIndex: 4, tappedIndex: 2 },
    { trial: 2, outcome: 1, responseMs: 350, targetIndex: 0, tappedIndex: 0 },
    { trial: 3, outcome: 2, responseMs: null, targetIndex: 8, tappedIndex: null },
  ], 'Response time runs from when the mole is drawn.');
  assert.deepEqual([match.hits, match.misses, match.taps, match.expired, match.wrongTaps, match.shown], [1, 2, 2, 1, 1, 3]);
});

test('the gap before the next mole is drawn from the level range', async () => {
  const { WhackMatch } = await LoadLogic();
  assert.equal(new WhackMatch('easy', () => 0).nextDelay(), 350);
  assert.equal(new WhackMatch('medium', () => 0.5).nextDelay(), 485);
  assert.equal(new WhackMatch('hard', () => 0.999999).nextDelay(), 580);
  assert.equal(new WhackMatch('hard', () => 0.99).show(0), 15, 'The hard board has 16 holes.');
});

test('the summary keeps the original fields and adds the best time, ducked moles and wrong taps', async () => {
  const logic = await LoadLogic();
  const match = new logic.WhackMatch('medium', Sequence(0, 0.5, 0.9));
  match.show(0); match.tap(0, 400);
  match.show(1000); match.tap(4, 1300);
  match.show(2000); match.tap(0, 2100);
  match.show(3000); match.expire(3850);
  assert.deepEqual(logic.SummarizeWhack(match, 60049), { duration: 60, hits: 2, misses: 2, taps: 3, meanMs: 350, bestMs: 300, expired: 1, wrongTaps: 1 });
  const untouched = new logic.WhackMatch('hard', () => 0);
  assert.deepEqual(logic.SummarizeWhack(untouched, 30000), { duration: 30, hits: 0, misses: 0, taps: 0, meanMs: null, bestMs: null, expired: 0, wrongTaps: 0 });
});

test('Target Click results save one numeric row per mole through the private channel', async () => {
  const logic = await LoadLogic();
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/whackAMole': logic });
  const match = new logic.WhackMatch('easy', () => 0);
  match.show(0); match.tap(0, 420);
  const score = BuildGameScore(match, 30000);
  assert.equal(score.gameId, gameId);
  assert.deepEqual(score.rounds, [{ trial: 1, outcome: 1, responseMs: 420, targetIndex: 0, tappedIndex: 0 }]);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, { difficulty: 'easy', durationSec: 30, soundEnabled: true }, score));
});

test('hits and misses each play their own sound, and taps use the pointer-down time', async () => {
  const source = await readFile(resolve(GameRoot(gameId), 'WhackAMoleGame.tsx'), 'utf8');
  assert.match(source, /outcome === 'hit'[^\n]*PlaySuccessSound\(\)/);
  assert.match(source, /outcome === 'wrong'[^\n]*PlayFailureSound\(\)/);
  assert.match(source, /onPointerDown=\{event => tapHole\(index, event\.timeStamp\)\}/);
  assert.match(source, /flushSync\(/, 'The onset is stamped once the mole is in the page.');
});

test('Target Click owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'WhackAMoleGame', category: 'attention', version: '2.0.2' });
});

test('Target Click private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});

async function LoadHoleEffects() {
  const source = await readFile(resolve(GameRoot(gameId), 'fx/holeEffects.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

class FxTarget extends EventTarget {
  matches = false;
  hidden = false;
  baseURI = pathToFileURL(resolve(GameRoot(gameId), 'public/index.html')).href;
  hasFocus = () => true;
}

async function HoleFxFixture(run) {
  const saved = new Map();
  const doc = new FxTarget(), win = new FxTarget(), motion = new FxTarget();
  const frames = new Map(), draws = [], images = [];
  let frameId = 0, now = 0;
  const board = { left: 80, top: 120, width: 600, height: 600 };
  const holes = Array.from({ length: 9 }, (_, index) => ({ getBoundingClientRect: () => ({
    left: board.left + 30 + index % 3 * 190, top: board.top + 30 + Math.floor(index / 3) * 190, width: 160, height: 160,
  }) }));
  const context = {
    clearRect() {},
    createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4), width, height }),
    putImageData: img => images.push(img.data.some((value, index) => index % 4 === 3 && value > 0)),
    drawImage: (...args) => draws.push(args.slice(1)),
  };
  const canvas = { width: 0, height: 0, getContext: () => context, getBoundingClientRect: () => board,
    parentElement: { querySelector: selector => holes[Number(selector.match(/\d+/)?.[0])] } };
  doc.createElement = () => ({ width: 0, height: 0, getContext: () => context });
  win.matchMedia = () => motion;
  win.getComputedStyle = () => ({ getPropertyValue: name => ({ '--hit-edge': '#8a6a00', '--hit': '#f5c518', '--surface': '#ffffff',
    '--hole': '#2b1a10', '--mole': '#9c7b58', '--text-muted': '#606970', '--border': '#d4d9de' })[name] ?? '#ffffff' });
  const globals = { document: doc, window: win, getComputedStyle: win.getComputedStyle,
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; }, cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class { observe() {} disconnect() {} } };
  for (const [name, value] of Object.entries(globals)) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  const step = (ms = 34) => {
    now += ms;
    const pending = [...frames.values()]; frames.clear();
    pending.forEach(callback => callback(now));
  };
  try {
    const { CreateHoleEffects } = await LoadHoleEffects();
    const fx = CreateHoleEffects(canvas);
    try {
      // The runtime assets are local ES modules; let their first import settle before tapping.
      await new Promise(resolve => setTimeout(resolve, 80));
      await run({ fx, motion, doc, win, frames, draws, images, board, step });
    } finally { fx.dispose(); }
  } finally {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
    }
  }
}

test('hole effects stay silent under reduced motion, including live preference changes', async () => {
  await HoleFxFixture(async ({ fx, motion, frames, images, step }) => {
    motion.matches = true;
    motion.dispatchEvent(new Event('change'));
    fx.play(4, 'hit');
    fx.play(3, 'wrong');
    assert.equal(frames.size, 0);
    assert.equal(images.length, 0);
    motion.matches = false;
    motion.dispatchEvent(new Event('change'));
    fx.play(4, 'hit'); step();
    assert.ok(images.some(Boolean), 'A hit actually paints transparent pixels when motion is allowed.');
    motion.matches = true;
    motion.dispatchEvent(new Event('change'));
    assert.equal(frames.size, 0, 'Turning reduce on cancels the pending animation.');
  });
});

test('hit, light dust and each fifth consecutive hit use the tapped DOM hole without touching match records', async () => {
  await HoleFxFixture(async ({ fx, frames, draws, step }) => {
    const { WhackMatch } = await LoadLogic();
    const match = new WhackMatch('easy', () => 0);
    const outcomes = [];
    for (let i = 0; i < 5; i++) {
      match.show(i * 1500);
      outcomes.push(match.tap(0, i * 1500 + 200));
      fx.play(4, 'hit'); step();
      if (i < 4) { for (let n = 0; n < 32; n++) step(); }
    }
    const ordinaryWidth = draws[0][2], comboWidth = draws.at(-1)[2];
    assert.ok(comboWidth > ordinaryWidth, 'Five consecutive hits replace the ordinary burst with a slightly larger collect burst.');
    const [x, y, width, height] = draws.at(-1);
    assert.ok(Math.abs(x + width / 2 - 150) < 0.01, 'The effect center follows the middle DOM hole at half resolution.');
    assert.ok(Math.abs(y + height * 64 / 108 - 143.6) < 0.01, 'The pickup hotspot follows the mole rather than the viewport.');
    assert.ok(outcomes.every(outcome => outcome.accepted));
    assert.equal(match.hits, 5);
    assert.deepEqual(match.rows.map(row => row.responseMs), [200, 200, 200, 200, 200]);
    fx.clear();
    fx.play(4, 'wrong'); step();
    assert.ok(draws.at(-1)[2] < ordinaryWidth, 'Wrong-hole dust is smaller than the success feedback.');
    fx.clear();
    for (let i = 0; i < 4; i++) { fx.play(0, 'hit'); step(); fx.resetStreak(); }
    assert.equal(draws.at(-1)[2], ordinaryWidth, 'A ducked mole resets the cosmetic streak.');
    for (let i = 0; i < 32; i++) step();
    assert.equal(frames.size, 0, 'Each event ends within a second and leaves no idle rAF.');
  });
});

test('blur, hidden page, pause, resize, finish and disposal clear effects without replay', async () => {
  await HoleFxFixture(async ({ fx, win, doc, frames, images, step }) => {
    for (const event of ['blur', 'game:pause', 'resize', 'pagehide']) {
      fx.play(0, 'hit'); step();
      win.dispatchEvent(new Event(event));
      assert.equal(frames.size, 0, event);
      win.dispatchEvent(new Event('focus'));
      win.dispatchEvent(new Event('game:resume'));
      win.dispatchEvent(new Event('pageshow'));
      assert.equal(frames.size, 0, 'Returning never replays old feedback.');
    }
    fx.play(0, 'hit'); step();
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
    fx.play(0, 'hit'); assert.equal(frames.size, 0);
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
    fx.play(0, 'hit'); step(); fx.clear();
    assert.equal(frames.size, 0, 'End clears the held outcome board too.');
    fx.play(0, 'hit'); step(); fx.dispose();
    const count = images.length;
    fx.play(0, 'hit'); win.dispatchEvent(new Event('focus')); step();
    assert.equal(images.length, count);
    assert.equal(frames.size, 0);
  });
});

test('the decorative canvas sits under target shapes, keeps star and X, and is wired only to accepted taps', async () => {
  const source = await readFile(resolve(GameRoot(gameId), 'WhackAMoleGame.tsx'), 'utf8');
  const board = await readFile(resolve(GameRoot(gameId), 'HoleBoard.tsx'), 'utf8');
  const css = await readFile(resolve(GameRoot(gameId), 'game.css'), 'utf8');
  assert.match(board, /<canvas[^>]*className="wm-fx"[^>]*aria-hidden="true"/);
  assert.match(board, /wm-flash-hit/); assert.match(board, /wm-flash-wrong/);
  assert.match(css, /\.wm-fx\s*\{[^}]*pointer-events:\s*none/);
  assert.match(css, /\.wm-fx\s*\{[^}]*image-rendering:\s*pixelated/);
  assert.match(css, /\.wm-hole\s*\{[^}]*z-index:\s*1/);
  assert.match(source, /if \(!tap.accepted \|\| !tap.outcome\) return;[\s\S]*?holeEffectsRef.current\?\.play\(index, tap.outcome\)/);
  assert.match(source, /match\.expire\(performance.now\(\)\)[\s\S]*?holeEffectsRef.current\?\.resetStreak\(\)/);
  assert.ok((source.match(/holeEffectsRef.current\?\.clear\(\)/g) ?? []).length >= 2, 'Stop and time-up clear effects.');
  const end = source.slice(source.indexOf('const end ='), source.indexOf('const showFlash ='));
  assert.ok(end.indexOf('endedAtRef.current = performance.now()') < end.indexOf('holeEffectsRef.current?.clear()'), 'Record the end time before decorative cleanup.');
  assert.match(source, /schedule\(match, match.nextDelay\(\)\);\s*holeEffectsRef.current\?\.play/, 'Schedule the unchanged next target before doing decorative work.');
});

test('vendored pixelfx modules and licenses stay inside this game and all selected effects are one-shots', async () => {
  const vendor = resolve(GameRoot(gameId), 'public/pixelfx');
  const license = await readFile(resolve(vendor, 'LICENSE-pixelfx.md'), 'utf8');
  assert.match(license, /MIT License/); assert.match(license, /Hugo Duprez/); assert.match(license, /Patch/);
  assert.match(await readFile(resolve(vendor, 'NOTICE.md'), 'utf8'), /Sprite Fusion/);
  for (const file of await readdir(vendor, { recursive: true })) {
    if (!file.endsWith('.js')) continue;
    const code = await readFile(resolve(vendor, file), 'utf8');
    assert.doesNotMatch(code, /Math\.random|@rehab-trainer|packages\/ui|https?:\/\/[^\s]*['"]/);
    for (const specifier of code.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)) {
      assert.ok(specifier[1].startsWith('.'), file);
      assert.ok(resolve(vendor, file, '..', specifier[1]).startsWith(vendor), file);
    }
  }
  for (const path of ['impacts/hit-spark', 'impacts/blunt-hit', 'pickups/collect-burst']) {
    const { meta } = await import(pathToFileURL(resolve(vendor, 'fx', `${path}.js`)));
    assert.equal(meta.loop, false, path);
  }
});
