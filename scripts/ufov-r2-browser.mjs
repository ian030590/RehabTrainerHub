import assert from 'node:assert/strict';

// Browser driver for the UFOV R2 package. Phones and tablets run activity 1 only, so the touch runs expect that.
const handheld = ['--mobile', '--tablet'].some(flag => process.argv.includes(flag));
const activity = handheld ? 1 : 2;
// With every random draw fixed at 0.1 the center is always a car and the outer car sits in the first checked direction.
const targetAxis = 2;
const trialColumns = ['trial', 'practice', 'activity', 'planned_ms', 'exposure_ms', 'frames', 'dropped_frames', 'refresh_hz', 'sync_valid',
  'contrast_percent', 'vehicle_angle_deg', 'target_angle_deg', 'central_target', 'central_response', 'central_correct', 'peripheral_axis',
  'peripheral_response', 'peripheral_correct', 'trial_correct', 'response_ms', 'trajectory_samples'];
const settings = {
  subtestId: 2, mode: 'formal', stopCondition: 'fixed_trials', trialCount: 10,
  contrastPercent: 80, targetVisualAngleDeg: 12, vehicleVisualAngleDeg: 2,
  screenWidthCm: 34.5, screenHeightCm: 19.4, viewingDistanceCm: 60,
  axis0Enabled: false, axis1Enabled: false, axis2Enabled: true, axis3Enabled: true,
  axis4Enabled: false, axis5Enabled: true, axis6Enabled: false, axis7Enabled: false,
};
// Trial 4 names the wrong vehicle; trial 8 names the wrong direction, or the wrong vehicle when there is no outer car.
const wrongVehicle = new Set(handheld ? [4, 8] : [4]);
const wrongDirection = new Set(handheld ? [] : [8]);

function ParseCsv(text) {
  const [header, ...rows] = text.split('\r\n').map(line => line.split(','));
  return { header, rows: rows.map(cells => Object.fromEntries(header.map((key, index) => [key, cells[index]]))) };
}

export const ufovBrowserSpec = {
  title: { zh: '周邊視野訓練', en: 'Peripheral Visual Field Training' },
  purpose: 'attention',
  settings,
  config: { ...settings, subtestUsed: activity },
  tutorialTargets: handheld ? ['.ufov-preview-center', '.ufov-preview-choices', '.ufov-hud']
    : ['.ufov-preview-center', '.ufov-preview-outer', '.ufov-preview-choices', '.ufov-preview-directions', '.ufov-hud'],
  // The answers sit beside the field on wide screens, so a panel squeezed above them would hide its own buttons.
  tourFitsWithoutScroll: true,
  runningSelector: '.ufov-running',
  stopSelector: '.ufov-stop',
  defaultMetric: 'exposureMs', alternateMetric: 'correct',
  // Back to settings from the confirmation keeps every value; Skip tutorial then goes straight back to the confirmation.
  async afterConfirmation({ game, until }) {
    await game(`document.querySelector('.training-confirmation .btn-ghost').click()`);
    await until(() => game(`Boolean(document.querySelector('form'))`), 'confirmation returns to settings');
    for (const [name, value] of Object.entries(settings)) {
      assert.equal(await game(`(input => input.type === 'checkbox' ? String(input.checked) : input.value)(document.querySelector('[name=${name}]'))`), String(value), `${name} kept`);
    }
    await game(`document.querySelector('form .btn-primary').click()`);
    await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'tutorial after confirming again');
    await game(`Array.from(document.querySelectorAll('.game-tour button')).find(button => /略過教學|Skip tutorial/.test(button.textContent)).click()`);
    await until(() => game(`Boolean(document.querySelector('.training-confirmation'))`), 'Skip tutorial opens the confirmation');
    assert.equal(await game(`Boolean(document.querySelector('.game-tour'))`), false);
  },
  async beforeStart({ game, evaluate }) {
    await game('Math.random = () => 0.1');
    // Downloads leave from the container page. Keep each file in memory instead of writing it to disk.
    await evaluate(`(() => {
      window.ufovDownloads = [];
      const blobs = new Map();
      const create = URL.createObjectURL;
      URL.createObjectURL = function (blob) { const url = create.call(this, blob); blobs.set(url, blob); return url; };
      const click = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        if (this.download?.startsWith('ufov-')) window.ufovDownloads.push({ name: this.download, blob: blobs.get(this.href) });
        else click.call(this);
      };
    })()`);
  },
  async play({ game, send, inputSession, until, tap, mobile, capture }) {
    const plan = { answered: new Set(), vehicles: [], directions: [], correct: [], pauses: 0 };
    const at = selector => game(`(() => { const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; })()`);
    // Mouse users leave a path while they answer; the trajectory file records it.
    const moveTo = async selector => {
      if (mobile) return;
      const end = await at(selector);
      for (const step of [0.3, 0.7, 1]) {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 200 + (end.x - 200) * step, y: 200 + (end.y - 200) * step }, inputSession);
      }
    };
    await until(async () => {
      if (await game(`Boolean(document.querySelector('.experiment-results'))`)) return true;
      const state = await game(`({ trial: Number((document.querySelector('.ufov-progress')?.textContent.match(/\\d+/) ?? [0])[0]),
        vehicle: Boolean(document.querySelector('.ufov-answer-choices')), direction: Boolean(document.querySelector('.ufov-answer-directions')),
        pause: Boolean(document.querySelector('.ufov-sync-pause')) })`);
      if (state.pause) { plan.pauses++; await tap('.ufov-sync-pause .btn-primary'); return false; }
      if (state.vehicle && !plan.answered.has(`v${state.trial}`)) {
        plan.answered.add(`v${state.trial}`);
        if (state.trial === 2) await capture('gameplay-answer');
        const vehicle = wrongVehicle.has(state.trial) ? 'truck' : 'car';
        plan.vehicles.push(vehicle);
        if (handheld) plan.correct.push(vehicle === 'car' ? 1 : 0);
        const selector = `.ufov-answer-choices .ufov-vehicle-choice:has(.ufov-vehicle-${vehicle})`;
        await moveTo(selector);
        await tap(selector);
      } else if (state.direction && !plan.answered.has(`d${state.trial}`)) {
        plan.answered.add(`d${state.trial}`);
        const axis = wrongDirection.has(state.trial) ? targetAxis + 1 : targetAxis;
        plan.directions.push(axis);
        plan.correct.push(plan.vehicles.at(-1) === 'car' && axis === targetAxis ? 1 : 0);
        const selector = `.ufov-answer-directions button[aria-label^="${axis + 1}."]`;
        await moveTo(selector);
        await tap(selector);
      }
      return false;
    }, 'UFOV trials', 180000);
    assert.equal(plan.vehicles.length, 10, 'The driver answered every counted trial.');
    return plan;
  },
  async results({ game, evaluate, until, mobile, plan }) {
    assert.equal(await game(`Boolean(document.querySelector('.score-directions'))`), !handheld, 'Directions are listed only when an outer car was shown.');
    const buttons = await game(`document.querySelectorAll('.score-download-buttons button').length`);
    assert.equal(buttons, 3, 'Three files can be downloaded.');
    for (let index = 0; index < buttons; index++) await game(`document.querySelectorAll('.score-download-buttons button')[${index}].click()`);
    await until(() => evaluate('window.ufovDownloads.length === 3 && window.ufovDownloads.every(file => file.blob)'), 'three result files');
    const files = await evaluate(`Promise.all(window.ufovDownloads.map(async file => ({ name: file.name, type: file.blob.type,
      head: Array.from(new Uint8Array(await file.blob.slice(0, 3).arrayBuffer())), text: await file.blob.text() })))`);
    const kinds = files.map(file => file.name.match(/^ufov-\d{8}-\d{6}-(trials\.csv|summary\.csv|trajectory\.json)$/)?.[1]);
    assert.deepEqual(kinds, ['trials.csv', 'summary.csv', 'trajectory.json']);
    const byKind = Object.fromEntries(files.map((file, index) => [kinds[index], file]));
    for (const kind of ['trials.csv', 'summary.csv']) {
      // Spreadsheet apps read the files as UTF-8 because of the byte order mark.
      assert.deepEqual(byKind[kind].head, [0xef, 0xbb, 0xbf], `${kind} starts with a byte order mark`);
      assert.match(byKind[kind].type, /^text\/csv/);
    }
    assert.match(byKind['trajectory.json'].type, /^application\/json/);
    const trials = ParseCsv(byKind['trials.csv'].text.replace(/^﻿/, ''));
    assert.deepEqual(trials.header, trialColumns);
    assert.equal(trials.rows.length, 10);
    trials.rows.forEach((row, index) => {
      assert.equal(row.trial, String(index + 1));
      assert.equal(row.practice, '0');
      assert.equal(row.activity, String(activity));
      assert.equal(row.central_target, 'car');
      assert.equal(row.central_response, plan.vehicles[index]);
      assert.equal(row.peripheral_axis, handheld ? '' : String(targetAxis), 'The outer car uses only the checked directions.');
      assert.equal(row.peripheral_response, handheld ? '' : String(plan.directions[index]));
      assert.equal(row.trial_correct, String(plan.correct[index]));
      assert.equal(row.sync_valid, '1');
      assert.equal(row.contrast_percent, '80');
      if (!mobile) assert.ok(Number(row.trajectory_samples) > 0, `trial ${index + 1} kept a mouse path`);
    });
    // The display time starts at 500 ms, shortens after a correct answer and lengthens after a miss, up to 500 ms.
    const planned = trials.rows.map(row => Number(row.planned_ms));
    assert.ok(Math.abs(planned[0] - 500) < 17, 'The first trial shows the vehicles for about 500 ms.');
    for (let index = 0; index < planned.length - 1; index++) {
      if (plan.correct[index]) assert.ok(planned[index + 1] < planned[index], `trial ${index + 2} is shorter after a correct answer`);
      else assert.ok(planned[index + 1] > planned[index] || planned[index + 1] >= 483, `trial ${index + 2} is longer after a miss`);
    }
    const summary = ParseCsv(byKind['summary.csv'].text.replace(/^﻿/, ''));
    assert.deepEqual(summary.header, ['metric', 'value', 'unit']);
    const metric = key => summary.rows.find(row => row.metric === key)?.value;
    assert.equal(metric('trials'), '10');
    assert.equal(metric('correct_trials'), String(plan.correct.reduce((sum, value) => sum + value, 0)));
    assert.equal(metric('activity'), String(activity));
    assert.equal(metric('stop_condition'), 'fixed_trials');
    const trajectory = JSON.parse(byKind['trajectory.json'].text);
    assert.deepEqual(Object.keys(trajectory), ['schema', 'activity', 'trials']);
    assert.equal(trajectory.schema, 'rehab-trainer.ufov-trajectory/v1');
    assert.equal(trajectory.trials.length, 10);
    if (!mobile) assert.ok(trajectory.trials.every(trial => trial.trajectory.length > 0 && trial.trajectory.every(point => point.length === 3)));
    // Nothing in the files names the person or the account.
    assert.doesNotMatch(files.map(file => file.text).join('\n'), /subject|user_?id|account|email|guest/i);
  },
  verify(saved, plan) {
    const { summary, rounds } = saved.score;
    assert.equal(rounds.length, 10);
    assert.deepEqual(rounds.map(row => row.correct), plan.correct);
    assert.deepEqual([summary.trials, summary.correct, summary.aborted], [10, plan.correct.reduce((sum, value) => sum + value, 0), 0]);
    assert.ok(rounds.every(row => row.subtest === activity && row.axis === (handheld ? null : targetAxis) && row.syncValid === 1));
    assert.ok(rounds.every(row => row.responseMs > 0 && row.exposureMs > 0 && row.contrast === 80 && row.angle === 12));
    assert.ok(summary.thresholdMs > 0 && summary.bestMs > 0);
  },
  rows: 10,
};
