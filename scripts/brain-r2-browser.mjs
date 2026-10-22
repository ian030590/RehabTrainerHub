import assert from 'node:assert/strict';
import { CheckConfirmationPresentation } from './r2-game-ui-browser.mjs';
import { CheckResultsPresentation } from './r2-game-results-browser.mjs';
import { migratedBrainGameSpecs } from './migrated-brain-r2-browser.mjs';

// Per-game drivers for the R2 brain activities. Each one sets a short session, plays it with real
// browser input and states what the saved record must contain.
export const brainGameSpecs = {
  sart: {
    title: { zh: '持續注意反應（SART）', en: 'Sustained Attention to Response (SART)' },
    purpose: 'attention',
    settings: { trials: 45, noGoDigit: 3, digitMs: 150, maskMs: 600 },
    tutorialTargets: ['.sart-stimulus', '.sart-response-pad', '.sart-hud'],
    runningSelector: '.sart-running',
    stopSelector: '.sart-stop',
    defaultMetric: 'rtMs', alternateMetric: 'correct',
    async play({ game, until, press, tap, mobile, capture }) {
      // Press every digit except 3, but skip the fifth go digit and press on the first 3.
      const plan = { seen: new Set(), goCount: 0, pressedNoGo: false, skipped: 0, wrong: 0 };
      await until(async () => {
        if (await game(`Boolean(document.querySelector('.experiment-results'))`)) return true;
        const state = await game(`(() => { const label = document.querySelector('.sart-progress-label')?.textContent ?? '';
          const index = Number((label.match(/\\d+/) ?? [0])[0]);
          return { index, digit: document.querySelector('.sart-stimulus')?.textContent ?? '',
            shown: document.querySelector('.sart-stimulus-area')?.dataset.state !== 'ready' }; })()`);
        if (!state.shown || !state.index || plan.seen.has(state.index)) return false;
        plan.seen.add(state.index);
        if (state.index === 2) await capture('gameplay');
        if (state.digit === '3') {
          if (!plan.pressedNoGo) { plan.pressedNoGo = true; plan.wrong++; await (mobile ? tap('.sart-response-pad') : press(' ', 'Space', 32)); }
          return false;
        }
        plan.goCount++;
        if (plan.goCount === 5) { plan.skipped++; return false; }
        await (mobile ? tap('.sart-response-pad') : press(' ', 'Space', 32));
        return false;
      }, 'SART digit stream', 90000);
      assert.equal(plan.seen.size, 45, 'Every digit was seen by the driver.');
      return plan;
    },
    verify(saved, plan) {
      assert.equal(saved.score.summary.trials, 45);
      assert.equal(saved.score.summary.noGoTrials, 5);
      assert.equal(saved.score.summary.commissionErrors, plan.wrong);
      assert.equal(saved.score.summary.omissionErrors, plan.skipped);
      assert.equal(saved.score.rounds.length, 45);
      assert.ok(saved.score.rounds.filter(row => row.responded).every(row => row.rtMs > 0 && row.rtMs < 750));
      assert.ok(saved.score.summary.meanGoRtMs > 0);
    },
    rows: 45,
  },
  'schulte-grid': {
    title: { zh: '舒爾特方格', en: 'Schulte Grid' },
    purpose: 'attention',
    settings: { gridSize: 3, rounds: 2, order: 'ascending', markFound: true },
    tutorialTargets: ['.schulte-cell[data-start="true"]', '.schulte-next', '.schulte-hud'],
    runningSelector: '.schulte-running',
    stopSelector: '.schulte-stop',
    defaultMetric: 'timeMs', alternateMetric: 'errors',
    async play({ game, until, tap, press, capture }) {
      const cell = value => `.schulte-cell[aria-label="${value}"]`;
      const next = () => game(`document.querySelector('.schulte-next strong').textContent`);
      await until(() => game(`Boolean(document.querySelector('${cell(1)}'))`), 'first grid');
      await capture('gameplay');
      await tap(cell(5));
      await until(() => game(`document.querySelector('.schulte-feedback').textContent.includes('5')`), 'wrong tap feedback');
      assert.equal(await game(`document.querySelector('${cell(5)}').dataset.wrong`), 'true', 'The wrong cell is outlined as well as described.');
      for (let value = 1; value <= 9; value++) {
        await tap(cell(value));
        if (value < 9) await until(async () => await next() === String(value + 1), `next is ${value + 1}`);
      }
      await until(() => game(`Boolean(document.querySelector('.schulte-interlude'))`), 'round interlude');
      assert.equal(await game(`document.activeElement?.classList.contains('schulte-next-round')`), true, 'Next round takes focus.');
      await capture('interlude');
      await tap('.schulte-next-round');
      await until(async () => !await game(`Boolean(document.querySelector('.schulte-interlude'))`) && await next() === '1', 'second round');
      await game(`document.querySelector('${cell(1)}').focus()`);
      await press('Enter', 'Enter', 13);
      await until(async () => await next() === '2', 'keyboard activates a cell');
      for (let value = 2; value <= 9; value++) {
        await tap(cell(value));
        if (value < 9) await until(async () => await next() === String(value + 1), `round 2 next is ${value + 1}`);
      }
      return { wrong: 1 };
    },
    verify(saved, plan) {
      assert.equal(saved.score.rounds.length, 2);
      assert.deepEqual(saved.score.rounds.map(row => [row.round, row.gridSize, row.errors]), [[1, 3, plan.wrong], [2, 3, 0]]);
      assert.ok(saved.score.rounds.every(row => row.timeMs > 0 && row.meanStepMs === Math.round(row.timeMs / 9)));
      assert.equal(saved.score.summary.totalErrors, plan.wrong);
      assert.equal(saved.score.summary.roundsCompleted, 2);
    },
    rows: 2,
  },
  'hex-schulte': {
    title: { zh: '六角舒爾特方格', en: 'Hexagon Schulte Grid' },
    purpose: 'attention',
    settings: { rings: 2, rounds: 2, centerChecks: true },
    tutorialTargets: ['.hex-center', '.hex-cell[data-start="true"]', '.hex-hud'],
    runningSelector: '.hex-running',
    stopSelector: '.hex-stop',
    defaultMetric: 'timeMs', alternateMetric: 'errors',
    async play({ game, until, tap, press, capture }) {
      const cell = value => `.hex-cell[aria-label="${value}"]`;
      const next = () => game(`document.querySelector('.hex-next strong').textContent`);
      await until(() => game(`Boolean(document.querySelector('${cell(1)}'))`), 'first board');
      assert.equal(await game(`document.querySelectorAll('.hex-cell').length`), 18);
      assert.ok(await game(`(() => {
        const boxes = [...document.querySelectorAll('.hex-cell, .hex-center')].map(item => item.getBoundingClientRect());
        return boxes.every(box => box.left >= 0 && box.top >= 0 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1 && box.width >= 40);
      })()`), 'Every hexagon fits the screen and stays large enough to tap.');
      await capture('gameplay');
      await tap(cell(5));
      await until(() => game(`document.querySelector('.hex-feedback').textContent.includes('5')`), 'wrong tap feedback');
      assert.equal(await game(`document.querySelector('${cell(5)}').dataset.wrong`), 'true', 'The wrong hexagon is marked as well as described.');
      await until(() => game(`Boolean(document.querySelector('.hex-center[data-lit]'))`), 'centre check lights up', 10000);
      await capture('centre-check');
      await tap('.hex-center');
      await until(() => game(`!document.querySelector('.hex-center[data-lit]')`), 'centre check answered');
      for (let value = 1; value <= 18; value++) {
        await tap(cell(value));
        if (value < 18) await until(async () => await next() === String(value + 1), `next is ${value + 1}`);
      }
      await until(() => game(`Boolean(document.querySelector('.hex-interlude'))`), 'round interlude');
      assert.equal(await game(`document.activeElement?.classList.contains('hex-next-round')`), true, 'Next round takes focus.');
      await capture('interlude');
      await tap('.hex-next-round');
      await until(async () => !await game(`Boolean(document.querySelector('.hex-interlude'))`) && await next() === '1', 'second round');
      const start = await game(`(() => { const left = [...document.querySelectorAll('.hex-cell')].find(item => item.dataset.q === '-1' && item.dataset.r === '0'); left.focus(); return left.getAttribute('aria-label'); })()`);
      await press('ArrowRight', 'ArrowRight', 39);
      assert.equal(await game(`document.activeElement?.className`), 'hex-center', `Arrow right from ${start} moves to the centre.`);
      await press('ArrowRight', 'ArrowRight', 39);
      assert.deepEqual(await game(`[document.activeElement?.dataset.q, document.activeElement?.dataset.r]`), ['1', '0'], 'Arrow keys move along the row.');
      await game(`document.querySelector('${cell(1)}').focus()`);
      await press('Enter', 'Enter', 13);
      await until(async () => await next() === '2', 'keyboard activates a hexagon');
      for (let value = 2; value <= 18; value++) {
        await tap(cell(value));
        if (value < 18) await until(async () => await next() === String(value + 1), `round 2 next is ${value + 1}`);
      }
      return { wrong: 1 };
    },
    verify(saved, plan) {
      const [first, second] = saved.score.rounds;
      assert.equal(saved.score.rounds.length, 2);
      assert.deepEqual(saved.score.rounds.map(row => [row.round, row.rings, row.errors]), [[1, 2, plan.wrong], [2, 2, 0]]);
      assert.ok(first.centerHits >= 1, 'The centre tap in round 1 is counted.');
      assert.ok(saved.score.rounds.every(row => row.timeMs > 0 && row.centerHits + row.centerMissed === row.centerChecks));
      assert.ok(second.timeMs > 0);
      assert.equal(saved.score.summary.totalErrors, plan.wrong);
      assert.equal(saved.score.summary.roundsCompleted, 2);
    },
    rows: 2,
  },
  'continuous-performance': {
    title: { zh: '連續表現作業（CPT）', en: 'Continuous Performance Task (CPT)' },
    purpose: 'attention',
    settings: { variant: 'ax', trials: 100, targetPercent: 10, letterMs: 100, isiMs: 800 },
    tutorialTargets: ['.cpt-stimulus', '.cpt-response-pad', '.cpt-hud'],
    runningSelector: '.cpt-running',
    stopSelector: '.cpt-stop',
    defaultMetric: 'rtMs', alternateMetric: 'correct',
    async play({ game, until, press, tap, mobile, capture }) {
      // Press for X after A except the second one, and press once on an X that follows another letter.
      const plan = { letters: [], targets: 0, skipped: 0, trapPresses: 0 };
      const respond = () => mobile ? tap('.cpt-response-pad') : press(' ', 'Space', 32);
      await until(async () => {
        if (await game(`Boolean(document.querySelector('.experiment-results'))`)) return true;
        const state = await game(`(() => { const label = document.querySelector('.cpt-progress-label')?.textContent ?? '';
          return { index: Number((label.match(/\\d+/) ?? [0])[0]), letter: document.querySelector('.cpt-stimulus')?.textContent ?? '' }; })()`);
        if (!state.index || plan.letters[state.index - 1]) return false;
        assert.equal(plan.letters.length, state.index - 1, 'The driver saw every letter.');
        plan.letters.push(state.letter);
        if (state.index === 2) await capture('gameplay');
        if (state.letter !== 'X') return false;
        if (plan.letters.at(-2) === 'A') {
          plan.targets++;
          if (plan.targets === 2) { plan.skipped++; return false; }
          await respond();
        } else if (!plan.trapPresses) { plan.trapPresses++; await respond(); }
        return false;
      }, 'CPT letter stream', 120000);
      assert.equal(plan.letters.length, 100);
      return plan;
    },
    verify(saved, plan) {
      const summary = saved.score.summary;
      assert.equal(saved.score.rounds.length, 100);
      assert.deepEqual([summary.trials, summary.targets, summary.hits, summary.omissions], [100, 10, 10 - plan.skipped, plan.skipped]);
      assert.equal(summary.commissions, plan.trapPresses);
      assert.equal(summary.nearMissPresses, plan.trapPresses);
      assert.deepEqual(saved.score.rounds.map(row => String.fromCharCode(row.letterCode)), plan.letters);
      assert.ok(saved.score.rounds.filter(row => row.responded).every(row => row.rtMs > 0 && row.rtMs < 900));
    },
    rows: 100,
  },
  stroop: {
    title: { zh: '色彩干擾抑制（Stroop）', en: 'Color Word Interference (Stroop)' },
    purpose: 'attention',
    settings: { responseWindowMs: 1000, rounds: 12, practice: true },
    tutorialTargets: ['.stroop-word', '.stroop-pads', '.stroop-hud'],
    runningSelector: '.stroop-running',
    stopSelector: '.stroop-stop',
    defaultMetric: 'responseMs', alternateMetric: 'correct',
    async play({ game, until, press, tap, mobile, capture }) {
      // Answer the ink color, except counted item 3 gets a wrong color and counted item 5 gets no answer.
      const plan = { seen: [], labels: new Set(), wrong: 0, missed: 0, sawBreak: false };
      const keys = { red: ['r', 'KeyR', 82], green: ['g', 'KeyG', 71], blue: ['b', 'KeyB', 66] };
      const answer = async color => mobile ? tap(`.stroop-pad[data-color="${color}"]`) : press(...keys[color]);
      await until(async () => {
        if (await game(`Boolean(document.querySelector('.experiment-results'))`)) return true;
        const state = await game(`(() => { const word = document.querySelector('.stroop-word');
          return { label: document.querySelector('.stroop-progress-label')?.textContent ?? '', ink: word?.dataset.ink, text: word?.textContent,
            state: document.querySelector('.stroop-stimulus-area')?.dataset.state }; })()`);
        if (state.state === 'break') plan.sawBreak = true;
        if (state.state !== 'word' || plan.labels.has(state.label)) return false;
        plan.labels.add(state.label);
        const practice = /練習|Practice/.test(state.label);
        const number = Number((state.label.match(/\d+/) ?? [0])[0]);
        plan.seen.push({ ...state, practice, number });
        if (!practice && number === 2) await capture('gameplay');
        if (!practice && number === 5) { plan.missed++; return false; }
        if (!practice && number === 3) { plan.wrong++; await answer(state.ink === 'red' ? 'green' : 'red'); return false; }
        await answer(state.ink);
        return false;
      }, 'Stroop word stream', 150000);
      assert.equal(plan.seen.length, 36, 'Every practice and counted word was seen by the driver.');
      assert.ok(plan.sawBreak, 'A break separates practice from the counted items.');
      assert.deepEqual(plan.seen.map(item => item.practice), [...Array(24).fill(true), ...Array(12).fill(false)]);
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      const colors = ['red', 'green', 'blue'];
      assert.equal(rounds.length, 36);
      assert.deepEqual(rounds.map(row => row.practice), [...Array(24).fill(1), ...Array(12).fill(0)]);
      assert.deepEqual(rounds.map(row => colors[row.color]), plan.seen.map(item => item.ink));
      assert.deepEqual([summary.trials, summary.correct, summary.misses], [12, 12 - plan.wrong - plan.missed, plan.missed]);
      assert.equal(rounds[28].response, null);
      assert.equal(rounds[26].correct, 0);
      assert.ok(rounds.every(row => row.setting === 1000));
      assert.ok(rounds.filter(row => row.response !== null).every(row => row.responseMs > 0 && row.responseMs < 1000));
    },
    rows: 36,
  },
  flanker: {
    title: { zh: '側翼干擾選擇（Flanker）', en: 'Flanker Selective Attention' },
    purpose: 'attention',
    // Phones run the letter version so both symbol sets get a real session.
    settings: { stimulus: process.argv.includes('--mobile') ? 'letters' : 'arrows', responseWindowMs: 1000, rounds: 20, practice: true },
    tutorialTargets: ['.flanker-row', '.flanker-pads', '.flanker-hud'],
    runningSelector: '.flanker-running',
    stopSelector: '.flanker-stop',
    defaultMetric: 'responseMs', alternateMetric: 'correct',
    async play({ game, until, press, tap, mobile, capture }) {
      // Answer the middle arrow, except counted item 3 gets the wrong side and counted item 5 gets no answer.
      const plan = { seen: [], labels: new Set(), wrong: 0, missed: 0, sawBreak: false };
      const answer = async side => mobile ? tap(`.flanker-pad-${side}`) : side === 'left' ? press('ArrowLeft', 'ArrowLeft', 37) : press('j', 'KeyJ', 74);
      await until(async () => {
        if (await game(`Boolean(document.querySelector('.experiment-results'))`)) return true;
        const state = await game(`(() => { const row = document.querySelector('.flanker-row');
          return { label: document.querySelector('.flanker-progress-label')?.textContent ?? '', target: row?.dataset.target,
            congruent: row?.dataset.congruent, arrows: row ? [...row.querySelectorAll('.flanker-item')].map(item => item.dataset.dir).join(',') : '',
            state: document.querySelector('.flanker-stimulus-area')?.dataset.state }; })()`);
        if (state.state === 'break') plan.sawBreak = true;
        if (state.state !== 'target' || plan.labels.has(state.label)) return false;
        plan.labels.add(state.label);
        const practice = /練習|Practice/.test(state.label);
        const number = Number((state.label.match(/\d+/) ?? [0])[0]);
        assert.equal(state.arrows.split(',')[2], state.target, 'The middle arrow is the answer.');
        plan.seen.push({ ...state, practice, number });
        if (!practice && number === 2) await capture('gameplay');
        if (!practice && number === 5) { plan.missed++; return false; }
        if (!practice && number === 3) { plan.wrong++; await answer(state.target === 'left' ? 'right' : 'left'); return false; }
        await answer(state.target);
        return false;
      }, 'Flanker arrow stream', 150000);
      assert.equal(plan.seen.length, 32, 'Every practice and counted row was seen by the driver.');
      assert.ok(plan.sawBreak, 'A break separates practice from the counted items.');
      assert.deepEqual(plan.seen.map(item => item.practice), [...Array(12).fill(true), ...Array(20).fill(false)]);
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.equal(rounds.length, 32);
      assert.deepEqual(rounds.map(row => row.practice), [...Array(12).fill(1), ...Array(20).fill(0)]);
      assert.deepEqual(rounds.map(row => [row.target, row.condition]), plan.seen.map(item => [item.target === 'left' ? 0 : 1, item.congruent === 'true' ? 0 : 1]));
      assert.deepEqual([summary.trials, summary.correct, summary.misses], [20, 20 - plan.wrong - plan.missed, plan.missed]);
      assert.equal(rounds[16].response, null);
      assert.equal(rounds[14].correct, 0);
      assert.ok(rounds.filter(row => row.response !== null).every(row => row.responseMs > 0 && row.responseMs < 1000));
    },
    rows: 32,
  },
  'attention-network-task': {
    title: { zh: '注意力網絡練習（ANT）', en: 'Attention Network Task (ANT)' },
    purpose: 'attention',
    settings: { responseWindowMs: 1000, rounds: 48, practice: true },
    tutorialTargets: ['.ant-slot-center', '.ant-row-up', '.ant-pads', '.ant-hud'],
    runningSelector: '.ant-running',
    stopSelector: '.ant-stop',
    defaultMetric: 'responseMs', alternateMetric: 'correct',
    async play({ game, until, press, tap, mobile, capture }) {
      // Answer the middle arrow, with a wrong side on practice item 2 and no answer on counted item 3.
      const plan = { seen: [], labels: new Set(), rests: 0, practiceSlip: null };
      const answer = async side => mobile ? tap(`.ant-pad-${side}`) : side === 'left' ? press('ArrowLeft', 'ArrowLeft', 37) : press('ArrowRight', 'ArrowRight', 39);
      await until(async () => {
        if (await game(`Boolean(document.querySelector('.experiment-results'))`)) return true;
        const state = await game(`(() => { const area = document.querySelector('.ant-stimulus-area');
          const row = area && document.querySelector('.ant-row-' + area.dataset.location);
          return { label: document.querySelector('.ant-progress-label')?.textContent ?? '', state: area?.dataset.state, cue: area?.dataset.cue, location: area?.dataset.location,
            target: row?.dataset.target, condition: row?.dataset.condition, kinds: row ? [...row.querySelectorAll('.ant-item')].map(item => item.dataset.kind).join(',') : '',
            visible: row ? getComputedStyle(row).visibility : '', rest: Boolean(document.querySelector('.ant-rest')) }; })()`);
        if (state.rest) {
          plan.rests++;
          await capture('rest');
          if (mobile) await tap('.ant-continue'); else await press('Enter', 'Enter', 13);
          await until(async () => !(await game(`Boolean(document.querySelector('.ant-rest'))`)), 'rest closes');
          return false;
        }
        if (state.state !== 'target' || plan.labels.has(state.label)) return false;
        plan.labels.add(state.label);
        assert.equal(state.visible, 'visible', 'The row shows at its own position.');
        assert.equal(state.kinds.split(',')[2], state.target, 'The middle item is the target arrow.');
        const practice = /練習|Practice/.test(state.label);
        const number = Number((state.label.match(/(\d+)\s*(?:of|／|\/)\s*\d+$/) ?? [0, 0])[1]);
        plan.seen.push({ ...state, practice, number });
        if (!practice && number === 2) await capture('gameplay');
        if (!practice && number === 3) return false;
        if (practice && number === 2) {
          await answer(state.target === 'left' ? 'right' : 'left');
          await until(async () => (plan.practiceSlip = await game(`document.querySelector('.ant-stimulus-area')?.dataset.state === 'feedback' ? document.querySelector('.ant-feedback')?.dataset.result ?? '' : ''`)) !== '', 'practice feedback', 4000);
          return false;
        }
        await answer(state.target);
        return false;
      }, 'ANT arrow stream', 420000);
      assert.equal(plan.seen.length, 72, 'Every practice and counted row was seen by the driver.');
      assert.equal(plan.rests, 1, 'A rest follows practice.');
      assert.equal(plan.practiceSlip, 'wrong');
      assert.deepEqual(plan.seen.map(item => item.practice), [...Array(24).fill(true), ...Array(48).fill(false)]);
      assert.deepEqual(['nocue', 'center', 'double', 'spatial'].map(cue => plan.seen.slice(0, 24).filter(item => item.cue === cue).length), [6, 6, 6, 6]);
      assert.equal(new Set(plan.seen.slice(24).map(item => [item.location, item.cue, item.condition, item.target].join('/'))).size, 48,
        'The counted block holds every combination once.');
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      const cues = ['nocue', 'center', 'double', 'spatial'], conditions = ['neutral', 'congruent', 'incongruent'];
      assert.equal(rounds.length, 72);
      assert.deepEqual(rounds.map(row => [cues[row.cue], row.location ? 'down' : 'up', conditions[row.condition], row.target ? 'right' : 'left']),
        plan.seen.map(item => [item.cue, item.location, item.condition, item.target]));
      assert.deepEqual([summary.trials, summary.misses, summary.correct], [48, 1, 47]);
      assert.equal(rounds[26].response, null);
      assert.equal(rounds[1].correct, 0);
      assert.ok(rounds.every(row => row.setting === 1000));
    },
    rows: 72,
  },
  'n-back': {
    title: { zh: '工作記憶更新（N-back）', en: 'Working Memory Updating (N-back)' },
    purpose: 'memory',
    settings: { exposureMs: 500, rounds: 100, practice: true },
    tutorialTargets: ['.n-back-letter', '.n-back-rule', '.n-back-pads', '.n-back-progress-track'],
    runningSelector: '.n-back-running',
    stopSelector: '.n-back-stop',
    defaultMetric: 'responseMs', alternateMetric: 'correct',
    async play({ game, until, press, tap, mobile, capture }) {
      // Tracks the letters of each part and answers by the shown rule, with a wrong answer on practice letter 2
      // and no answer on counted letter 3. Desktop uses the left arrow for "same" and J for "different".
      const plan = { seen: [], labels: new Set(), intros: [], practiceSlip: null, history: [] };
      const answer = async same => mobile ? tap(same ? '.n-back-pad-same' : '.n-back-pad-different') : same ? press('ArrowLeft', 'ArrowLeft', 37) : press('j', 'KeyJ', 74);
      const loadOf = rule => /t/i.test(rule) && !/\d/.test(rule) ? 0 : Number((rule.match(/\d/) ?? [1])[0]);
      await until(async () => {
        if (await game(`Boolean(document.querySelector('.experiment-results'))`)) return true;
        const state = await game(`(() => ({ label: document.querySelector('.n-back-progress-label')?.textContent ?? '', state: document.querySelector('.n-back-stimulus-area')?.dataset.state,
          letter: document.querySelector('.n-back-letter')?.textContent ?? '', rule: document.querySelector('.n-back-rule')?.textContent ?? '',
          intro: document.querySelector('.n-back-intro h3')?.textContent ?? null, introRule: document.querySelector('.n-back-intro-rule')?.textContent ?? '' }))()`);
        if (state.intro !== null) {
          plan.intros.push({ heading: state.intro, rule: state.introRule });
          plan.history = [];
          await capture(`intro-${plan.intros.length}`);
          if (mobile) await tap('.n-back-continue'); else await press('Enter', 'Enter', 13);
          await until(async () => !(await game(`Boolean(document.querySelector('.n-back-intro'))`)), 'intro closes');
          return false;
        }
        if (!['target', 'waiting'].includes(state.state) || plan.labels.has(state.label)) return false;
        plan.labels.add(state.label);
        const practice = /練習|Practice/.test(state.label);
        const number = Number((state.label.match(/(\d+)\s*(?:of|／|\/)\s*\d+$/) ?? [0, 0])[1]);
        if (number === 1 && practice) plan.history = [];
        const load = loadOf(state.rule);
        const back = plan.history[plan.history.length - load];
        const match = load === 0 ? state.letter.toLowerCase() === 't' : Boolean(back) && back.toLowerCase() === state.letter.toLowerCase();
        plan.history.push(state.letter);
        plan.seen.push({ practice, number, load, letter: state.letter, match });
        if (!practice && number === 2) await capture('gameplay');
        if (!practice && plan.seen.filter(item => !item.practice).length === 3) return false;
        if (practice && number === 2) {
          await answer(!match);
          await until(async () => (plan.practiceSlip = await game(`document.querySelector('.n-back-stimulus-area')?.dataset.state === 'feedback' ? document.querySelector('.n-back-feedback')?.dataset.result ?? '' : ''`)) !== '', 'practice feedback', 4000);
          return false;
        }
        await answer(match);
        return false;
      }, 'N-back letter stream', 420000);
      assert.equal(plan.seen.length, 125, 'Every practice and counted letter was seen by the driver.');
      assert.equal(plan.intros.length, 2, 'An intro screen comes before each counted block.');
      assert.equal(plan.practiceSlip, 'wrong');
      assert.deepEqual(plan.seen.map(item => item.practice), [...Array(25).fill(true), ...Array(100).fill(false)]);
      assert.ok(plan.seen.slice(0, 25).every(item => item.load === 1), 'Practice compares one letter back.');
      assert.equal(plan.seen.slice(0, 25).filter(item => item.match).length, 5);
      for (const block of [0, 1]) {
        const items = plan.seen.slice(25 + block * 50, 75 + block * 50);
        assert.equal(new Set(items.map(item => item.load)).size, 1, 'The rule stays the same within a block.');
        assert.equal(items.filter(item => item.match).length, 10, 'One in five letters is a match.');
        assert.ok(plan.intros[block].heading.includes(items[0].load === 0 ? (/Next/.test(plan.intros[block].heading) ? 'Find t' : '找 t') : String(items[0].load)),
          'The intro names the rule of the block that follows.');
      }
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.equal(rounds.length, 125);
      assert.deepEqual(rounds.map(row => [row.practice, row.load, 'bBdDgGtTvV'[row.letter], row.match]),
        plan.seen.map(item => [Number(item.practice), item.load, item.letter, Number(item.match)]));
      assert.deepEqual([summary.trials, summary.misses, summary.correct], [100, 1, 99]);
      assert.equal(rounds[27].response, null);
      assert.equal(rounds[1].correct, 0);
      assert.ok(rounds.every(row => row.setting === 500));
    },
    rows: 125,
  },
  'number-letter': {
    title: { zh: '數字字母切換（Number-Letter）', en: 'Number-Letter Task' },
    purpose: 'higher-cognition',
    settings: { responseWindowMs: 1500, rounds: 96, practice: true },
    tutorialTargets: ['.number-letter-pair', '.number-letter-half-top', '.number-letter-half-bottom', '.number-letter-pads', '.number-letter-progress-track'],
    runningSelector: '.number-letter-running',
    stopSelector: '.number-letter-stop',
    defaultMetric: 'responseMs', alternateMetric: 'correct',
    async play({ game, until, press, tap, mobile, capture }) {
      // Answers by position (top: number parity, bottom: consonant or vowel), wrong on practice item 2, no answer on counted item 3.
      const plan = { seen: [], labels: new Set(), intros: [], practiceSlip: null };
      const answer = async key => mobile ? tap(`.number-letter-pad-${key}`) : key === 'z' ? press('z', 'KeyZ', 90) : press('m', 'KeyM', 77);
      const expected = (pair, position) => position.startsWith('top') ? (Number(pair[1]) % 2 ? 'z' : 'm') : ('AEIU'.includes(pair[0]) ? 'm' : 'z');
      await until(async () => {
        if (await game(`Boolean(document.querySelector('.experiment-results'))`)) return true;
        const state = await game(`(() => { const board = document.querySelector('.number-letter-running .number-letter-board');
          return { label: document.querySelector('.number-letter-progress-label')?.textContent ?? '', state: board?.dataset.state, position: board?.dataset.position,
            pair: board?.querySelector('.number-letter-pair')?.textContent ?? '', visible: board ? getComputedStyle(board.querySelector('.number-letter-pair')).visibility : '',
            intro: document.querySelector('.number-letter-intro h3')?.textContent ?? null }; })()`);
        if (state.intro !== null) {
          plan.intros.push(state.intro);
          await capture(`intro-${plan.intros.length}`);
          if (mobile) await tap('.number-letter-continue'); else await press('Enter', 'Enter', 13);
          await until(async () => !(await game(`Boolean(document.querySelector('.number-letter-intro'))`)), 'intro closes');
          return false;
        }
        if (state.state !== 'target' || plan.labels.has(state.label)) return false;
        plan.labels.add(state.label);
        assert.equal(state.visible, 'visible');
        const practice = /練習|Practice/.test(state.label);
        const number = Number((state.label.match(/(\d+)\s*(?:of|／|\/)\s*\d+$/) ?? [0, 0])[1]);
        const key = expected(state.pair, state.position);
        plan.seen.push({ practice, number, pair: state.pair, position: state.position, key });
        if (!practice && plan.seen.length === 14) await capture('gameplay');
        if (!practice && plan.seen.length === 15) return false;
        if (practice && number === 2) {
          await answer(key === 'z' ? 'm' : 'z');
          await until(async () => (plan.practiceSlip = await game(`document.querySelector('.number-letter-running .number-letter-board')?.dataset.state === 'feedback' ? document.querySelector('.number-letter-feedback')?.dataset.result ?? '' : ''`)) !== '', 'practice feedback', 4000);
          await capture('practice-feedback');
          return false;
        }
        await answer(key);
        return false;
      }, 'number-letter pairs', 420000);
      const clockwise = ['topleft', 'topright', 'bottomright', 'bottomleft'];
      const turning = items => items.every((item, index) => !index || clockwise.indexOf(item.position) === (clockwise.indexOf(items[index - 1].position) + 1) % 4);
      assert.equal(plan.seen.length, 108, 'Every practice and counted item was seen by the driver.');
      assert.equal(plan.intros.length, 3, 'Each counted part starts with its rule.');
      assert.equal(plan.practiceSlip, 'wrong');
      assert.deepEqual(plan.seen.map(item => item.practice), [...Array(12).fill(true), ...Array(96).fill(false)]);
      assert.ok(turning(plan.seen.slice(0, 12)) && turning(plan.seen.slice(76)), 'Practice and the switching part turn clockwise.');
      assert.ok(plan.seen.slice(12, 44).every(item => item.position.startsWith('top')), 'The number part stays on top.');
      assert.ok(plan.seen.slice(44, 76).every(item => item.position.startsWith('bottom')), 'The letter part stays below.');
      assert.ok(plan.seen.every(item => /^[GKMRAEIU][2-9]$/.test(item.pair)));
      [/數字題|Numbers/, /字母題|Letters/, /上下切換|Switching/].forEach((rule, index) => assert.match(plan.intros[index], rule));
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.equal(rounds.length, 108);
      assert.deepEqual(rounds.map(row => [row.practice, row.top, 'GKMRAEIU'[row.letter] + row.number]),
        plan.seen.map(item => [Number(item.practice), Number(item.position.startsWith('top')), item.pair]));
      assert.deepEqual(rounds.slice(12).map(row => row.condition), [...Array(32).fill(0), ...Array(32).fill(1), ...Array(32).fill(2)]);
      assert.deepEqual([summary.trials, summary.misses, summary.correct], [96, 1, 95]);
      assert.equal(rounds[14].response, null);
      assert.equal(rounds[1].correct, 0);
      assert.ok(rounds.every(row => row.setting === 1500));
      assert.equal(typeof summary.switchCostMs, 'number');
    },
    rows: 108,
  },
  'digit-span': {
    title: { zh: '數字廣度記憶（Digit Span）', en: 'Digit Span Memory Capacity' },
    purpose: 'memory',
    settings: { itemExposureMs: 500, rounds: 16, practice: true },
    tutorialTargets: ['.digit-span-display', '.digit-span-keypad', '.digit-span-entry', '.digit-span-direction', '.digit-span-progress-track'],
    runningSelector: '.digit-span-running',
    stopSelector: '.digit-span-stop',
    defaultMetric: 'responseMs', alternateMetric: 'correct',
    async play({ game, until, press, tap, mobile, capture }) {
      // Reads each digit as it appears, then answers: practice 2, forward 3 and 4 (two errors drop a digit) and reverse 2 leave out the last digit.
      // Forward 1 types an extra digit and deletes it first.
      const plan = { seen: [], intros: [], feedback: [] };
      const wrong = new Set(['practice:2', 'forward:3', 'forward:4', 'reverse:2']);
      const type = async (digit, keypad = false) => mobile || keypad ? tap(`.digit-span-running .digit-span-key[data-digit="${digit}"]`) : press(String(digit), `Digit${digit}`, 48 + digit);
      const submit = async () => mobile ? tap('.digit-span-running .digit-span-submit') : press('Enter', 'Enter', 13);
      const read = () => game(`(() => { const stage = document.querySelector('.digit-span-running');
        return { state: stage?.dataset.state, text: stage?.querySelector('.digit-span-display')?.textContent ?? '', label: stage?.querySelector('.digit-span-progress-label')?.textContent ?? '',
          entry: [...(stage?.querySelectorAll('.digit-span-entry-digit') ?? [])].map(item => item.textContent).join(''), result: stage?.querySelector('.digit-span-feedback')?.dataset.result ?? '',
          intro: document.querySelector('.digit-span-intro h3')?.textContent ?? null, results: Boolean(document.querySelector('.experiment-results')) }; })()`);
      let level = { load: 3, errors: 0 }, kind = 'practice';
      for (let sequence = 0; sequence < 18; sequence++) {
        const digits = [];
        let count = null, blank = true;
        await until(async () => {
          const state = await read();
          if (state.intro !== null) {
            plan.intros.push(state.intro);
            await capture(`intro-${plan.intros.length}`);
            if (mobile) await tap('.digit-span-continue'); else await press('Enter', 'Enter', 13);
            await until(async () => !(await game(`Boolean(document.querySelector('.digit-span-intro'))`)), 'intro closes');
            kind = plan.intros.length === 1 ? 'forward' : 'reverse';
            level = { load: 3, errors: 0 };
            return false;
          }
          if (state.state === 'count') count = Number(state.text.match(/\d+/)[0]);
          if (state.state === 'digit' && (blank || Number(state.text) !== digits.at(-1))) { digits.push(Number(state.text)); blank = false; }
          if (state.state === 'blank') blank = true;
          return state.state === 'answer';
        }, `sequence ${sequence + 1} keypad`, 30000);
        const label = (await read()).label;
        const number = Number(label.match(/(\d+)\s*(?:of|／|\/)\s*\d+$/)[1]);
        assert.equal(digits.length, count, `${label}: every digit was seen`);
        const expectedLoad = kind === 'practice' ? 3 : level.load;
        assert.equal(count, expectedLoad, `${label}: length follows the staircase`);
        assert.ok(digits.every((digit, index) => Math.abs(digit - (index ? digits[index - 1] : 0)) > 2));
        if (kind === 'forward' && number === 2) await capture('gameplay');
        const answer = kind === 'reverse' ? [...digits].reverse() : [...digits];
        const slip = wrong.has(`${kind}:${number}`);
        const typed = slip ? answer.slice(0, -1) : answer;
        if (kind === 'forward' && number === 1) {
          await type(9 - typed[0] || 1);
          if (mobile) await tap('.digit-span-running .digit-span-back'); else await press('Backspace', 'Backspace', 8);
          await until(async () => (await read()).entry === '', 'delete removes the extra digit');
        }
        // Forward 2 clicks the keypad and then presses Enter, which must submit rather than repeat the focused digit.
        for (const digit of typed) await type(digit, kind === 'forward' && number === 2);
        await until(async () => (await read()).entry === typed.join(''), `${label}: entry shows the typed digits`);
        if (kind === 'forward' && number === 1) await capture('answer');
        await submit();
        let result = '';
        await until(async () => { const state = await read(); if (state.state === 'feedback') result = state.result; return Boolean(result); }, `${label}: feedback`, 4000);
        assert.equal(result, slip ? 'wrong' : 'correct', label);
        plan.seen.push({ kind, number, load: count, correct: !slip, entered: typed.length });
        if (kind !== 'practice') level = slip ? (level.errors + 1 === 2 ? { load: Math.max(1, level.load - 1), errors: 0 } : { load: level.load, errors: level.errors + 1 }) : { load: level.load + 1, errors: level.errors };
      }
      assert.equal(plan.intros.length, 2);
      assert.match(plan.intros[0], /順向|Forward/);
      assert.match(plan.intros[1], /逆向|Reverse/);
      assert.deepEqual(plan.seen.filter(item => item.kind === 'forward').map(item => item.load), [3, 4, 5, 5, 4, 5, 6, 7]);
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.equal(rounds.length, 18);
      assert.deepEqual(rounds.map(row => [row.practice, row.reverse, row.load, row.correct, row.entered]),
        plan.seen.map(item => [Number(item.kind === 'practice'), Number(item.kind === 'reverse'), item.load, Number(item.correct), item.entered]));
      assert.deepEqual([summary.trials, summary.correct, summary.forwardSpan], [16, 13, 7]);
      assert.equal(summary.reverseSpan, Math.max(...plan.seen.filter(item => item.kind === 'reverse' && item.correct).map(item => item.load)));
      assert.ok(rounds.every(row => row.setting === 500 && row.responseMs > 0));
    },
    rows: 18,
  },
  'spatial-span': {
    title: { zh: '空間廣度記憶（Spatial Span）', en: 'Spatial Span Memory Capacity' },
    purpose: 'memory',
    // Phones use the 3 by 3 board so both board sizes get a real session.
    settings: { itemExposureMs: 500, rounds: 16, boardSize: process.argv.includes('--mobile') ? 3 : 5, practice: true },
    tutorialTargets: ['.spatial-span-lit', '.spatial-span-actions', '.spatial-span-entry', '.spatial-span-direction', '.spatial-span-progress-track'],
    runningSelector: '.spatial-span-running',
    stopSelector: '.spatial-span-stop',
    defaultMetric: 'responseMs', alternateMetric: 'correct',
    async play({ game, until, press, tap, mobile, capture }) {
      // Reads each lit square, then taps them back: practice 2, forward 3 and 4 and reverse 2 leave out the last square.
      // Forward 1 taps an extra square and undoes it first.
      const size = mobile ? 3 : 5;
      const plan = { seen: [], intros: [], numbered: 0 };
      const wrong = new Set(['practice:2', 'forward:3', 'forward:4', 'reverse:2']);
      const cell = number => tap(`.spatial-span-running .spatial-span-cell[data-cell="${number}"]`);
      const read = () => game(`(() => { const stage = document.querySelector('.spatial-span-running');
        return { state: stage?.dataset.state, lit: stage?.querySelector('.spatial-span-lit')?.dataset.cell ?? null, label: stage?.querySelector('.spatial-span-progress-label')?.textContent ?? '',
          message: stage?.querySelector('.spatial-span-message')?.textContent ?? '', result: stage?.querySelector('.spatial-span-message')?.dataset.result ?? '',
          entry: Number((stage?.querySelector('.spatial-span-entry')?.textContent.match(/[0-9]+/) ?? [-1])[0]), cells: stage?.querySelectorAll('.spatial-span-cell').length ?? 0,
          numbers: [...(stage?.querySelectorAll('.spatial-span-cell') ?? [])].filter(item => item.textContent).length,
          intro: document.querySelector('.spatial-span-intro h3')?.textContent ?? null }; })()`);
      let level = { load: 3, errors: 0 }, kind = 'practice';
      for (let sequence = 0; sequence < 18; sequence++) {
        const cells = [];
        let count = null;
        await until(async () => {
          const state = await read();
          if (state.intro !== null) {
            plan.intros.push(state.intro);
            await capture(`intro-${plan.intros.length}`);
            if (mobile) await tap('.spatial-span-continue'); else await press('Enter', 'Enter', 13);
            await until(async () => !(await game(`Boolean(document.querySelector('.spatial-span-intro'))`)), 'intro closes');
            kind = plan.intros.length === 1 ? 'forward' : 'reverse';
            level = { load: 3, errors: 0 };
            return false;
          }
          assert.equal(state.cells, size * size);
          if (state.state === 'count') count = Number(state.message.match(/\d+/)[0]);
          if (state.state === 'square' && state.lit !== null && Number(state.lit) !== cells.at(-1)) cells.push(Number(state.lit));
          if (state.state === 'square' && kind === 'forward' && cells.length === 2 && !plan.litShot) { plan.litShot = true; await capture('gameplay'); }
          return state.state === 'answer';
        }, `sequence ${sequence + 1} board`, 30000);
        const label = (await read()).label;
        const number = Number(label.match(/(\d+)\s*(?:of|／|\/)\s*\d+$/)[1]);
        assert.equal(cells.length, count, `${label}: every square was seen`);
        assert.equal(count, kind === 'practice' ? 3 : level.load, `${label}: length follows the staircase`);
        assert.ok(cells.every((item, index) => !index || item !== cells[index - 1]));
        const answer = kind === 'reverse' ? [...cells].reverse() : [...cells];
        const slip = wrong.has(`${kind}:${number}`);
        const typed = slip ? answer.slice(0, -1) : answer;
        if (kind === 'forward' && number === 1) {
          await cell(typed[0]);
          await until(async () => (await read()).entry === 1, 'tap is counted');
          if (mobile) await tap('.spatial-span-running .spatial-span-back'); else await press('Backspace', 'Backspace', 8);
          await until(async () => (await read()).entry === 0, 'undo removes the extra tap');
        }
        for (const item of typed) await cell(item);
        await until(async () => (await read()).entry === typed.length, `${label}: taps are counted`);
        if (kind === 'forward' && number === 1) await capture('answer');
        if (mobile) await tap('.spatial-span-running .spatial-span-submit'); else await press('Enter', 'Enter', 13);
        let result = '';
        await until(async () => { const state = await read(); if (state.state === 'feedback') { result = state.result; if (state.numbers) plan.numbered++; } return Boolean(result); }, `${label}: feedback`, 4000);
        assert.equal(result, slip ? 'wrong' : 'correct', label);
        if (slip && kind === 'forward' && number === 3) await capture('wrong-feedback');
        plan.seen.push({ kind, number, load: count, correct: !slip, entered: typed.length });
        if (kind !== 'practice') level = slip ? (level.errors + 1 === 2 ? { load: Math.max(1, level.load - 1), errors: 0 } : { load: level.load, errors: level.errors + 1 }) : { load: level.load + 1, errors: level.errors };
      }
      assert.equal(plan.intros.length, 2);
      assert.match(plan.intros[0], /順向|Forward/);
      assert.match(plan.intros[1], /逆向|Reverse/);
      assert.equal(plan.numbered, 4, 'Each wrong answer numbers the right order on the board.');
      assert.deepEqual(plan.seen.filter(item => item.kind === 'forward').map(item => item.load), [3, 4, 5, 5, 4, 5, 6, 7]);
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.equal(rounds.length, 18);
      assert.deepEqual(rounds.map(row => [row.practice, row.reverse, row.load, row.correct, row.entered]),
        plan.seen.map(item => [Number(item.kind === 'practice'), Number(item.kind === 'reverse'), item.load, Number(item.correct), item.entered]));
      assert.deepEqual([summary.trials, summary.correct, summary.forwardSpan], [16, 13, 7]);
      assert.ok(rounds.every(row => row.setting === 500 && row.board === (process.argv.includes('--mobile') ? 3 : 5) && row.responseMs > 0));
    },
    rows: 18,
  },
  'tower-of-london': {
    title: { zh: '倫敦塔規劃（Tower of London）', en: 'Tower of London Planning' },
    purpose: 'higher-cognition',
    settings: { problemLimitMs: 10000, practice: true },
    tutorialTargets: ['.tower-panel-target .tower-panel-title', '.tower-panel-yours .tower-panel-title', '.tower-hand', '.tower-moves', '.tower-timer'],
    runningSelector: '.tower-running',
    stopSelector: '.tower-stop',
    defaultMetric: 'problemMs', alternateMetric: 'correct',
    async play({ game, until, press, tap, mobile, capture }) {
      // Solves each problem along a shortest path found here. Practice first taps an empty peg; problem 1 tries a full peg;
      // problem 3 puts a ball back twice (two extra moves); problem 5 makes one move and lets the time run out.
      const capacities = [3, 2, 1], start = [[1, 2], [3], []];
      const Solve = target => {
        const key = board => JSON.stringify(board);
        const queue = [[start, []]], seen = new Set([key(start)]);
        while (queue.length) {
          const [board, path] = queue.shift();
          if (key(board) === key(target)) return path;
          board.forEach((from, source) => from.length && board.forEach((to, destination) => {
            if (destination === source || to.length >= capacities[destination]) return;
            const moved = board.map(items => [...items]);
            moved[destination].push(moved[source].pop());
            if (!seen.has(key(moved))) { seen.add(key(moved)); queue.push([moved, [...path, [source, destination]]]); }
          }));
        }
        throw new Error('No solution');
      };
      const read = () => game(`(() => { const stage = document.querySelector('.tower-running');
        const balls = selector => [...(stage?.querySelectorAll(selector + ' .tower-peg') ?? [])].map(peg => [...peg.querySelectorAll('.tower-ball')].map(ball => Number(ball.className.match(/tower-ball-([0-9])/)[1])));
        return { state: stage?.dataset.state, label: stage?.querySelector('.tower-progress-label')?.textContent ?? '',
          message: stage?.querySelector('.tower-message')?.textContent ?? '', result: stage?.querySelector('.tower-message')?.dataset.result ?? '',
          moves: Number((stage?.querySelector('.tower-moves')?.textContent.match(/[0-9]+/) ?? [-1])[0]),
          minimum: Number((stage?.querySelector('.tower-minimum')?.textContent.match(/[0-9]+/) ?? [-1])[0]),
          held: Boolean(stage?.querySelector('.tower-hand-slot .tower-ball')), target: balls('.tower-panel-target'), board: balls('.tower-panel-yours'),
          intro: document.querySelector('.tower-intro h3')?.textContent ?? null }; })()`);
      const peg = index => mobile ? tap(`.tower-running .tower-panel-yours .tower-peg[data-peg="${index}"]`) : press(String(index + 1), `Digit${index + 1}`, 49 + index);
      const move = async (from, to) => {
        const before = (await read()).moves;
        await peg(from);
        await until(async () => { const state = await read(); return state.held && state.moves === before + 1; }, 'ball lifted');
        await peg(to);
      };
      const plan = { problems: [], intros: [], notices: [] };
      for (let number = 0; number < 13; number++) {
        if (number > 0) {
          let intro = null;
          await until(async () => (intro = (await read()).intro) !== null, `intro ${number}`, 8000);
          plan.intros.push(intro);
          if (number === 1) await capture('intro');
          if (mobile) await tap('.tower-continue'); else await press('Enter', 'Enter', 13);
          await until(async () => (await read()).intro === null, 'intro closes');
        }
        let state = null;
        await until(async () => (state = await read()).state === 'play', `problem ${number} opens`, 8000);
        const path = Solve(state.target);
        assert.deepEqual(state.board, start, `${state.label}: every problem starts from the same layout`);
        assert.equal(state.minimum, path.length, `${state.label}: the listed minimum is the shortest path`);
        let extra = 0, timeout = false;
        if (number === 0) {
          await peg(2);
          await until(async () => /空的|empty/.test((await read()).message), 'empty peg notice');
          plan.notices.push('empty');
        }
        if (number === 1) {
          await move(0, 2);
          await peg(0);
          await until(async () => (await read()).held, 'green lifted');
          await capture('gameplay');
          await peg(2);
          await until(async () => /滿了|full/.test((await read()).message), 'full peg notice');
          plan.notices.push('full');
          await peg(1);
        } else if (number === 3) {
          for (let again = 0; again < 2; again++) { await move(0, 0); extra++; }
          for (const [from, to] of path) await move(from, to);
        } else if (number === 5) {
          await move(1, 2);
          timeout = true;
        } else {
          for (const [from, to] of path) await move(from, to);
        }
        let result = '';
        await until(async () => { state = await read(); result = state.state === 'feedback' ? state.result : ''; return Boolean(result); }, `problem ${number} feedback`, 14000);
        assert.equal(result, timeout ? 'wrong' : 'correct', state.message);
        if (!timeout) assert.match(state.message, new RegExp(`${path.length + extra}`));
        if (number === 5) await capture('timeout');
        plan.problems.push({ practice: number === 0, problem: number ? number - 1 : null, solved: !timeout, moves: timeout ? 1 : path.length + extra, minimum: path.length });
      }
      await until(() => game(`Boolean(document.querySelector('.experiment-results'))`), 'results', 8000);
      assert.equal(plan.intros.length, 12);
      assert.match(plan.intros[0], /第 1 題|Problem 1 of 12/);
      assert.deepEqual(plan.notices, ['empty', 'full']);
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.equal(rounds.length, 13);
      assert.deepEqual(rounds.map(row => [row.practice, row.problem, row.correct, row.moves, row.minimumMoves]),
        plan.problems.map(item => [Number(item.practice), item.problem, Number(item.solved), item.moves, item.minimum]));
      assert.deepEqual([summary.trials, summary.correct, summary.perfect, summary.extraMoves, summary.timeouts], [12, 11, 10, 2, 1]);
      assert.ok(rounds.every(row => row.setting === 10000 && row.firstMoveMs > 0 && row.problemMs >= row.firstMoveMs));
      assert.equal(rounds[5].problemMs, 10000, 'A timed-out problem records the full time.');
      assert.ok(summary.planningMs > 0 && summary.meanSolveMs > 0);
    },
    rows: 13,
  },
  'reaction-time': {
    title: { zh: '反應時間', en: 'Reaction Time' },
    purpose: 'attention',
    settings: { difficulty: 'easy', rounds: 5, timeLimitSec: 0, soundEnabled: true },
    tutorialTargets: ['.reaction-time-label', '.reaction-time-hint', '.reaction-time-early', '.reaction-time-progress-label', '.reaction-time-stop'],
    runningSelector: '.reaction-time-running',
    stopSelector: '.reaction-time-stop',
    defaultMetric: 'responseMs', alternateMetric: 'falseStart',
    async play({ game, until, press, tap, mobile, capture }) {
      // Starts every try with a real press; tries 2 and 4 press again while it is still red. A press during the
      // last result is ignored.
      const read = () => game(`(() => { const panel = document.querySelector('.reaction-time-running .reaction-time-panel');
        return { state: panel?.dataset.state ?? 'idle', label: panel?.querySelector('.reaction-time-label')?.textContent ?? '',
          early: Number((document.querySelector('.reaction-time-early')?.textContent.match(/[0-9]+/) ?? [-1])[0]),
          progress: document.querySelector('.reaction-time-progress-label')?.textContent ?? '' }; })()`);
      const hit = () => mobile ? tap('.reaction-time-running .reaction-time-panel') : press(' ', 'Space', 32);
      const plan = { early: 0, timed: [], order: [] };
      await until(async () => (await read()).label !== '', 'panel ready');
      assert.match((await read()).label, /點這裡開始|Tap to start/);
      await capture('idle');
      for (let attempt = 0; plan.timed.length < 5; attempt++) {
        await hit();
        await until(async () => (await read()).state === 'wait', `try ${attempt + 1} waits`);
        if (attempt === 1 || attempt === 3) {
          await hit();
          let state;
          await until(async () => (state = await read()).state === 'early', `try ${attempt + 1} is early`);
          assert.match(state.label, /太早|Too early/);
          if (attempt === 1) await capture('early');
          plan.early++;
          plan.order.push(1);
          assert.equal(state.early, plan.early);
          continue;
        }
        await until(async () => (await read()).state === 'go', `try ${attempt + 1} signal`, 8000);
        if (!plan.timed.length) await capture('go');
        await hit();
        let state;
        await until(async () => (state = await read()).state === 'result', `try ${attempt + 1} timed`);
        plan.timed.push(Number(state.label.match(/[0-9]+/)[0]));
        plan.order.push(0);
        if (plan.timed.length === 1) await capture('result');
      }
      await hit();
      const after = await read();
      assert.equal(after.state, 'result', 'A press after the last timed press does not start another try.');
      assert.match(after.progress, /5/);
      await until(() => game(`Boolean(document.querySelector('.experiment-results'))`), 'results', 5000);
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.equal(rounds.length, 7);
      assert.deepEqual(rounds.map(row => row.falseStart), plan.order);
      assert.deepEqual(rounds.filter(row => !row.falseStart).map(row => row.responseMs), plan.timed);
      assert.ok(rounds.every(row => row.waitMs >= 1400 && row.waitMs < 3200 && row.trial > 0));
      assert.ok(rounds.filter(row => row.falseStart).every(row => row.responseMs === null && row.earlyMs >= 0 && row.earlyMs < row.waitMs));
      assert.ok(rounds.filter(row => !row.falseStart).every(row => row.earlyMs === null && row.responseMs > 0));
      assert.deepEqual([summary.attempts, summary.successes, summary.falseStarts], [7, 5, 2]);
      assert.equal(summary.bestMs, Math.min(...plan.timed));
      assert.ok(summary.duration > 5 && summary.meanMs > 0 && summary.medianMs > 0 && summary.sdMs >= 0);
    },
    rows: 7,
  },
  'stop-signal': {
    title: { zh: '煞車抑制反應（Stop-Signal）', en: 'Stop-Signal Response Inhibition' },
    purpose: 'attention',
    settings: { responseWindowMs: 1000, rounds: 100, practice: true, keyGuide: false },
    tutorialTargets: ['.stop-signal-stimulus', '.stop-signal-pads', '.stop-signal-hud'],
    runningSelector: '.stop-signal-running',
    stopSelector: '.stop-signal-stop',
    defaultMetric: 'responseMs', alternateMetric: 'correct',
    async play({ game, until, press, tap, mobile, capture }) {
      // Learn the key split from the practice buttons, press at once unless the star is already up, and plan two slips:
      // a wrong key on practice item 2 and no press on the first counted shape from item 3 on.
      const plan = { seen: [], byLabel: new Map(), keyMap: null, rests: 0, practiceSlip: null, missed: 0, guideInCounted: false };
      const keys = { left: ['z', 'KeyZ', 90], right: ['m', 'KeyM', 77] };
      const answer = async side => mobile ? tap(`.stop-signal-pad-${side}`) : press(...keys[side]);
      await until(async () => {
        if (await game(`Boolean(document.querySelector('.experiment-results'))`)) return true;
        const state = await game(`(() => { const area = document.querySelector('.stop-signal-stimulus-area');
          const guide = side => [...document.querySelectorAll('.stop-signal-pad-' + side + ' .stop-signal-guide-shape')].map(item => Number(item.dataset.shape));
          return { label: document.querySelector('.stop-signal-progress-label')?.textContent ?? '', state: area?.dataset.state, signal: area?.dataset.signal === 'on',
            shape: Number(document.querySelector('.stop-signal-stimulus')?.dataset.shape), rest: Boolean(document.querySelector('.stop-signal-rest')),
            left: guide('left'), right: guide('right'), feedback: document.querySelector('.stop-signal-feedback')?.dataset.result ?? '' }; })()`);
        if (state.rest) {
          plan.rests++;
          if (plan.rests === 2) await capture('rest');
          if (mobile) await tap('.stop-signal-continue'); else press('Enter', 'Enter', 13);
          await until(async () => !(await game(`Boolean(document.querySelector('.stop-signal-rest'))`)), 'rest closes');
          return false;
        }
        const known = plan.byLabel.get(state.label);
        if (known) {
          if (state.signal && !known.signal) {
            known.signal = true;
            // A late star turns the planned miss into a held stop, so plan it again on a later shape.
            if (known.planMiss) { known.planMiss = false; plan.missed--; }
          }
          return false;
        }
        if (state.state !== 'target') return false;
        const practice = /練習|Practice/.test(state.label);
        // Counted labels end in "3/50" (English) or "3／50"; practice labels end in "3 of 32" or "3／32".
        const number = Number((state.label.match(/(\d+)\s*(?:of|／|\/)\s*\d+$/) ?? [0, 0])[1]);
        if (practice && !plan.keyMap && state.left.length === 2) {
          plan.keyMap = [0, 1, 2, 3].map(shape => state.left.includes(shape) ? 'left' : 'right');
        }
        if (!practice && (state.left.length || state.right.length)) plan.guideInCounted = true;
        const item = { label: state.label, practice, number, shape: state.shape, signal: state.signal, pressed: null };
        plan.seen.push(item);
        plan.byLabel.set(state.label, item);
        if (!practice && plan.seen.filter(entry => !entry.practice).length === 2) await capture('gameplay');
        const target = plan.keyMap[state.shape];
        if (state.signal) return false;
        if (practice && plan.seen.length === 2) {
          item.pressed = target === 'left' ? 'right' : 'left';
          await answer(item.pressed);
          await until(async () => (plan.practiceSlip = await game(`document.querySelector('.stop-signal-stimulus-area')?.dataset.state === 'feedback' ? document.querySelector('.stop-signal-feedback')?.dataset.result ?? '' : ''`)) !== '', 'practice feedback', 4000);
          return false;
        }
        if (!practice && number >= 3 && !plan.missed) { plan.missed++; item.planMiss = true; return false; }
        item.pressed = target;
        await answer(target);
        return false;
      }, 'Stop-signal shape stream', 420000);
      assert.equal(plan.seen.length, 132, 'Every practice and counted shape was seen by the driver.');
      assert.equal(plan.rests, 3, 'Rests follow shape practice, star practice and the first counted block.');
      assert.equal(plan.practiceSlip, 'wrong', 'Practice marks a wrong key.');
      assert.equal(plan.guideInCounted, false, 'The key guide leaves the buttons in counted blocks.');
      assert.deepEqual(plan.seen.map(item => item.practice), [...Array(32).fill(true), ...Array(100).fill(false)]);
      assert.equal(plan.seen.slice(0, 12).filter(item => item.signal).length, 0, 'Shape practice has no stars.');
      assert.equal(plan.seen.slice(12, 32).filter(item => item.signal).length, 6, 'Star practice shows six stars.');
      const counted = plan.seen.slice(32).filter(item => item.signal).length;
      assert.ok(counted === 20 || counted === 40, `Two blocks of one condition show 20 or 40 stars, saw ${counted}.`);
      assert.equal(plan.seen.filter(item => item.planMiss).length, 1, 'One shape without a star was left unanswered.');
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.equal(rounds.length, 132);
      assert.deepEqual(rounds.map(row => row.practice), [...Array(32).fill(1), ...Array(100).fill(0)]);
      assert.deepEqual(rounds.map(row => row.stop), plan.seen.map(item => Number(item.signal)));
      assert.deepEqual(rounds.map(row => row.shape), plan.seen.map(item => item.shape));
      let delay = 250;
      for (const row of rounds.filter(item => !item.practice && item.stop)) {
        assert.equal(row.stopDelayMs, delay, 'The star delay follows the 50 ms staircase.');
        delay = row.response === null ? Math.min(850, delay + 50) : Math.max(0, delay - 50);
      }
      assert.ok(rounds.filter(row => row.practice && row.stop).every(row => row.stopDelayMs === 250));
      assert.deepEqual([summary.trials, summary.goTrials + summary.stopTrials, summary.omissionErrors], [100, 100, 1]);
      const missed = rounds[plan.seen.findIndex(item => item.planMiss)];
      assert.deepEqual([missed.stop, missed.response], [0, null], 'The unanswered shape is saved as a missed press.');
      assert.equal(rounds[1].correct, 0);
      assert.ok(rounds.every(row => row.setting === 1000));
    },
    rows: 132,
  },
  'go-nogo': {
    title: { zh: '通行與抑制反應（Go/No-go）', en: 'Go / No-Go Sustained Attention' },
    purpose: 'attention',
    settings: { exposureMs: 500, rounds: 50, practice: true },
    tutorialTargets: ['.go-nogo-stimulus', '.go-nogo-pad', '.go-nogo-hud'],
    runningSelector: '.go-nogo-running',
    stopSelector: '.go-nogo-stop',
    defaultMetric: 'responseMs', alternateMetric: 'correct',
    async play({ game, until, press, tap, mobile, capture }) {
      // Press for go squares and hold on the others, with three planned slips: a press on the first practice
      // hold-back square, a missed press on the first counted go square from item 3 on, and a press on the first counted hold-back square.
      const plan = { seen: [], labels: new Set(), missed: 0, commission: 0, practiceSlip: null, sawBreak: false };
      const answer = async () => mobile ? tap('.go-nogo-pad') : press(' ', 'Space', 32);
      await until(async () => {
        if (await game(`Boolean(document.querySelector('.experiment-results'))`)) return true;
        const state = await game(`(() => { const square = document.querySelector('.go-nogo-stimulus');
          return { label: document.querySelector('.go-nogo-progress-label')?.textContent ?? '', kind: square?.dataset.kind, color: square?.dataset.color,
            state: document.querySelector('.go-nogo-stimulus-area')?.dataset.state }; })()`);
        if (state.state === 'break') plan.sawBreak = true;
        if (state.state !== 'target' || plan.labels.has(state.label)) return false;
        plan.labels.add(state.label);
        const practice = /練習|Practice/.test(state.label);
        const number = Number((state.label.match(/\d+/) ?? [0])[0]);
        plan.seen.push({ ...state, practice, number });
        if (!practice && number === 2) await capture('gameplay');
        if (state.kind === 'nogo') {
          if (practice && plan.practiceSlip === null) {
            await answer();
            plan.practiceSlip = await game(`document.querySelector('.go-nogo-feedback')?.dataset.result ?? ''`);
          } else if (!practice && !plan.commission) { plan.commission++; await answer(); }
          return false;
        }
        if (!practice && number >= 3 && !plan.missed) { plan.missed++; return false; }
        await answer();
        return false;
      }, 'Go/No-go square stream', 150000);
      assert.equal(plan.seen.length, 60, 'Every practice and counted square was seen by the driver.');
      assert.ok(plan.sawBreak, 'A break separates practice from the counted squares.');
      assert.deepEqual(plan.seen.map(item => item.practice), [...Array(10).fill(true), ...Array(50).fill(false)]);
      assert.equal(plan.practiceSlip, 'wrong', 'Practice marks a press on the hold-back color as wrong.');
      assert.equal(plan.seen.filter(item => item.practice && item.kind === 'nogo').length, 5);
      assert.equal(plan.seen.filter(item => !item.practice && item.kind === 'nogo').length, 5);
      assert.equal(new Set(plan.seen.filter(item => item.kind === 'go').map(item => item.color)).size, 1, 'One press color for the whole session.');
      assert.equal(new Set(plan.seen.filter(item => item.kind === 'nogo').map(item => item.color)).size, 1);
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.equal(rounds.length, 60);
      assert.deepEqual(rounds.map(row => row.practice), [...Array(10).fill(1), ...Array(50).fill(0)]);
      assert.deepEqual(rounds.map(row => row.noGo), plan.seen.map(item => Number(item.kind === 'nogo')));
      assert.deepEqual(rounds.map(row => row.color), plan.seen.map(item => item.color === 'orange' ? 0 : 1));
      assert.deepEqual([summary.trials, summary.goTrials, summary.noGoTrials, summary.omissionErrors, summary.commissionErrors, summary.correct],
        [50, 45, 5, 1, 1, 48]);
      assert.ok(rounds.every(row => row.setting === 500));
      assert.ok(rounds.filter(row => row.responded).every(row => row.responseMs > 0 && row.responseMs < 1250));
    },
    rows: 60,
  },
  'simon-task': {
    title: { zh: 'Simon 作業', en: 'Simon Task' },
    purpose: 'attention',
    settings: { trials: 40, responseMs: 1000, itiMs: 500 },
    tutorialTargets: ['.simon-stimulus', '.simon-pads', '.simon-hud'],
    runningSelector: '.simon-running',
    stopSelector: '.simon-stop',
    defaultMetric: 'rtMs', alternateMetric: 'correct',
    async play({ game, until, press, tap, mobile, capture }) {
      // Answer by shape, except the third shape gets the wrong side and the fifth gets no answer.
      const plan = { seen: [], wrong: 0, missed: 0 };
      const answer = async side => mobile ? tap(`.simon-pad-${side}`) : side === 'left' ? press('f', 'KeyF', 70) : press('j', 'KeyJ', 74);
      await until(async () => {
        if (await game(`Boolean(document.querySelector('.experiment-results'))`)) return true;
        const state = await game(`(() => { const label = document.querySelector('.simon-progress-label')?.textContent ?? '';
          const stimulus = document.querySelector('.simon-stimulus');
          return { index: Number((label.match(/\\d+/) ?? [0])[0]), shape: stimulus?.dataset.shape, side: stimulus?.dataset.side,
            showing: document.querySelector('.simon-stimulus-area')?.dataset.state === 'shape' }; })()`);
        if (!state.showing || !state.index || plan.seen[state.index - 1]) return false;
        plan.seen.push(state);
        if (state.index === 2) await capture('gameplay');
        const correct = state.shape === 'circle' ? 'left' : 'right';
        if (state.index === 5) { plan.missed++; return false; }
        if (state.index === 3) { plan.wrong++; await answer(correct === 'left' ? 'right' : 'left'); return false; }
        await answer(correct);
        return false;
      }, 'Simon shape stream', 120000);
      assert.equal(plan.seen.length, 40);
      return plan;
    },
    verify(saved, plan) {
      const summary = saved.score.summary;
      assert.equal(saved.score.rounds.length, 40);
      assert.deepEqual([summary.trials, summary.correct, summary.misses], [40, 40 - plan.wrong - plan.missed, plan.missed]);
      assert.deepEqual(saved.score.rounds.map(row => [row.shape, row.side]),
        plan.seen.map(item => [item.shape === 'circle' ? 0 : 1, item.side === 'left' ? 0 : 1]));
      assert.equal(saved.score.rounds[4].response, null);
      assert.ok(saved.score.rounds.filter(row => row.response !== null).every(row => row.rtMs > 0 && row.rtMs < 1000));
      assert.equal(typeof summary.simonEffectMs, 'number');
    },
    rows: 40,
  },
  'card-sorting': {
    title: { zh: '卡片規則分類', en: 'Card Rule Sorting' },
    purpose: 'higher-cognition',
    settings: { runLength: 6, categories: 3, maxCards: 48 },
    tutorialTargets: ['.sort-current-card', '.sort-keys', '.sort-hud'],
    runningSelector: '.sort-running',
    stopSelector: '.sort-stop',
    defaultMetric: 'rtMs', alternateMetric: 'correct',
    async play({ game, until, press, tap, mobile, capture }) {
      // Sort the first card by shape (an early error), then follow colour; after the first change keep colour once (old rule).
      const colors = ['red', 'green', 'yellow', 'blue'], shapes = ['triangle', 'star', 'cross', 'circle'];
      const pileFor = (card, rule) => rule === 'color' ? colors.indexOf(card.color) : rule === 'shape' ? shapes.indexOf(card.shape) : Number(card.count) - 1;
      const plan = { cards: 0, errors: 0, oldRule: 0 };
      const rules = ['color', 'shape', 'count'];
      let rule = 0, streak = 0;
      while (!await game(`Boolean(document.querySelector('.experiment-results'))`)) {
        await until(async () => await game(`Boolean(document.querySelector('.experiment-results'))`)
          || await game(`Boolean(document.querySelector('.sort-current-card')) && !document.querySelector('.sort-feedback').textContent
            && document.querySelector('.sort-progress-label').textContent.match(/\\d+/)[0] === '${plan.cards + 1}'`), `card ${plan.cards + 1}`);
        if (await game(`Boolean(document.querySelector('.experiment-results'))`)) break;
        const card = await game(`({ ...document.querySelector('.sort-current-card').dataset })`);
        if (plan.cards === 1) await capture('gameplay');
        let choice = rules[rule];
        if (plan.cards === 0) { choice = 'shape'; plan.errors++; }
        else if (rule === 1 && streak === 0 && !plan.oldRule) { choice = 'color'; plan.errors++; plan.oldRule++; }
        const pile = pileFor(card, choice);
        await (mobile ? tap(`.sort-key:nth-child(${pile + 1})`) : press(String(pile + 1), `Digit${pile + 1}`, 49 + pile));
        await until(() => game(`document.querySelector('.sort-feedback')?.textContent.length > 0 || Boolean(document.querySelector('.experiment-results'))`), 'sort feedback');
        plan.cards++;
        if (choice === rules[rule]) { streak++; if (streak === 6) { rule++; streak = 0; } } else streak = 0;
      }
      return plan;
    },
    verify(saved, plan) {
      const summary = saved.score.summary;
      assert.equal(saved.score.rounds.length, plan.cards);
      assert.equal(plan.cards, 20);
      assert.deepEqual([summary.categoriesCompleted, summary.errors, summary.perseverativeErrors, summary.cardsToFirstCategory], [3, plan.errors, plan.oldRule, 7]);
      assert.deepEqual(saved.score.rounds.map(row => row.rule), [...Array(7).fill(0), ...Array(7).fill(1), ...Array(6).fill(2)]);
      assert.ok(saved.score.rounds.every(row => row.rtMs > 0));
    },
    rows: 20,
  },
  'attentional-blink': {
    title: { zh: '注意力眨眼', en: 'Attentional Blink' },
    purpose: 'attention',
    settings: { trials: 24, itemMs: 150 },
    tutorialTargets: ['.blink-stimulus', '.blink-keypad', '.blink-hud'],
    runningSelector: '.blink-running',
    stopSelector: '.blink-stop',
    defaultMetric: 't2Correct', alternateMetric: 't1Correct',
    async play({ game, until, press, tap, mobile, capture }) {
      // A mutation observer records every character the stream shows, so no item is missed between polls.
      await until(() => game(`Boolean(document.querySelector('.blink-running .blink-stimulus'))`), 'stream element');
      await game(`(() => { window.blinkSeen = []; const target = document.querySelector('.blink-running .blink-stimulus');
        new MutationObserver(() => window.blinkSeen.push(target.textContent)).observe(target, { childList: true, characterData: true, subtree: true }); })()`);
      const plan = { digits: [], wrongFirst: 0 };
      const answer = digit => mobile ? tap(`.blink-key:nth-child(${digit - 1})`) : press(String(digit), `Digit${digit}`, 48 + digit);
      for (let round = 1; round <= 24; round++) {
        await until(() => game(`document.querySelector('.blink-prompt')?.dataset.step === 'answer1'
          && document.querySelector('.blink-progress-label').textContent.includes('${round}')`), `round ${round} answers`);
        const digits = (await game(`window.blinkSeen.splice(0)`)).filter(item => /^\d$/.test(item)).map(Number);
        assert.equal(digits.length, 2, `Round ${round} showed two digits: ${digits}`);
        plan.digits.push(digits);
        if (round === 1) await capture('gameplay');
        const first = round === 1 ? (digits[0] === 9 ? 2 : digits[0] + 1) : digits[0];
        if (first !== digits[0]) plan.wrongFirst++;
        await answer(first);
        await until(() => game(`document.querySelector('.blink-prompt')?.dataset.step === 'answer2'`), `round ${round} second answer`);
        await answer(digits[1]);
        await until(() => game(`document.querySelector('.blink-prompt')?.dataset.step === 'feedback' || Boolean(document.querySelector('.experiment-results'))`), `round ${round} feedback`);
      }
      return plan;
    },
    verify(saved, plan) {
      const summary = saved.score.summary;
      assert.equal(saved.score.rounds.length, 24);
      assert.deepEqual(saved.score.rounds.map(row => [row.t1, row.t2]), plan.digits);
      assert.equal(summary.t1AccuracyPercent, Math.round((24 - plan.wrongFirst) / 24 * 1000) / 10);
      assert.equal(summary.t2GivenT1Percent, 100);
      for (const lag of [1, 2, 3, 4, 6, 8]) assert.equal(saved.score.rounds.filter(row => row.lag === lag).length, 4);
    },
    rows: 24,
  },
  'time-perception': {
    title: { zh: '時間感知', en: 'Time Perception' },
    purpose: 'higher-cognition',
    settings: { mode: 'mixed', trials: 12 },
    tutorialTargets: ['.time-lamp', '.time-controls', '.time-hud'],
    runningSelector: '.time-running',
    stopSelector: '.time-stop',
    defaultMetric: 'targetMs', alternateMetric: 'correct',
    async play({ game, until, tap, press, hold, mobile, capture }) {
      // Holds last 1.5 s, comparisons always say the first was longer, and estimates use the measured lamp time.
      await until(() => game(`Boolean(document.querySelector('.time-running .time-lamp'))`), 'lamp');
      await game(`(() => { window.lampLog = []; const lamp = document.querySelector('.time-running .time-lamp');
        new MutationObserver(() => window.lampLog.push([lamp.dataset.on, performance.now()])).observe(lamp, { attributes: true, attributeFilter: ['data-on'] }); })()`);
      const plan = { holds: 0, estimates: [] };
      const step = () => game(`document.querySelector('.time-prompt')?.dataset.step`);
      for (let trial = 1; trial <= 12; trial++) {
        await until(async () => await game(`Boolean(document.querySelector('.time-intro-start'))`) || ['hold', 'choose'].includes(await step()), `trial ${trial}`, 30000);
        if (await game(`Boolean(document.querySelector('.time-intro-start'))`)) {
          await tap('.time-intro-start');
          await until(async () => ['hold', 'choose'].includes(await step()), `trial ${trial} after intro`, 30000);
        }
        if (trial === 1) await capture('gameplay');
        const task = await game(`document.querySelector('.time-running').dataset.task`);
        if (task === 'reproduce') { await hold('.time-hold', 1500); plan.holds++; }
        else if (task === 'compare') await (mobile ? tap('.time-choice:nth-child(1)') : press('1', 'Digit1', 49));
        else {
          const log = await game(`window.lampLog.slice(-2)`);
          const seconds = Math.round((log[1][1] - log[0][1]) / 1000);
          plan.estimates.push(seconds * 1000);
          await (mobile ? tap(`.time-choice:nth-child(${seconds})`) : press(String(seconds), `Digit${seconds}`, 48 + seconds));
        }
        await until(async () => await step() === 'feedback' || await game(`Boolean(document.querySelector('.experiment-results'))`), `trial ${trial} feedback`);
      }
      return plan;
    },
    verify(saved, plan) {
      const rounds = saved.score.rounds;
      assert.equal(rounds.length, 12);
      assert.deepEqual(rounds.map(row => row.task), [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2]);
      assert.ok(rounds.slice(0, 4).every(row => Math.abs(row.answerMs - 1500) < 300 && row.errorMs === row.answerMs - row.targetMs), JSON.stringify(rounds.slice(0, 4)));
      assert.ok(rounds.slice(4, 8).every(row => Math.abs(row.comparisonMs - 1000) >= 40 && row.answerMs === null));
      assert.deepEqual(rounds.slice(8).map(row => row.answerMs), plan.estimates);
      assert.equal(saved.score.summary.estimateAccuracyPercent, 100);
      assert.equal(typeof saved.score.summary.compareThresholdMs, 'number');
    },
    rows: 12,
  },
  'divided-attention': {
    title: { zh: '分配注意力', en: 'Divided Attention' },
    purpose: 'attention',
    settings: { durationSec: 60, speed: 'fast', mathLevel: 'harder' },
    tutorialTargets: ['.divided-target', '.divided-math', '.divided-hud'],
    runningSelector: '.divided-running',
    stopSelector: '.divided-stop',
    defaultMetric: 'rtMs', alternateMetric: 'correct',
    async play({ game, send, inputSession, press, mobile, capture }) {
      // Follows the dot with real input, gets the second sum wrong, lets the third time out and answers the rest.
      // On phones one finger stays on the dot while a second finger answers.
      const read = () => game(`(() => {
        const dot = document.querySelector('.divided-running .divided-dot')?.getBoundingClientRect();
        const math = document.querySelector('.divided-math');
        return { done: Boolean(document.querySelector('.experiment-results')), on: document.querySelector('.divided-running .divided-target')?.dataset.on === 'true',
          dot: dot && { x: dot.left + dot.width / 2, y: dot.top + dot.height / 2 }, problem: math?.dataset.state === 'problem',
          equation: document.querySelector('.divided-equation')?.textContent ?? '',
          options: [...document.querySelectorAll('.divided-option')].map(button => { const box = button.getBoundingClientRect();
            return { value: Number(button.firstChild?.textContent), x: box.left + box.width / 2, y: box.top + box.height / 2 }; }) }; })()`);
      const finger = { id: 0 };
      const steer = at => mobile ? send('Input.dispatchTouchEvent', { type: finger.down ? 'touchMove' : 'touchStart', touchPoints: [{ ...at, id: 0 }] }, inputSession)
        .then(() => { finger.down = true; }) : send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...at }, inputSession);
      if (!mobile) {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 }, inputSession);
        await new Promise(resolve => setTimeout(resolve, 400));
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 }, inputSession);
        const marker = await game(`(() => { const marker = document.querySelector('.divided-marker'), field = document.querySelector('.divided-running .divided-field');
          return { hidden: marker.hidden, x: new DOMMatrix(getComputedStyle(marker).transform).m41, half: field.clientWidth / 2 }; })()`);
        assert.equal(marker.hidden, false, 'Arrow keys show the crosshair.');
        assert.ok(marker.x > marker.half + 20, `The right arrow moves the crosshair right: ${JSON.stringify(marker)}`);
      }
      const plan = { problems: 0, wrong: 0, missed: 0, polls: 0, onPolls: 0, answeredLast: true, shownAt: 0, captured: false };
      const deadline = Date.now() + 90000;
      let showing = false, answeredAt = 0;
      while (Date.now() < deadline) {
        const state = await read();
        if (state.done) break;
        if (!state.dot) continue;
        await steer(state.dot);
        if (plan.problems || plan.polls > 20) { plan.polls++; if (state.on) plan.onPolls++; }
        if (!mobile && plan.polls === 1) assert.equal(await game(`document.querySelector('.divided-marker').hidden`), true, 'Moving the mouse hides the crosshair.');
        if (answeredAt && !state.problem) {
          assert.match(state.equation, /^[✓✗]/, `Sum ${plan.problems} was answered, not timed out.`);
          answeredAt = 0;
        }
        assert.ok(!answeredAt || Date.now() - answeredAt < 1500, `Sum ${plan.problems} took the ${mobile ? 'second-finger tap' : 'key press'}.`);
        if (state.problem && !showing) { plan.problems++; plan.answeredLast = false; plan.shownAt = Date.now(); }
        showing = state.problem;
        if (!state.problem || plan.answeredLast || Date.now() - plan.shownAt < 500) continue;
        if (!plan.captured) { plan.captured = true; await capture('gameplay'); }
        if (plan.problems === 3) { plan.missed++; plan.answeredLast = true; continue; }
        const [, left, sign, right] = state.equation.match(/(\d+) ([+−×]) (\d+)/);
        const answer = sign === '+' ? Number(left) + Number(right) : sign === '−' ? left - right : left * right;
        let index = state.options.findIndex(option => option.value === answer);
        assert.ok(index >= 0, `${state.equation} offers ${answer}`);
        if (plan.problems === 2) { index = (index + 1) % 3; plan.wrong++; }
        if (mobile) {
          const button = state.options[index];
          // The second finger lands while the first is still on the dot; emulated touches lift together, so the first lands again next poll.
          await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...state.dot, id: 0 }, { x: button.x, y: button.y, id: 1 }] }, inputSession);
          await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, inputSession);
          finger.down = false;
        } else await press(String(index + 1), `Digit${index + 1}`, 49 + index);
        plan.answeredLast = true;
        answeredAt = Date.now();
      }
      if (mobile && finger.down) await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, inputSession);
      if (showing && !plan.answeredLast) plan.problems--;
      assert.ok(plan.problems >= 6, `Enough sums appeared: ${plan.problems}`);
      assert.ok(plan.onPolls / plan.polls > .6, `The driver stayed on the dot: ${plan.onPolls}/${plan.polls}`);
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.equal(rounds.length, plan.problems);
      assert.deepEqual([summary.problems, summary.correct, summary.missed], [plan.problems, plan.problems - plan.wrong - plan.missed, plan.missed]);
      assert.ok(rounds[1].chosen !== null && rounds[1].correct === 0, 'The second sum is saved as a wrong answer.');
      assert.deepEqual([rounds[2].chosen, rounds[2].rtMs, rounds[2].correct], [null, null, 0], 'The third sum is saved as unanswered.');
      assert.ok(rounds.filter(row => row.chosen !== null).every(row => row.rtMs >= 400 && row.rtMs < 7000));
      assert.ok(rounds.every(row => typeof row.trackingPercent === 'number'));
      assert.ok(summary.trackingPercent > 50 && summary.durationSec === 60, JSON.stringify(summary));
    },
  },
  'pattern-memory': {
    title: { zh: '圖形記憶', en: 'Pattern Memory' },
    purpose: 'memory',
    settings: { trials: 20, studyMs: 1000, startLoad: 2, adaptive: true },
    tutorialTargets: ['.pattern-board', '.pattern-answers', '.pattern-hud'],
    runningSelector: '.pattern-running',
    stopSelector: '.pattern-stop',
    defaultMetric: 'load', alternateMetric: 'correct',
    async play({ game, until, press, tap, mobile, capture }) {
      // Compares the two boards and answers right except on trial 3; desktop alternates F/J with the arrow keys.
      const read = () => game(`(() => { const board = document.querySelector('.pattern-running .pattern-board');
        return { step: board?.dataset.step, trial: Number((document.querySelector('.pattern-progress-label')?.textContent.match(/\\d+/) ?? [0])[0]),
          items: [...(board?.querySelectorAll('.pattern-cell[data-color]') ?? [])].map(cell => [cell.dataset.cell, cell.dataset.color, cell.dataset.shape].join(':')).sort() }; })()`);
      const plan = { loads: [], changes: [], wrong: 0 };
      let load = 2, streak = 0;
      for (let trial = 1; trial <= 20; trial++) {
        let study, test;
        await until(async () => { const state = await read(); if (state.step === 'study' && state.trial === trial) study = state.items; return Boolean(study); }, `trial ${trial} board`);
        if (trial === 1) await capture('gameplay');
        assert.equal(study.length, load, `Trial ${trial} shows ${load} shapes.`);
        plan.loads.push(load);
        await until(async () => { const state = await read(); if (state.step === 'test') test = state.items; return Boolean(test); }, `trial ${trial} second board`);
        const changed = JSON.stringify(study) !== JSON.stringify(test);
        plan.changes.push(changed);
        const answer = trial === 3 ? !changed : changed;
        if (trial === 3) plan.wrong++;
        if (mobile) await tap(answer ? '.pattern-changed' : '.pattern-same');
        else if (trial % 2) await (answer ? press('j', 'KeyJ', 74) : press('f', 'KeyF', 70));
        else await (answer ? press('ArrowRight', 'ArrowRight', 39) : press('ArrowLeft', 'ArrowLeft', 37));
        await until(async () => (await read()).step === 'feedback' || await game(`Boolean(document.querySelector('.experiment-results'))`), `trial ${trial} feedback`);
        if (trial === 3) {
          if (changed) assert.equal(await game(`document.querySelectorAll('.pattern-cell[data-changed]').length`), 1, 'A missed change is outlined.');
          await capture('feedback');
        }
        if (answer !== changed) { load = Math.max(2, load - 1); streak = 0; } else if (++streak === 2) { load = Math.min(8, load + 1); streak = 0; }
      }
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.equal(rounds.length, 20);
      assert.deepEqual(rounds.map(row => row.load), plan.loads);
      assert.deepEqual(rounds.map(row => row.change !== 0), plan.changes);
      assert.deepEqual([summary.trials, summary.correct, summary.maxLoad], [20, 20 - plan.wrong, Math.max(...plan.loads)]);
      assert.equal(rounds[2].correct, 0);
      assert.ok(rounds.every(row => row.rtMs > 0));
      assert.equal(typeof summary.cowanK, 'number');
    },
    rows: 20,
  },
  ...migratedBrainGameSpecs,
};

export async function CheckBrainGame(gameId, { game, evaluate, send, until, standalone, english, capture, checkSpotlight,
  sqlite, gameContext, session, getSaveAttempts, requests, errors, version, accountId, guestSubjectId }) {
  const spec = brainGameSpecs[gameId];
  assert.ok(spec, `No browser driver for ${gameId}`);
  const mobile = process.argv.includes('--mobile');
  const pointerSession = gameContext.session || session;
  await until(() => game(`document.querySelector('form h2')?.textContent === ${JSON.stringify(english ? spec.title.en : spec.title.zh)}`), 'private init language');
  assert.equal(await game(`Boolean(document.querySelector('.game-tour'))`), false, 'The tutorial waits for confirmed settings.');
  assert.equal(await game(`Boolean(document.querySelector('.${gameId}-tutorial'))`), true, 'The tutorial scene renders behind the settings.');
  assert.equal(await game(`document.querySelector('dialog').matches(':modal')`), true);
  assert.ok(await game('document.documentElement.scrollWidth <= innerWidth'), 'Settings must not overflow horizontally.');
  await capture('settings');
  const setInput = async (name, value) => game(`(() => {
    const input = document.querySelector('[name=${name}]');
    if (input.type === 'checkbox') { if (input.checked !== ${value === true}) input.click(); return; }
    const prototype = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(String(value))});
    input.dispatchEvent(new Event('input', {bubbles:true})); input.dispatchEvent(new Event('change', {bubbles:true}));
  })()`);
  const readInput = name => game(`(() => { const input = document.querySelector('[name=${name}]'); return input.type === 'checkbox' ? String(input.checked) : input.value; })()`);
  for (const [name, value] of Object.entries(spec.settings)) await setInput(name, value);
  for (const [name, value] of Object.entries(spec.settings)) assert.equal(await readInput(name), String(value), name);
  const lastInput = Object.keys(spec.settings).at(-1);
  await game(`document.querySelector('[name=${lastInput}]').dispatchEvent(new KeyboardEvent('keydown', {key:'Enter',bubbles:true}))`);
  await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'first spotlight after Enter confirms');
  await checkSpotlight(spec.tutorialTargets[0]);
  await game(`document.querySelector('.game-tour button:last-child').click()`);
  await until(() => game(`Boolean(document.querySelector('form'))`), 'tutorial return keeps settings');
  for (const [name, value] of Object.entries(spec.settings)) assert.equal(await readInput(name), String(value), `${name} kept`);
  assert.equal(await game(`Boolean(document.querySelector('.game-tour-spotlight'))`), false);
  await game(`document.querySelector('form .btn-primary').click()`);
  await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'restarted tutorial');
  const buttonLook = selector => game(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); const style = getComputedStyle(element);
    return [style.borderTopStyle, style.borderTopWidth, style.borderTopLeftRadius, Math.round(element.getBoundingClientRect().height)].join(' '); })()`);
  let tutorialStop = null;
  for (const target of spec.tutorialTargets) {
    if (target === spec.stopSelector) tutorialStop = await buttonLook(target);
    const spotlight = await checkSpotlight(target);
    const intersects = spotlight.target.left < spotlight.panel.right && spotlight.target.right > spotlight.panel.left
      && spotlight.target.top < spotlight.panel.bottom && spotlight.target.bottom > spotlight.panel.top;
    assert.equal(intersects, false, `${target}: the instruction panel leaves the target visible.`);
    await capture('tutorial-' + target.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, ''));
    await game(`document.querySelector('.game-tour button').click()`);
  }
  await until(() => game(`Boolean(document.querySelector('.training-confirmation'))`), 'final confirmation');
  await CheckConfirmationPresentation(game);
  assert.equal(await game(`Boolean(document.querySelector('.game-tour-spotlight'))`), false);
  await capture('confirmation');
  const point = selector => game(`(() => {const rect=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};})()`);
  const tap = async selector => {
    const at = await point(selector);
    if (mobile) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] }, pointerSession);
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, pointerSession);
    } else {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...at }, pointerSession);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...at }, pointerSession);
    }
  };
  const press = async (key, code, keyCode) => {
    const text = key === 'Enter' ? '\r' : key.length === 1 ? key : undefined;
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode, text }, pointerSession);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode }, pointerSession);
  };
  // Holds a control for a set time: a touch on phones, the Space bar on desktop.
  const hold = async (selector, ms) => {
    if (mobile) {
      const at = await point(selector);
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] }, pointerSession);
      await new Promise(resolve => setTimeout(resolve, ms));
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, pointerSession);
      return;
    }
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' }, pointerSession);
    await new Promise(resolve => setTimeout(resolve, ms));
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 }, pointerSession);
  };
  await tap('.training-confirmation .btn-primary');
  await until(() => game(`Boolean(document.querySelector(${JSON.stringify(spec.runningSelector)}))`), 'running stage');
  await until(() => game(`document.fullscreenElement === document.querySelector('.${gameId}-game-root')`), 'native fullscreen root');
  if (process.argv.includes('--windowed')) await game(`document.exitFullscreen()`);
  assert.ok(await game(`document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight`), 'Stage fits the viewport.');
  // The board-game batch checks that the tutorial's copy of Stop looks like the button it points at.
  if (gameId in migratedBrainGameSpecs && tutorialStop) assert.equal(await buttonLook(spec.stopSelector), tutorialStop, 'The tutorial Stop matches the real Stop button.');
  if (process.argv.includes('--stop')) {
    await tap(spec.stopSelector);
    await until(() => standalone ? game(`Boolean(document.querySelector('form'))`) : evaluate(`!document.querySelector('dialog iframe')`), 'stop without saving');
    assert.equal(getSaveAttempts(), 0);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM training_records').get().count, 0);
    assert.deepEqual(errors, []);
    console.log(`${gameId}: stop ends the session without saving.`);
    return;
  }
  const plan = await spec.play({ game, evaluate, send, inputSession: pointerSession, until, tap, press, hold, mobile, capture, english });
  await until(() => game(`Boolean(document.querySelector('.experiment-results'))`), 'game-owned results', 120000);
  await until(() => game(`!document.fullscreenElement`), 'results exit fullscreen');
  await CheckResultsPresentation(game, { defaultMetric: spec.defaultMetric, alternateMetric: spec.alternateMetric, english, capture });
  if (spec.rows) assert.equal(await game(`document.querySelector('.score-row-range').textContent.trim()`), `1–${Math.min(50, spec.rows)} / ${spec.rows}`);
  if (standalone) {
    const scope = await evaluate('navigator.serviceWorker.ready.then(registration=>new URL(registration.scope).pathname)');
    assert.equal(scope, `/games/${gameId}/${version}/`);
    assert.equal(getSaveAttempts(), 0);
    assert.match(await game(`document.querySelector('.score-save-status').textContent`), english ? /Local play/ : /獨立練習/);
  } else {
    await until(() => game(`Boolean(document.querySelector('.score-retry-button'))`), 'save failure offers retry');
    await game(`document.querySelector('.score-retry-button').click()`);
    await until(() => game(`document.querySelector('.score-save-status').textContent === ${JSON.stringify(english ? 'Saved' : '已保存')}`), 'fixed-session retry saved');
    const records = sqlite.prepare('SELECT * FROM training_records').all();
    assert.equal(records.length, 1); assert.ok(getSaveAttempts() >= 2);
    assert.equal(records[0].user_id ?? null, accountId);
    if (accountId) assert.notEqual(records[0].subject_id, guestSubjectId); else assert.equal(records[0].subject_id, guestSubjectId);
    const saved = JSON.parse(records[0].payload_json);
    assert.equal(saved.gameId, gameId);
    assert.deepEqual(saved.config, spec.settings);
    spec.verify(saved, plan);
  }
  assert.deepEqual(errors, []);
  assert.ok(!requests.some(url => new RegExp(`${gameId}.*(?:settings|score)\\.json`).test(url)));
  await game(`document.querySelector('.score-return-button').click()`);
  await until(() => standalone ? game(`Boolean(document.querySelector('form'))`) : evaluate(`!document.querySelector('dialog iframe')`), 'return to source');
  console.log(`${gameId}: settings, ${spec.tutorialTargets.length} spotlights, a real run, results and save lifecycle passed.`);
}
