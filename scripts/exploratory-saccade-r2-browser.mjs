import { CheckFieldGrowth, InstallFieldGrowth, ResizeField } from './vision-field-browser.mjs';
import assert from 'node:assert/strict';

// Installed through the harness's beforeStart hook, never included in the game bundle.
export const saccadeClockFixture = `(() => {
  const originalNow = Object.getOwnPropertyDescriptor(performance, 'now');
  const nativeNow = performance.now.bind(performance), nativeSet = window.setTimeout, nativeClear = window.clearTimeout;
  let offset = 0;
  const timers = new Map(), now = () => nativeNow() + offset;
  Object.defineProperty(performance, 'now', { configurable: true, value: now });
  window.setTimeout = (callback, ms = 0, ...args) => {
    const invoke = () => typeof callback === 'function' ? callback(...args) : (0, eval)(callback);
    const id = nativeSet(() => { timers.delete(id); invoke(); }, ms);
    timers.set(id, { at: now() + ms, invoke }); return id;
  };
  window.clearTimeout = id => { timers.delete(id); nativeClear(id); };
  window.saccadeFixtureClock = {
    advance(ms) {
      const end = now() + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        const [id, timer] = due;
        timers.delete(id); nativeClear(id); offset += Math.max(0, timer.at - now()); timer.invoke();
      }
      offset += Math.max(0, end - now());
    },
    restore() {
      window.setTimeout = nativeSet; window.clearTimeout = nativeClear;
      if (originalNow) Object.defineProperty(performance, 'now', originalNow); else delete performance.now;
      for (const [id, timer] of timers) { nativeClear(id); nativeSet(timer.invoke, Math.max(0, timer.at - now())); }
      timers.clear(); delete window.saccadeFixtureClock;
    },
  };
})()`;

export const exploratorySaccadeBrowserSpec = {
  title: { zh: '探索掃視練習', en: 'Exploratory Saccade Practice' },
  trainer: 'vision', purpose: 'vision', phasePrefix: 'saccade',
  settings: { practiceMinutes: 5, itemsPerScreen: 20, targetsPerScreen: 3, distractors: 'mixed', symbolSizeDeg: 1,
    screenTimeLimitSec: 30, screenWidthCm: 30 },
  tutorialTargets: ['.saccade-target', '.saccade-item[data-target="true"]', '.saccade-hud'],
  runningSelector: '.saccade-running', stopSelector: '.saccade-stop',
  defaultMetric: 'foundMs', alternateMetric: 'found',
  async beforeStart({ game }) { await game(saccadeClockFixture); await InstallFieldGrowth(game, '.saccade-running .saccade-field'); },
  async play({ game, send, inputSession, until, tap, mobile, capture }) {
    await CheckFieldGrowth(game, until);
    const ready = () => until(() => game(`Boolean(document.querySelector('.saccade-running .saccade-field')?.dataset.target)`), 'prepared first screen');
    const restart = async () => {
      await tap('.saccade-layout-error .btn-primary');
      await until(() => game(`Boolean(document.querySelector('form'))`), 'settings after layout error');
      await game(`document.querySelector('form .btn-primary').click()`);
      for (let i = 0; i < 3; i++) {
        await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'restarted spotlight');
        await game(`document.querySelector('.game-tour button').click()`);
      }
      await until(() => game(`Boolean(document.querySelector('.training-confirmation'))`), 'confirmation after layout error');
      await until(async () => {
        if (await game(`Boolean(document.querySelector('.saccade-running'))`)) return true;
        await tap('.training-confirmation .btn-primary');
        return false;
      }, 'restart enters the running scene after fullscreen exit resizes the iframe');
      await ready();
    };
    await ready();
    await ResizeField(game, '.saccade-field');
    await until(() => game(`document.querySelector('.saccade-field')?.dataset.state === 'ready'`), 'resize before the first screen stays ready');
    assert.equal(await game(`Boolean(document.querySelector('.saccade-layout-error'))`), false);
    await game(`(() => { const field = document.querySelector('.saccade-field'); field.style.width = '120px'; field.style.height = '120px'; })()`);
    await game(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    assert.equal(await game(`document.querySelector('.saccade-start')?.disabled`), true, 'A failed layout cannot start using the old screen.');
    await tap('.saccade-start');
    assert.equal(await game(`document.querySelector('.saccade-field')?.dataset.state`), 'ready');
    await until(() => game(`Boolean(document.querySelector('.saccade-layout-error'))`), 'genuinely small field expires the retry window');
    assert.match(await game(`document.querySelector('.saccade-layout-error').textContent`), /請調整顯示設定|Adjust the display settings/);
    await restart();
    await tap('.saccade-start');
    await until(() => game(`document.querySelector('.saccade-field')?.dataset.state === 'search'`), 'first screen started');
    await ResizeField(game, '.saccade-field');
    await until(() => game(`Boolean(document.querySelector('.saccade-layout-error'))`), 'resizing a started screen keeps the existing error flow');
    await restart();
    const plan = { screens: 0, found: 0, missed: 0, falseClicks: 1, targets: [], missedScreens: [] };
    const advance = async ms => game(`window.saccadeFixtureClock.advance(${ms})`);
    const readPhase = () => game(`document.querySelector('.saccade-field')?.dataset.state`);
    const move = async selector => {
      const point = await game(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point }, inputSession);
    };
    try {
      while (!await game(`Boolean(document.querySelector('.experiment-results'))`)) {
        await until(async () => await readPhase() === 'ready', 'central screen start');
        assert.equal(await game(`document.activeElement?.classList.contains('saccade-start')`), true);
        const target = await game(`document.querySelector('.saccade-field').dataset.target`);
        assert.notEqual(target, plan.targets.at(-1)); plan.targets.push(target);
        await tap('.saccade-start');
        await until(async () => await readPhase() === 'search', 'search array');
        const ids = await game(`[...document.querySelectorAll('.saccade-item[data-target="true"]')].map(item => Number(item.dataset.id))`);
        assert.ok(await game(`[...document.querySelectorAll('.saccade-item')].every(item => item.tabIndex === -1)`));
        assert.ok(await game(`document.querySelector('.saccade-stop').tabIndex >= 0`));
        assert.equal(ids.length, 3);
        if (plan.screens === 0) {
          assert.match(await game(`getComputedStyle(document.querySelector('.saccade-item')).fontFamily`), /system-ui/);
          assert.equal(await game(`getComputedStyle(document.querySelector('.saccade-item')).fontWeight`), '800');
          await capture('gameplay');
          await tap('.saccade-item[data-target="false"]');
        }
        const findIds = plan.screens === 0 ? ids : ids.slice(0, -1);
        for (const id of findIds) {
          const selector = `.saccade-item[data-id="${id}"]`;
          if (mobile) await tap(selector); else await move(selector);
          await until(() => game(`document.querySelector('${selector}')?.dataset.found === 'true'`), `target ${id} marked`);
          // A second pointer activation on the same digit cannot count again.
          await tap(selector);
          plan.found++;
        }
        plan.screens++;
        if (plan.screens === 1) {
          assert.equal(await readPhase(), 'complete'); await advance(600);
        } else {
          await advance(30000);
          await until(async () => await readPhase() === 'missed', 'timeout outlines the missed digit');
          assert.equal(await game(`Boolean(document.querySelector('.saccade-field .saccade-message'))`), false, 'Feedback text leaves the missed digits visible.');
          const missing = await game(`document.querySelectorAll('.saccade-item[data-missed="true"]').length`);
          assert.equal(missing, 1); plan.missed++; plan.missedScreens.push(plan.screens);
          if (plan.screens === 2) await capture('missed-target');
          await advance(1500);
        }
        await until(async () => await readPhase() === 'ready' || await game(`Boolean(document.querySelector('.experiment-results'))`), 'next start or session results');
        assert.ok(plan.screens <= 12, 'The five-minute session finishes after the current screen.');
      }
      return plan;
    } finally { await game(`window.saccadeFixtureClock?.restore()`); }
  },
  verify(saved, plan) {
    const { summary, rounds } = saved.score;
    assert.equal(Object.keys(summary).length, 12);
    assert.equal(summary.screens, plan.screens);
    assert.equal(summary.targets, plan.screens * 3);
    assert.equal(summary.found, plan.found); assert.equal(summary.missed, plan.missed);
    assert.equal(summary.falseClicks, 1, 'The pointerdown/click pair is one false click.');
    assert.ok(summary.searchSeconds >= 300 && summary.searchSeconds < 331);
    assert.ok(summary.meanScreenMs > 0 && summary.meanTargetMs > 0);
    assert.equal(rounds.length, plan.screens * 3);
    assert.equal(summary.leftMissed + summary.rightMissed, plan.missed);
    assert.ok(rounds.every(row => Object.keys(row).length === 11 && (row.found ? row.foundMs >= 0 && row.intervalMs >= 0 && row.order >= 1
      : row.foundMs === null && row.intervalMs === null && row.order === null)));
    for (let screen = 1; screen <= plan.screens; screen++) {
      const rows = rounds.filter(row => row.screen === screen);
      assert.equal(rows.length, 3); assert.ok(rows.every(row => row.target === Number(plan.targets[screen - 1])));
      assert.ok(rows.every(row => row.screenFalseClicks === (screen === 1 ? 1 : 0)));
      assert.equal(rows.filter(row => !row.found).length, screen === 1 ? 0 : 1);
    }
  },
};
