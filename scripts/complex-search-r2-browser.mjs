import assert from 'node:assert/strict';

export const complexSearchBrowserSpec = {
    title: { zh: '視覺搜尋：相似字形', en: 'Visual Search: Complex' },
    trainer: 'vision', purpose: 'vision', phasePrefix: 'search',
    settings: { level: 1, timeLimitMs: 1500, trialsPerBlock: 20, symbolSizeDeg: 1.4, screenWidthCm: 30 },
    tutorialTargets: ['.search-target-circle', '.search-pads', '.search-hud'],
    runningSelector: '.search-running', stopSelector: '.search-stop',
    defaultMetric: 'rtMs', alternateMetric: 'correct', rows: 60,
    async play({ game, until, tap, press, mobile, capture }) {
      const seen = new Set();
      let rests = 0;
      await until(async () => {
        if (await game(`Boolean(document.querySelector('.experiment-results'))`)) return true;
        if (await game(`Boolean(document.querySelector('.search-rest'))`)) {
          assert.equal(await game(`document.activeElement?.classList.contains('search-continue')`), true);
          assert.ok(!await game(`document.querySelector('.search-rest').textContent.includes('請調整畫面')`), `The selected stimuli fit the viewport: ${JSON.stringify(await game(`(() => { const f = document.querySelector('.search-field').getBoundingClientRect(); return { width: f.width, height: f.height, screenWidth: screen.width, state: document.querySelector('.search-field').dataset.state }; })()`))}`);
          rests++;
          if (mobile) await tap('.search-continue'); else await press('Enter', 'Enter', 13);
          await until(() => game(`!document.querySelector('.search-rest')`), 'continue after rest');
          return false;
        }
        const state = await game(`(() => { const field = document.querySelector('.search-field'); return {
          phase: field?.dataset.state, index: Number(field?.dataset.trial), present: field?.dataset.present,
          count: document.querySelectorAll('.search-items .search-item').length }; })()`);
        if (state.phase !== 'target' || !state.index || seen.has(state.index)) return false;
        seen.add(state.index);
        if (state.index === 2) {
          assert.equal(state.count, 8);
          assert.ok(await game(`(() => { const field = document.querySelector('.search-field').getBoundingClientRect(); return [...document.querySelectorAll('.search-item')].every(item => { const r = item.getBoundingClientRect(); return r.left >= field.left && r.right <= field.right && r.top >= field.top && r.bottom <= field.bottom; }); })()`), 'Every glyph fits inside the field.');
          await capture('gameplay');
        }
        if (state.index === 4) return false;
        const response = state.index === 3 ? String(1 - Number(state.present)) : state.present;
        if (mobile) await tap(`.search-pad-${response}`);
        else if (response === '1') await press('f', 'KeyF', 70);
        else await press('ArrowRight', 'ArrowRight', 39);
        return false;
      }, 'three visual search blocks', 150000);
      assert.equal(seen.size, 60); assert.equal(rests, 2);
      return { wrong: 1, timeouts: 1 };
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.equal(Object.keys(summary).length, 12);
      assert.equal(summary.level, 5); assert.equal(summary.passed, 1); assert.equal(summary.blocksPassed, 3);
      assert.deepEqual([summary.accuracy8, summary.accuracy16, summary.accuracy24, summary.accuracy], [90, 100, 100, 96.7]);
      assert.equal(rounds.filter(row => row.response === null).length, plan.timeouts);
      assert.equal(rounds.filter(row => !row.correct).length, plan.wrong + plan.timeouts);
      assert.equal(rounds[2].correct, 0); assert.equal(rounds[3].rtMs, null);
      assert.ok(rounds.filter(row => row.response !== null).every(row => row.rtMs > 0 && row.rtMs < 1500));
      for (const size of [8, 16, 24]) assert.equal(rounds.filter(row => row.setSize === size && row.present).length, 10);
    },
    async results({ game, evaluate, until }) {
      assert.match(await game(`document.querySelector('.search-next-settings').textContent`), /6/);
      await until(async () => {
        const saved = await evaluate(`JSON.parse(localStorage.getItem('trainerhub.game-settings/v1:complex-search') || 'null')`);
        return saved?.level === 2 && saved.timeLimitMs === 1500 && saved.trialsPerBlock === 20;
      }, 'automatic next-level settings stored by the container');
    },
  };
