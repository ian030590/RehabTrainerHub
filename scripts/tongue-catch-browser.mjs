import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { CheckConfirmationPresentation } from './r2-game-ui-browser.mjs';
import { CheckResultsPresentation } from './r2-game-results-browser.mjs';

const gameRoot = new URL('../apps/rehabtrainerhub/games/tongue-catch/', import.meta.url);
const mobile = process.argv.includes('--mobile');
const directions = ['Rest', 'Tongue_Left', 'Tongue_Right'];

async function ImportGameModule(path) {
  const output = ts.transpileModule(await readFile(new URL(path, gameRoot), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

// Runs in the container page. The camera shows a still portrait; for a left or right movement a red mark is drawn
// beside the mouth, so the real face model and tongue classifier in the container learn three different mouth images.
export function FaceFixtureScript(portraitDataUrl) {
  return `if (window === window.top) {
  const nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async constraints => {
    if (!constraints?.video) return nativeGetUserMedia(constraints);
    const native = await nativeGetUserMedia({ video: true, audio: false });
    native.getTracks().forEach(track => track.stop());
    window.nativeCameraPermissionVerified = true;
    const image = new Image();
    image.src = ${JSON.stringify(portraitDataUrl)};
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 720;
    const context = canvas.getContext('2d');
    window.tongueFixture = { mode: 'Rest', mouth: null };
    const draw = () => {
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
      context.drawImage(image, (canvas.width - image.width * scale) / 2, (canvas.height - image.height * scale) / 2, image.width * scale, image.height * scale);
      const { mode, mouth } = window.tongueFixture;
      if (mode === 'Rest' || !mouth) return;
      // The camera image is not mirrored, so the person's left is the image's right.
      const side = mode === 'Tongue_Left' ? 1 : -1;
      context.fillStyle = 'rgb(225, 29, 72)';
      context.beginPath();
      context.ellipse((mouth.x + side * window.tongueFixture.offset) * canvas.width, (mouth.y + 0.02) * canvas.height,
        window.tongueFixture.radius * canvas.width, window.tongueFixture.radius * 0.7 * canvas.width, 0, 0, Math.PI * 2);
      context.fill();
    };
    window.tongueFixture.offset = 0.03;
    window.tongueFixture.radius = 0.025;
    draw();
    const stream = canvas.captureStream(15);
    window.faceFixtureStream = stream;
    const timer = setInterval(() => { if (stream.getTracks().every(track => track.readyState === 'ended')) clearInterval(timer); else draw(); }, 66);
    return stream;
  };
}`;
}

export async function CheckTongueCatch({ game, evaluate, send, until, standalone, english, capture, checkSpotlight,
  sqlite, gameContext, session, getSaveAttempts, requests, errors, version, accountId, guestSubjectId }) {
  const { copy } = await ImportGameModule('labels.ts');
  const labels = copy[english ? 'en' : 'zh'];
  // A short session with many apples: the held right movement keeps the tongue out to the right edge.
  const settings = { sensitivityPercent: 65, durationSec: 30, edgeChancePercent: 0, growthRate: 360, appleSpeed: 260, spawnIntervalSec: 1 };
  const inputSession = gameContext.session || session;
  const consent = standalone ? '#camera-consent:not([hidden])' : '.training-overlay-camera-consent';
  const preview = standalone ? '#input-preview' : '.training-input-preview';
  const shell = standalone ? '#game-shell' : '.embedded-training-frame';
  const frameSelector = standalone ? '#game-frame' : 'dialog iframe';
  const primary = '.tongue-tutorial-ready .btn-primary';
  const setInput = (name, value) => game(`(() => {
    const input = document.querySelector('[name=${name}]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(String(value))});
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  const readInput = name => game(`document.querySelector('[name=${name}]')?.value ?? null`);
  const settingsKept = async label => {
    for (const [name, value] of Object.entries(settings)) assert.equal(Number(await readInput(name)), value, `${label}: ${name}`);
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
  const phaseIs = name => game(`document.querySelector('.tongue-root').classList.contains('tongue-catch-phase-${name}')`);
  const fieldOpacity = () => game(`getComputedStyle(document.querySelector('.tongue-field')).opacity`);
  const faceStatus = () => game(`document.querySelector('.tongue-hud-status strong').textContent`);
  const sensorStarted = () => evaluate('Boolean(window.faceFixtureStream)');
  const sensorEnded = () => evaluate(`window.faceFixtureStream.getTracks().every(track => track.readyState === 'ended')`);
  const previewHidden = () => evaluate(`document.querySelector('${preview}')?.hidden ?? true`);
  const openConfirmation = async () => {
    await game(`document.querySelector('form .btn-primary').click()`);
    await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'tutorial');
    await game(`document.querySelector('.game-tour button:nth-of-type(2)').click()`);
    await until(() => game(`Boolean(document.querySelector('.training-confirmation'))`), 'Skip tutorial opens the confirmation');
  };
  // The container draws the camera image over the area the game names, behind the transparent game.
  const previewMatches = async selector => {
    const frame = await evaluate(`(rect => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height }))(document.querySelector('${frameSelector}').getBoundingClientRect())`);
    const area = selector ? await game(`(rect => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height }))(document.querySelector('${selector}').getBoundingClientRect())`)
      : { left: 0, top: 0, width: frame.width, height: frame.height };
    const shown = await evaluate(`(element => { if (!element || element.hidden) return null; const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }; })(document.querySelector('${preview}'))`);
    return Boolean(shown) && Math.abs(shown.left - frame.left - area.left) <= 2 && Math.abs(shown.top - frame.top - area.top) <= 2
      && Math.abs(shown.width - area.width) <= 2 && Math.abs(shown.height - area.height) <= 2;
  };
  // The game only learns the mouth position from the container's frames; the fixture draws its mark there.
  const followMouth = async () => {
    const mouth = await game(`window.__tongueCheckFrame?.mouth ?? null`);
    if (mouth) await evaluate(`window.tongueFixture.mouth = ${JSON.stringify(mouth)}`);
    return mouth;
  };

  await until(() => game(`document.querySelector('form h2')?.textContent === ${JSON.stringify(labels.title)}`), 'private init language');
  assert.match(await game(`(async () => { try { await navigator.mediaDevices.getUserMedia({ video: true }); return 'allowed'; } catch (error) { return error.name; } })()`),
    /NotAllowedError|SecurityError|TypeError/, 'The sandboxed game cannot open the camera itself.');
  await game(`window.addEventListener('game:input', event => { if (event.detail.type === 'frame') window.__tongueCheckFrame = event.detail.payload; })`);
  assert.equal(await sensorStarted(), false);
  assert.equal(await game(`Boolean(document.querySelector('.game-tour'))`), false, 'The tutorial waits for confirmed settings.');
  assert.equal(await game(`document.querySelector('dialog').matches(':modal')`), true);
  assert.equal(await game('document.activeElement.name'), 'sensitivityPercent');
  assert.ok(await game('document.documentElement.scrollWidth <= innerWidth'), 'Settings must not overflow horizontally.');
  assert.deepEqual(await game(`[...document.querySelectorAll('form input[type=range]')].map(input => input.name)`), Object.keys(settings),
    'The three Hub settings and the three settings of the original in-game panel are all in the form.');
  assert.ok(await game(`[...document.querySelectorAll('form input[type=range]')].every(input => input.closest('label').querySelector('output'))`), 'Every slider shows its value.');
  await capture('settings');
  // A slider cannot hold an out-of-range value; it clamps to the bounds the game validates.
  await setInput('durationSec', 400);
  assert.equal(await readInput('durationSec'), '300');
  for (const [name, value] of Object.entries(settings)) await setInput(name, value);
  await settingsKept('chosen');
  assert.equal(await game(`document.querySelector('[name=spawnIntervalSec]').closest('label').querySelector('output').textContent`), labels.seconds(1));
  await game(`document.querySelector('[name=spawnIntervalSec]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`);
  await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'first spotlight after Enter confirms');
  assert.equal(await sensorStarted(), false, 'Teaching cannot start the camera.');
  assert.deepEqual(await game(`[...document.querySelectorAll('.tongue-preview-step strong')].map(item => item.textContent)`),
    directions.map(label => labels.calibration[label].short), 'The tutorial shows the three calibration steps.');
  await checkSpotlight('.tongue-preview-calibration');
  await game(`document.querySelector('.game-tour button:last-child').click()`);
  await until(() => game(`Boolean(document.querySelector('form'))`), 'tutorial return keeps settings');
  await settingsKept('back from the tutorial');
  assert.equal(await game(`Boolean(document.querySelector('.game-tour-spotlight'))`), false);
  await game(`document.querySelector('form .btn-primary').click()`);
  await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'restarted tutorial');
  for (const target of ['.tongue-preview-calibration', '.tongue-preview-mouth', '.tongue-preview-apples', '.tongue-hud']) {
    const spotlight = await checkSpotlight(target);
    const intersects = spotlight.target.left < spotlight.panel.right && spotlight.target.right > spotlight.panel.left
      && spotlight.target.top < spotlight.panel.bottom && spotlight.target.bottom > spotlight.panel.top;
    assert.equal(intersects, false, `${target}: the instruction panel leaves the target visible: ${JSON.stringify(spotlight)}`);
    await capture(`tutorial-${target.slice('.tongue-'.length)}`);
    await game(`document.querySelector('.game-tour button').click()`);
  }
  await until(() => game(`Boolean(document.querySelector('.training-confirmation'))`), 'final confirmation');
  await CheckConfirmationPresentation(game);
  assert.equal(await game(`document.querySelector('${primary}').textContent`), labels.enable, 'The first action turns the camera on.');
  assert.equal(await game(`document.activeElement === document.querySelector('${primary}')`), true, 'Final confirmation focuses its main action.');
  assert.equal(await evaluate('document.fullscreenElement'), null, 'Tutorial and final confirmation stay windowed.');
  assert.equal(await fieldOpacity(), '1', 'Without the camera the field is opaque.');
  await capture('confirmation');
  await game(`document.querySelector('.tongue-tutorial-ready .btn-ghost').click()`);
  await until(() => game(`Boolean(document.querySelector('form'))`), 'confirmation returns to settings');
  await settingsKept('back from the confirmation');

  // Declining the container's consent returns to the settings with the reason, and nothing starts.
  await openConfirmation();
  await tap(primary);
  await until(() => evaluate(`Boolean(document.querySelector('${consent}'))`), 'trusted consent from the container');
  assert.match(await evaluate(`document.querySelector('${consent} h2').textContent`), /相機|camera/i);
  assert.equal(await evaluate('document.fullscreenElement'), null, 'Consent must be visible outside fullscreen.');
  assert.equal(await game(`document.querySelector('.tongue-input-status').textContent`), labels.opening);
  assert.equal(await game(`document.querySelector('${primary}').disabled`), true, 'The main action waits while the camera opens.');
  await capture('consent');
  await evaluate(`document.querySelector('${consent} button:last-child').click()`);
  await until(() => game(`document.querySelector('form [role=alert]')?.textContent === ${JSON.stringify(labels.errors.permission)}`), 'declined consent returns to settings with the reason');
  assert.equal(await sensorStarted(), false);
  assert.equal(getSaveAttempts(), 0);
  await settingsKept('after declining');

  await openConfirmation();
  await tap(primary);
  await until(() => evaluate(`Boolean(document.querySelector('${consent}'))`), 'consent again');
  await evaluate(`document.querySelector('${consent} button').click()`);
  await until(() => game(`document.querySelector('${primary}')?.textContent === ${JSON.stringify(labels.start)}`), 'camera ready', 90000);
  assert.equal(await game(`document.querySelector('.tongue-input-status').textContent`), `${labels.ready}${english ? ' ' : ''}${labels.fullscreenNote}`);
  assert.equal(await evaluate('window.nativeCameraPermissionVerified'), true);
  assert.equal(await evaluate('document.fullscreenElement'), null, 'Opening the camera cannot enter fullscreen.');
  assert.equal(await phaseIs('rules'), true, 'Opening the camera cannot start calibration.');
  await until(() => previewMatches(null), 'the container shows the camera image behind the whole game');
  await until(async () => await fieldOpacity() === '0.22', 'the camera shows through the field at the original 78% opacity');
  await until(async () => await faceStatus() === labels.tracking, 'real MediaPipe face proxy finds the face', 60000);
  assert.ok(requests.some(url => url.includes('/input/tongue-tracking-1.0.0/') && url.endsWith('face_landmarker.task')));
  assert.ok(requests.some(url => url.includes('/input/tongue-tracking-1.0.0/wasm/') && url.endsWith('.wasm')));
  assert.equal(requests.some(url => /cdn\.jsdelivr|storage\.googleapis|tfhub/.test(url)), false, 'Face and tongue models load from the runner.');
  const frame = await game('window.__tongueCheckFrame');
  assert.deepEqual(Object.keys(frame).sort(), ['confidence', 'face', 'label', 'mouth', 'samples', 'timestamp', 'videoHeight', 'videoWidth'],
    'The game receives the mouth position and direction only.');
  assert.deepEqual([frame.face, frame.label, frame.samples], [true, null, { Rest: 0, Tongue_Left: 0, Tongue_Right: 0 }]);
  await until(followMouth, 'mouth position');
  await capture('camera-ready');

  await tap(primary);
  await until(() => evaluate(`document.fullscreenElement === document.querySelector('${shell}')`), 'the container enters fullscreen with the game and camera image');
  await until(() => phaseIs('calibration'), 'calibration started');
  assert.equal(await game('document.fullscreenElement'), null, 'The container holds fullscreen, not the game.');
  await until(() => previewMatches('.tongue-calibration-camera-space'), 'calibration shows the camera image beside the instructions');
  await until(async () => await fieldOpacity() === '0', 'the field is hidden while calibrating');
  assert.equal(await game(`Boolean(document.querySelector('.tongue-hud'))`), false,
    'Calibration shows only the camera and the calibration card, as the original did; the play clock and Stop come with play.');
  assert.ok(await game(`document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight`), 'Calibration fits the viewport.');
  for (const [index, label] of directions.entries()) {
    assert.equal(await game(`document.querySelector('.tongue-calibration-card h1').textContent`), labels.calibration[label].title);
    assert.equal(await game(`document.querySelector('.tongue-step-count').textContent`), labels.calibrationStep(index + 1, directions.length));
    await followMouth();
    await evaluate(`window.tongueFixture.mode = ${JSON.stringify(label)}`);
    await new Promise(done => setTimeout(done, 400));
    if (index === 0) await capture('calibration');
    await tap('.tongue-calibration-actions .btn-primary');
    await until(() => game(`document.querySelector('.tongue-calibration-actions .btn-primary')?.disabled ?? true`), `${label} capture started`);
    await until(async () => await phaseIs('playing') || await game(`document.querySelector('.tongue-step-count')?.textContent`) === labels.calibrationStep(index + 2, directions.length),
      `${label} captured for 1.9 s with 10 samples`, 15000);
  }
  await until(() => phaseIs('playing'), 'play starts after the third movement');
  const samples = (await game('window.__tongueCheckFrame')).samples;
  assert.ok(directions.every(label => samples[label] >= 10), `Each movement has at least 10 samples: ${JSON.stringify(samples)}`);
  await until(() => previewMatches(null), 'the camera image is behind the whole game again during play');
  await until(async () => await fieldOpacity() === '0.22', 'the field thins out again during play');
  await until(async () => (await game('window.__tongueCheckFrame'))?.label === 'Tongue_Right', 'the classifier recognizes the held right movement', 10000);
  await capture('playing');

  if (process.argv.includes('--stop') || process.argv.includes('--sensor-disconnect')) {
    const stop = process.argv.includes('--stop');
    if (stop) await tap('.tongue-stop');
    else await evaluate(`window.faceFixtureStream.getVideoTracks()[0].dispatchEvent(new Event('ended'))`);
    await until(() => game(`Boolean(document.querySelector('form'))`), stop ? 'Stop returns to settings' : 'a lost camera returns to settings');
    if (!stop) assert.equal(await game(`document.querySelector('form [role=alert]').textContent`), labels.errors.disconnected);
    await until(() => evaluate('document.fullscreenElement === null'), 'returning to settings leaves fullscreen');
    await until(sensorEnded, 'returning to settings turns the camera off');
    assert.equal(await previewHidden(), true);
    assert.equal(getSaveAttempts(), 0);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM training_records').get().count, 0);
    await settingsKept('after stopping');
    assert.deepEqual(errors, []);
    console.log(`tongue-catch: ${stop ? 'Stop' : 'a lost camera'} ends the session without saving and turns the camera off.`);
    return;
  }

  await until(() => game(`Number(document.querySelector('.tongue-hud-item:nth-child(2) strong').textContent) > 0`), 'the extended tongue catches an apple', 20000);
  await until(() => game(`Boolean(document.querySelector('.experiment-results'))`), 'game-owned results', 45000);
  await until(() => evaluate('document.fullscreenElement === null'), 'results leave fullscreen');
  await until(sensorEnded, 'finishing turns the camera off');
  assert.equal(await previewHidden(), true, 'The camera image is gone once the results show.');
  await CheckResultsPresentation(game, { defaultMetric: 'caught', alternateMetric: 'position', english, capture });
  const shown = await game(`[...document.querySelectorAll('.score-key-metric strong')].map(item => item.textContent)`);
  const [caught, missed] = shown.map(Number);
  assert.ok(caught > 0 && missed >= 0, JSON.stringify(shown));
  if (standalone) {
    assert.equal(await evaluate('navigator.serviceWorker.ready.then(registration => new URL(registration.scope).pathname)'), `/games/tongue-catch/${version}/`);
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
    assert.equal(saved.gameId, 'tongue-catch');
    assert.equal(saved.metadata.release_version, version.replaceAll('.', '_'));
    assert.deepEqual(saved.config, settings);
    const { summary, rounds } = saved.score;
    assert.deepEqual(Object.keys(summary), ['duration', 'caught', 'missed', 'holdSeconds', 'threshold', 'catchRate']);
    assert.deepEqual([summary.caught, summary.missed, summary.threshold], [caught, missed, 0.65]);
    assert.ok(summary.duration >= 30 && summary.duration <= 30.2, JSON.stringify(summary));
    assert.ok(summary.holdSeconds > 0, 'The held movement counts as a hold.');
    assert.equal(summary.catchRate, Math.round(caught / (caught + missed) * 100));
    assert.equal(rounds.filter(row => row.caught === 1).length, caught);
    assert.ok(rounds.every((row, index) => row.object === index + 1 && [0, 1].includes(row.caught) && row.position >= -100 && row.position <= 100), JSON.stringify(rounds));
    // With no edge apples every apple falls in the middle band.
    assert.ok(rounds.every(row => row.position >= -46 && row.position <= 46), JSON.stringify(rounds));
  }
  assert.deepEqual(errors, []);
  assert.ok(!requests.some(url => /tongue-catch.*(?:settings|score)\.json/.test(url)));
  await game(`document.querySelector('.score-return-button').click()`);
  await until(() => standalone ? game(`Boolean(document.querySelector('form'))`) : evaluate(`!document.querySelector('dialog iframe')`), 'return to source');
  assert.equal(await evaluate('document.fullscreenElement'), null);
  console.log(`tongue-catch: settings, 4 spotlights, consent decline and allow, a real MediaPipe face proxy, calibration of 3 movements, ${caught} caught and ${missed} missed apples, results and save lifecycle passed.`);
}
