import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { CheckConfirmationPresentation } from './r2-game-ui-browser.mjs';
import { CheckResultsPresentation } from './r2-game-results-browser.mjs';

const gameRoot = new URL('../apps/rehabtrainerhub/games/every-ball-response/', import.meta.url);
const microphone = process.argv.includes('--microphone');
const mobile = process.argv.includes('--mobile');
// Saved rounds store each name as its position in these lists (score.ts).
const codes = { ball: ['basketball', 'soccer', 'tennis', 'beach'], action: ['none', 'clap', 'thigh'],
  outcome: ['hit', 'correct_reject', 'miss', 'false_alarm', 'wrong_action'], source: ['', 'camera', 'microphone', 'keyboard', 'touch'] };

async function ImportGameModule(path) {
  const output = ts.transpileModule(await readFile(new URL(path, gameRoot), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

// Runs in the container page after the camera fixture. A microphone request gets a silent stream:
// a white-noise burst sounds like a clap and a low 110 Hz thud like a thigh tap, so the real level proxy and the game's detector decide.
// The sounds play inside the proxy's own audio context. Sent through the stream from a second context, Brave sometimes
// dropped samples, and the gaps made a low thud read as bright as a clap.
export const microphoneFixtureScript = `if (window === window.top) {
  const cameraGetUserMedia = navigator.mediaDevices.getUserMedia;
  const nativeStreamSource = AudioContext.prototype.createMediaStreamSource;
  AudioContext.prototype.createMediaStreamSource = function (stream) {
    if (!window.microphoneFixture || stream !== window.microphoneFixture.stream) return nativeStreamSource.call(this, stream);
    const input = this.createGain();
    window.microphoneFixture.target = { context: this, input };
    return input;
  };
  navigator.mediaDevices.getUserMedia = async function (constraints) {
    if (!constraints?.audio) return cameraGetUserMedia.call(this, constraints);
    const native = await MediaDevices.prototype.getUserMedia.call(navigator.mediaDevices, { audio: true, video: false });
    native.getTracks().forEach(track => track.stop());
    window.nativeMicrophonePermissionVerified = true;
    const silent = new AudioContext();
    await silent.resume();
    const destination = silent.createMediaStreamDestination();
    window.microphoneFixture = { stream: destination.stream, target: null, play(kind, milliseconds = 90) {
      if (!this.target) throw new Error('The microphone proxy has not connected the fixture stream.');
      const { context, input } = this.target;
      const length = Math.round(context.sampleRate * milliseconds / 1000);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let index = 0; index < length; index++) {
        const fade = 1 - index / length;
        samples[index] = fade * (kind === 'clap' ? (Math.random() * 2 - 1) * 0.7 : Math.sin(2 * Math.PI * 110 * index / context.sampleRate) * 0.8);
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(input);
      source.start();
    } };
    return destination.stream;
  };
}`;

export async function CheckEveryBall({ game, evaluate, send, until, standalone, english, capture, checkSpotlight,
  sqlite, gameContext, session, getSaveAttempts, requests, errors, version, accountId, guestSubjectId }) {
  const { copy } = await ImportGameModule('labels.ts');
  const { CreateEveryBallPlans } = await ImportGameModule('logic/everyBallResponse.ts');
  const labels = copy[english ? 'en' : 'zh'];
  const inputMode = microphone ? 'microphone' : 'camera';
  const settings = { difficulty: 'hard', rounds: 10, inputMode, fixationStyle: 'cross', ...(microphone ? { soundSensitivity: 70 } : {}) };
  // Sensitivity stays at its default when it is hidden, and the result still reports it.
  const config = { soundSensitivity: 65, ...settings };
  const inputSession = gameContext.session || session;
  const consent = standalone ? '#camera-consent:not([hidden])' : '.training-overlay-camera-consent';
  const preview = standalone ? '#input-preview' : '.training-input-preview';
  const shell = standalone ? '#game-shell' : '.embedded-training-frame';
  const primary = '.every-ball-tutorial-ready .btn-primary';
  const setInput = (name, value) => game(`(() => {
    const input = document.querySelector('[name=${name}]');
    const prototype = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(String(value))});
    input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  })()`);
  const readInput = name => game(`document.querySelector('[name=${name}]')?.value ?? null`);
  const settingsKept = async label => {
    for (const [name, value] of Object.entries(settings)) assert.equal(await readInput(name), String(value), `${label}: ${name}`);
  };
  const point = selector => game(`(() => { const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; })()`);
  const tap = async selector => {
    const at = await point(selector);
    if (mobile) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] }, inputSession);
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, inputSession);
    } else {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...at }, inputSession);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...at }, inputSession);
    }
  };
  const press = async (key, code, keyCode) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode, ...(key === ' ' ? { text: ' ' } : {}) }, inputSession);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode }, inputSession);
  };
  const phaseIs = name => game(`document.querySelector('.every-ball-root').classList.contains('every-ball-response-phase-${name}')`);
  const progress = () => game(`Number((document.querySelector('.every-ball-hud-item:nth-child(2) strong').textContent.match(/\\d+/) ?? [0])[0])`);
  const trialPhase = () => game(`document.querySelector('.every-ball-stage').dataset.trialPhase`);
  const sensorStarted = () => evaluate(microphone ? 'Boolean(window.microphoneFixture)' : 'Boolean(window.handFixtureStream)');
  const sensorEnded = () => evaluate(`(window.${microphone ? 'microphoneFixture.stream' : 'handFixtureStream'}).getTracks().every(track => track.readyState === 'ended')`);
  const previewHidden = () => evaluate(`document.querySelector('${preview}')?.hidden ?? true`);
  const openConfirmation = async () => {
    await game(`document.querySelector('form .btn-primary').click()`);
    await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'tutorial');
    await game(`document.querySelector('.game-tour button:nth-of-type(2)').click()`);
    await until(() => game(`Boolean(document.querySelector('.training-confirmation'))`), 'Skip tutorial opens the confirmation');
  };
  // The container draws the camera image where the game's camera window is, behind the transparent game.
  const holeMatches = async () => {
    const frame = await evaluate(`(rect => ({ left: rect.left, top: rect.top }))(document.querySelector('${standalone ? '#game-frame' : 'dialog iframe'}').getBoundingClientRect())`);
    const view = await game(`(rect => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height }))(document.querySelector('.every-ball-camera-view').getBoundingClientRect())`);
    const shown = await evaluate(`(rect => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height }))(document.querySelector('${preview}').getBoundingClientRect())`);
    return Math.abs(shown.left - frame.left - view.left) <= 2 && Math.abs(shown.top - frame.top - view.top) <= 2
      && Math.abs(shown.width - view.width) <= 2 && Math.abs(shown.height - view.height) <= 2;
  };

  await until(() => game(`document.querySelector('form h2')?.textContent === ${JSON.stringify(labels.title)}`), 'private init language');
  for (const kind of ['video', 'audio']) {
    assert.match(await game(`(async () => { try { await navigator.mediaDevices.getUserMedia({ ${kind}: true }); return 'allowed'; } catch (error) { return error.name; } })()`),
      /NotAllowedError|SecurityError/, `The sandboxed game cannot open the ${kind} device itself.`);
  }
  assert.equal(await sensorStarted(), false);
  assert.equal(await game(`Boolean(document.querySelector('.game-tour'))`), false, 'The tutorial waits for confirmed settings.');
  assert.equal(await game(`document.querySelector('dialog').matches(':modal')`), true);
  assert.equal(await game('document.activeElement.name'), 'difficulty');
  assert.ok(await game('document.documentElement.scrollWidth <= innerWidth'), 'Settings must not overflow horizontally.');
  assert.equal(await game(`document.querySelector('[name=rounds]').type`), 'range');
  assert.ok(await game(`Boolean(document.querySelector('[name=rounds]').closest('label').querySelector('output'))`), 'Rounds shows its value.');
  assert.equal(await game(`Boolean(document.querySelector('[name=soundSensitivity]'))`), false, 'Microphone sensitivity appears only for microphone detection.');
  await setInput('inputMode', 'microphone');
  await until(() => game(`Boolean(document.querySelector('[name=soundSensitivity]'))`), 'microphone sensitivity slider');
  await capture('settings-microphone');
  await setInput('inputMode', 'camera');
  await until(() => game(`!document.querySelector('[name=soundSensitivity]')`), 'camera detection hides the sensitivity slider');
  await capture('settings');
  // A slider cannot hold an out-of-range value; it clamps to the bounds the game validates.
  await setInput('rounds', 65);
  assert.equal(await readInput('rounds'), '60');
  for (const [name, value] of Object.entries(settings)) await setInput(name, value);
  await settingsKept('chosen');
  assert.match(await game(`document.querySelector('[name=rounds]').closest('label').querySelector('output').textContent`), /^10 /);
  await game(`document.querySelector('[name=fixationStyle]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`);
  await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'first spotlight after Enter confirms');
  assert.equal(await sensorStarted(), false, 'Teaching cannot start the sensor.');
  assert.deepEqual(await game(`[...document.querySelectorAll('.every-ball-rule-card')].map(card => [card.querySelector('strong').textContent, card.querySelector('span').textContent])`),
    [['basketball', 'clap'], ['soccer', 'thigh'], ['tennis', 'none'], ['beach', 'none']].map(([ball, action]) => [labels.ballNames[ball], labels.actionNames[action]]),
    'The rule cards show the balls and actions of the chosen level.');
  await checkSpotlight('.every-ball-rule-cards');
  await game(`document.querySelector('.game-tour button:last-child').click()`);
  await until(() => game(`Boolean(document.querySelector('form'))`), 'tutorial return keeps settings');
  await settingsKept('back from the tutorial');
  assert.equal(await game(`Boolean(document.querySelector('.game-tour-spotlight'))`), false);
  await game(`document.querySelector('form .btn-primary').click()`);
  await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'restarted tutorial');
  for (const target of ['.every-ball-rule-cards', '.every-ball-trial-preview', microphone ? '.every-ball-meter' : '.every-ball-camera', '.every-ball-actions', '.every-ball-hud']) {
    const spotlight = await checkSpotlight(target);
    const intersects = spotlight.target.left < spotlight.panel.right && spotlight.target.right > spotlight.panel.left
      && spotlight.target.top < spotlight.panel.bottom && spotlight.target.bottom > spotlight.panel.top;
    assert.equal(intersects, false, `${target}: the instruction panel leaves the target visible: ${JSON.stringify(spotlight)}`);
    await capture(`tutorial-${target.slice('.every-ball-'.length)}`);
    await game(`document.querySelector('.game-tour button').click()`);
  }
  await until(() => game(`Boolean(document.querySelector('.training-confirmation'))`), 'final confirmation');
  await CheckConfirmationPresentation(game);
  assert.equal(await game(`Boolean(document.querySelector('.game-tour-spotlight'))`), false);
  assert.equal(await game(`document.querySelector('${primary}').textContent`), labels.enable[inputMode], 'The first action turns the sensor on.');
  assert.equal(await game(`document.activeElement === document.querySelector('${primary}')`), true, 'Final confirmation focuses its main action.');
  assert.equal(await evaluate('document.fullscreenElement'), null, 'Tutorial and final confirmation stay windowed.');
  await capture('confirmation');
  await game(`document.querySelector('.every-ball-tutorial-ready .btn-ghost').click()`);
  await until(() => game(`Boolean(document.querySelector('form'))`), 'confirmation returns to settings');
  await settingsKept('back from the confirmation');

  // Declining the container's consent returns to the settings with the reason, and nothing starts.
  await openConfirmation();
  await tap(primary);
  await until(() => evaluate(`Boolean(document.querySelector('${consent}'))`), 'trusted consent from the container');
  assert.match(await evaluate(`document.querySelector('${consent} h2').textContent`), microphone ? /麥克風|microphone/i : /相機|camera/i);
  assert.equal(await evaluate('document.fullscreenElement'), null, 'Consent must be visible outside fullscreen.');
  assert.equal(await game(`document.querySelector('.every-ball-input-status').textContent`), labels.opening[inputMode]);
  assert.equal(await game(`document.querySelector('${primary}').disabled`), true, 'The main action waits while the sensor opens.');
  assert.equal(await evaluate(`(() => { const button = document.querySelector('${consent} button'); const rect = button.getBoundingClientRect();
    return button === document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2); })()`), true, 'Consent accepts a real pointer click.');
  await capture('consent');
  await evaluate(`document.querySelector('${consent} button:last-child').click()`);
  await until(() => game(`document.querySelector('form [role=alert]')?.textContent === ${JSON.stringify(labels.errors[inputMode].permission)}`), 'declined consent returns to settings with the reason');
  assert.equal(await sensorStarted(), false);
  assert.equal(getSaveAttempts(), 0);
  await settingsKept('after declining');

  await openConfirmation();
  await tap(primary);
  await until(() => evaluate(`Boolean(document.querySelector('${consent}'))`), 'consent again');
  await evaluate(`document.querySelector('${consent} button').click()`);
  await until(() => game(`document.querySelector('${primary}')?.textContent === ${JSON.stringify(labels.start)}`), 'sensor ready', 90000);
  assert.equal(await game(`document.querySelector('.every-ball-input-status').textContent`), `${labels.ready[inputMode]}${english ? ' ' : ''}${labels.fullscreenNote}`);
  assert.equal(await evaluate(microphone ? 'window.nativeMicrophonePermissionVerified' : 'window.nativeCameraPermissionVerified'), true);
  assert.equal(await evaluate('document.fullscreenElement'), null, 'Opening the sensor cannot enter fullscreen.');
  assert.equal(await phaseIs('rules'), true, 'Opening the sensor cannot start the trials.');
  if (microphone) {
    assert.ok(requests.some(url => url.includes('/input/microphone-1.0.0/index.js')));
    await until(async () => {
      await evaluate(`window.microphoneFixture.play('clap', 400)`);
      return game(`Number(document.querySelector('.every-ball-meter-level').style.transform.match(/[\\d.]+/)?.[0] ?? 0) > 0.2`);
    }, 'the level bar follows a clap', 10000);
    // Sounds before the first ball do not count; let this one fade before starting.
    await new Promise(resolve => setTimeout(resolve, 800));
  } else {
    await until(() => game(`document.querySelector('.every-ball-camera').classList.contains('is-live')`), 'camera window live');
    await until(() => evaluate(`(preview => preview && !preview.hidden && preview.querySelector('video')?.readyState >= 2)(document.querySelector('${preview}'))`), 'container shows the camera image');
    await until(holeMatches, 'camera image sits in the game camera window');
    await until(() => game(`document.querySelector('.every-ball-hud-status strong').textContent === ${JSON.stringify(labels.tracking)}`), 'real MediaPipe pose proxy finds the hand', 30000);
    assert.ok(await game(`(canvas => { const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      for (let index = 3; index < pixels.length; index += 4) if (pixels[index]) return true; return false; })(document.querySelector('.every-ball-camera-overlay'))`), 'Detected hand points are drawn over the camera image.');
    for (const layer of ['.every-ball-field', '.every-ball-canvas-host']) assert.match(await game(`getComputedStyle(document.querySelector('${layer}')).clipPath`), /^path\(evenodd/, `${layer} leaves a hole for the camera image`);
    assert.ok(requests.some(url => url.includes('/input/pose-tracking-1.0.0/') && url.endsWith('pose_landmarker_lite.task')));
    assert.ok(requests.some(url => url.includes('/input/pose-tracking-1.0.0/wasm/') && url.endsWith('.wasm')));
  }
  assert.equal(requests.some(url => /cdn\.jsdelivr|storage\.googleapis/.test(url)), false, 'Sensor models load from the runner.');
  await capture('sensor-ready');

  const plans = CreateEveryBallPlans(3, settings.rounds, () => 0.5);
  await game('Math.random = () => 0.5');
  await tap(primary);
  await until(() => evaluate(`document.fullscreenElement === document.querySelector('${shell}')`), 'the container enters fullscreen with the game and camera image');
  await until(() => phaseIs('playing'), 'trials started');
  assert.equal(await game('document.fullscreenElement'), null, 'The container holds fullscreen, not the game.');
  assert.ok(await game(`document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight`), 'Stage fits the viewport.');
  assert.equal(await game(`(() => { const actions = document.querySelector('.every-ball-actions').getBoundingClientRect();
    const other = document.querySelector('${microphone ? '.every-ball-hud' : '.every-ball-camera'}').getBoundingClientRect();
    return actions.left < other.right && actions.right > other.left && actions.top < other.bottom && actions.bottom > other.top; })()`), false,
  'The response buttons leave the camera window and the top bar visible.');
  if (!microphone) await until(holeMatches, 'camera image follows the camera window into fullscreen');

  if (process.argv.includes('--stop') || process.argv.includes('--sensor-disconnect')) {
    const stop = process.argv.includes('--stop');
    if (stop) await tap('.every-ball-stop');
    else await evaluate(`window.${microphone ? 'microphoneFixture.stream.getAudioTracks' : 'handFixtureStream.getVideoTracks'}()[0].dispatchEvent(new Event('ended'))`);
    await until(() => game(`Boolean(document.querySelector('form'))`), stop ? 'Stop returns to settings' : 'a lost sensor returns to settings');
    if (!stop) assert.equal(await game(`document.querySelector('form [role=alert]').textContent`), labels.errors[inputMode].disconnected);
    await until(() => evaluate('document.fullscreenElement === null'), 'returning to settings leaves fullscreen');
    await until(sensorEnded, 'returning to settings turns the sensor off');
    assert.equal(await previewHidden(), true);
    assert.equal(getSaveAttempts(), 0);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM training_records').get().count, 0);
    await settingsKept('after stopping');
    assert.deepEqual(errors, []);
    console.log(`every-ball-response: ${stop ? 'Stop' : 'a lost sensor'} ends the session without saving and turns the ${inputMode} off.`);
    return;
  }

  // One miss, one false alarm and one wrong action; every other trial is answered correctly.
  const missTrial = plans.find(plan => plan.expectedAction === 'clap').trialNumber;
  const wrongTrial = plans.find(plan => plan.expectedAction === 'thigh').trialNumber;
  const falseAlarmTrial = plans.find(plan => plan.expectedAction === 'none').trialNumber;
  const respond = async (action, method) => {
    if (method === 'microphone') await evaluate(`window.microphoneFixture.play(${JSON.stringify(action)})`);
    else if (method === 'keyboard') await (action === 'clap' ? press(' ', 'Space', 32) : press('ArrowDown', 'ArrowDown', 40));
    else await tap(`.every-ball-action:nth-child(${action === 'clap' ? 1 : 2})`);
  };
  const expected = [];
  for (const plan of plans) {
    const trial = plan.trialNumber;
    await until(async () => await progress() === trial && await trialPhase() === 'stimulus', `trial ${trial} shows its ball`, 15000);
    if (trial === 1) await capture('playing');
    const action = trial === missTrial ? null : trial === wrongTrial || trial === falseAlarmTrial ? 'clap'
      : plan.expectedAction === 'none' ? null : plan.expectedAction;
    const method = microphone ? 'microphone' : mobile || trial % 2 === 0 ? 'touch' : 'keyboard';
    if (action) await respond(action, method);
    const outcome = action === null ? (plan.expectedAction === 'none' ? 'correct_reject' : 'miss')
      : plan.expectedAction === 'none' ? 'false_alarm' : action === plan.expectedAction ? 'hit' : 'wrong_action';
    expected.push({ plan, action, source: action ? method : '', outcome });
    await until(async () => await game(`Boolean(document.querySelector('.experiment-results'))`) || await progress() > trial
      || await trialPhase() === 'feedback', `trial ${trial} feedback`, 10000);
  }
  await until(() => game(`Boolean(document.querySelector('.experiment-results'))`), 'game-owned results', 20000);
  await until(() => evaluate('document.fullscreenElement === null'), 'results leave fullscreen');
  await until(sensorEnded, 'finishing turns the sensor off');
  assert.equal(await previewHidden(), true, 'The camera image is gone once the results show.');
  await CheckResultsPresentation(game, { defaultMetric: 'responseMs', alternateMetric: 'correct', english, capture });
  const count = outcome => expected.filter(item => item.outcome === outcome).length;
  const correct = count('hit') + count('correct_reject');
  // On a mismatch, print what the check did next to the game's own trial table.
  const table =await game(`document.querySelector('.score-analysis tbody').innerText`);
  assert.equal(await game(`document.querySelector('.score-key-metric strong').textContent`), `${correct} / ${plans.length}`,
    `Expected ${JSON.stringify(expected.map(({ plan, action, source, outcome }) => [plan.trialNumber, plan.ball, action, source, outcome]))}
${table}`);
  assert.deepEqual(await game(`[...document.querySelectorAll('.score-errors dd')].map(item => Number(item.textContent))`), [1, 1, 1]);
  assert.equal(await game(`document.querySelector('.score-row-range').textContent.trim()`), `1–${plans.length} / ${plans.length}`);
  if (standalone) {
    assert.equal(await evaluate('navigator.serviceWorker.ready.then(registration => new URL(registration.scope).pathname)'), `/games/every-ball-response/${version}/`);
    assert.equal(getSaveAttempts(), 0);
    assert.equal(await game(`document.querySelector('.score-save-status').textContent`), labels.localSave);
  } else {
    await until(() => game(`Boolean(document.querySelector('.score-retry-button'))`), 'save failure offers retry');
    await game(`document.querySelector('.score-retry-button').click()`);
    await until(() => game(`document.querySelector('.score-save-status').textContent === ${JSON.stringify(labels.saved)}`), 'retry saved');
    const records = sqlite.prepare('SELECT * FROM training_records').all();
    assert.equal(records.length, 1);
    assert.ok(getSaveAttempts() >= 2);
    assert.equal(records[0].user_id ?? null, accountId);
    if (accountId) assert.notEqual(records[0].subject_id, guestSubjectId); else assert.equal(records[0].subject_id, guestSubjectId);
    const saved = JSON.parse(records[0].payload_json);
    assert.equal(saved.gameId, 'every-ball-response');
    assert.equal(saved.metadata.release_version, version.replaceAll('.', '_'));
    assert.deepEqual(saved.config, config);
    const { summary, rounds } = saved.score;
    assert.deepEqual(rounds.map(({ trial, level, correct: right, ball, expected: wanted, response, outcome, source, fixationMs }) =>
      ({ trial, level, right, ball, wanted, response, outcome, source, fixationMs })), expected.map(({ plan, action, source, outcome }) => ({
      trial: plan.trialNumber, level: 3, right: ['hit', 'correct_reject'].includes(outcome) ? 1 : 0, ball: codes.ball.indexOf(plan.ball),
      wanted: codes.action.indexOf(plan.expectedAction), response: codes.action.indexOf(action ?? 'none'),
      outcome: codes.outcome.indexOf(outcome), source: codes.source.indexOf(source), fixationMs: plan.fixationMs,
    })));
    // Response time starts when the ball appears and fits inside the 1.8 second window.
    assert.ok(rounds.every(row => row.response === 0 ? row.responseMs === null : row.responseMs >= 0 && row.responseMs <= 1800), JSON.stringify(rounds));
    const hits = rounds.filter(row => row.outcome === 0);
    assert.deepEqual({ ...summary }, { trials: plans.length, correct, accuracy: Math.round(correct / plans.length * 100), misses: 1, falseAlarms: 1, wrongActions: 1,
      responseMs: Math.round(hits.reduce((sum, row) => sum + row.responseMs, 0) / hits.length) });
  }
  assert.deepEqual(errors, []);
  assert.ok(!requests.some(url => /every-ball-response.*(?:settings|score)\.json/.test(url)));
  await game(`document.querySelector('.score-return-button').click()`);
  await until(() => standalone ? game(`Boolean(document.querySelector('form'))`) : evaluate(`!document.querySelector('dialog iframe')`), 'return to source');
  assert.equal(await evaluate('document.fullscreenElement'), null);
  console.log(`every-ball-response (${inputMode}): settings, 5 spotlights, consent decline and allow, a real ${microphone ? 'microphone level proxy' : 'MediaPipe pose proxy'}, ${plans.length} graded trials, results and save lifecycle passed.`);
}
