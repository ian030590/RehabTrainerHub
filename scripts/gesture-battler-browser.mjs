import assert from 'node:assert/strict';
import { CheckResultsPresentation } from './r2-game-results-browser.mjs';

export async function CheckGestureBattler({ game, evaluate, send, until, session, gameContext, standalone,
  english, mobile, capture, sqlite, getSaveAttempts, getSessionAttempts, sessionFailure, requests, errors, version, accountId, guestSubjectId }) {
  const body = () => game('document.body.innerText');
  const directed = process.argv.includes('--directed');
  const hp = directed ? 5 : 2;
  await until(() => game('document.querySelector("form h2").textContent').then(title => title === (english ? 'Gesture Command Battle' : '手勢指令對戰')), 'private init applies the selected language');
  const settings = '.gesture-battler-phase-menu';
  const tutorial = '.game-tour';
  const set = (name, value) => game(`(() => { const input=document.querySelector('[name=${name}]'); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(input,${JSON.stringify(String(value))}); input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  const confirm = () => game('document.querySelector("form .btn-primary").click()');
  const skip = () => game('document.querySelector(".game-tour button:nth-of-type(2)").click()');
  assert.match(await game('(async () => {try {await navigator.mediaDevices.getUserMedia({video:true});return "allowed";}catch(error){return error.name;}})()'), /^(NotAllowedError|SecurityError)$/, 'Opaque game cannot acquire the camera.');
  assert.equal(await game('document.querySelector(".game-tour")!==null'), false, 'Settings do not start a tour.');
  assert.equal(await evaluate('Boolean(window.handFixtureStream)'), false, 'Settings do not acquire camera input.');
  await capture('settings');
  await set('enemyMaxHp', 0);
  await confirm();
  assert.ok(await game(`Boolean(document.querySelector('${settings}'))`), 'Invalid durability must not start.');
  await set('enemyMaxHp', hp);
  await set('holdDurationSec', 0.5);
  await set('strictnessPercent', 65);
  if (directed) await game('(() => {const select=document.querySelector("[name=targetMode]");select.value="directed";select.dispatchEvent(new Event("change",{bubbles:true}));})()');
  await confirm();
  await until(() => game(`Boolean(document.querySelector('${tutorial}'))`), 'gesture spotlight');
  for (const target of ['camera', 'calibration', 'moves', 'enemy']) {
    const geometry = await game(`(() => {const target=document.querySelector('.gesture-${target}-tutorial').getBoundingClientRect();const spot=document.querySelector('.game-tour-spotlight').getBoundingClientRect();const panel=document.querySelector('.game-tour').getBoundingClientRect();return {target:{left:target.left,top:target.top,right:target.right,bottom:target.bottom},spot:{left:spot.left,top:spot.top,right:spot.right,bottom:spot.bottom},panel:{left:panel.left,top:panel.top,right:panel.right,bottom:panel.bottom},width:innerWidth,height:innerHeight};})()`);
    for (const edge of ['left', 'top']) assert.ok(geometry.spot[edge] <= geometry.target[edge] + 1);
    for (const edge of ['right', 'bottom']) assert.ok(geometry.spot[edge] >= geometry.target[edge] - 1);
    assert.ok(geometry.panel.left >= 0 && geometry.panel.top >= 0 && geometry.panel.right <= geometry.width + 1 && geometry.panel.bottom <= geometry.height + 1);
    await capture(`tutorial-${target}`);
    await game('window.dispatchEvent(new Event("resize"));document.querySelector(".game-tour button").click()');
  }
  assert.equal(await game('Boolean(document.querySelector(".game-tour-spotlight"))'), false);
  await game('document.querySelector(".gesture-tutorial-ready .btn-ghost").click()');
  await until(() => game(`Boolean(document.querySelector('${settings}'))`), 'back to gesture settings');
  assert.equal(await game('document.querySelector("[name=holdDurationSec]").value'), '0.5');
  assert.equal(await game('document.querySelector("[name=strictnessPercent]").value'), '65');
  assert.equal(await game('document.querySelector(".game-tour-blocker")!==null'), false);
  // Return during a running tour, then exercise skip and the input permission boundary.
  await confirm(); await until(() => game(`Boolean(document.querySelector('${tutorial}'))`), 'tour reopened');
  await game('document.querySelector(".game-tour button:last-child").click()');
  await until(() => game(`Boolean(document.querySelector('${settings}'))`), 'tour back cleans up');
  await confirm(); await until(() => game(`Boolean(document.querySelector('${tutorial}'))`), 'tour before skip');
  await skip();
  await until(() => game('Boolean(document.querySelector(".gesture-tutorial-ready .btn-primary"))'), 'start calibration button');
  await game('document.querySelector(".gesture-tutorial-ready .btn-primary").click()');
  const consentSelector = standalone ? '#camera-consent:not([hidden])' : '.training-overlay-camera-consent';
  await until(() => evaluate(`Boolean(document.querySelector('${consentSelector}'))`), 'trusted camera consent');
  assert.ok((await game('document.querySelector(".gesture-loading-card").textContent')).trim(), 'Loading status must be visible while waiting for camera permission.');
  assert.equal(await evaluate('Boolean(window.handFixtureStream)'), false);
  // Declining input must return to settings and allow a fresh attempt.
  await evaluate(`document.querySelector('${consentSelector} button:last-child').click()`);
  await until(() => game('Boolean(document.querySelector(".gesture-error-overlay"))'), 'camera cancellation feedback');
  await game('document.querySelector(".gesture-error-overlay button").click()');
  await confirm(); await until(() => game(`Boolean(document.querySelector('${tutorial}'))`), 'retry tutorial');
  await skip();
  await game('document.querySelector(".gesture-tutorial-ready .btn-primary").click()');
  await until(() => evaluate(`Boolean(document.querySelector('${consentSelector}'))`), 'retry camera consent');
  await evaluate(`document.querySelector('${consentSelector} button').click()`);
  await until(() => game('Boolean(document.querySelector(".gesture-battler-phase-calibration"))'), 'real MediaPipe initialized', 90000);
  assert.equal(await evaluate('window.nativeCameraPermissionVerified'), true, 'The trusted container must pass the browser camera permission policy.');
  await until(() => game('document.querySelector(".gesture-camera > span")?.textContent.includes(' + JSON.stringify(english ? 'tracked' : '已追蹤') + ')'), 'real MediaPipe sees the recorded hand', 30000);
  assert.ok(requests.some(url => url.includes('/input/hand-tracking-1.0.0/wasm/') && url.endsWith('.wasm')));
  assert.ok(requests.some(url => url.endsWith('/hand_landmarker.task')));
  assert.equal(requests.some(url => /cdn\.jsdelivr|storage\.googleapis/.test(url)), false, 'No external model requests in the browser.');
  await capture('calibration');
  if (process.argv.includes('--camera-disconnect')) {
    await evaluate('window.handFixtureStream.getVideoTracks()[0].dispatchEvent(new Event("ended"))');
    await until(() => game('Boolean(document.querySelector(".gesture-error-overlay"))'), 'disconnected camera feedback');
    assert.equal(await evaluate('window.handFixtureStream.getTracks().every(track=>track.readyState==="ended")'), true);
    assert.equal(getSaveAttempts(), 0);
    await game('document.querySelector(".gesture-error-overlay button").click()');
    assert.ok(await game(`Boolean(document.querySelector('${settings}'))`));
    return;
  }
  if (mobile) {
    await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true }, session);
  }
  for (let step = 1; step <= 7; step++) {
    await evaluate('window.setHandFixture(' + JSON.stringify(['fist', 'right_hands', 'pointing_up', 'victory', 'thumb_up', 'fist', 'right_hands'][step - 1]) + ')');
    await new Promise(resolve => setTimeout(resolve, 1500));
    const advanced = step === 7 ? 'Boolean(document.querySelector(".gesture-battler-phase-combat"))'
      : 'document.querySelector(".gesture-step-count")?.textContent.includes(' + JSON.stringify(`${step + 1} / 7`) + ')';
    for (let attempt = 0; attempt < 3 && !(await game(advanced)); attempt++) {
      await until(() => game('!document.querySelector(".gesture-calibration-actions .btn-primary")?.disabled'), `calibration ${step} ready`);
      await game('document.querySelector(".gesture-calibration-actions .btn-primary").click()');
      await new Promise(resolve => setTimeout(resolve, 200));
      // Sparse frames must retain the game's safety check and offer a fresh capture.
      await until(() => game(`(${advanced}) || !document.querySelector('.gesture-calibration-actions .btn-primary')?.disabled`), `real hand calibration ${step}`, 15000);
    }
    assert.ok(await game(advanced), `Calibration ${step} must collect sufficient stable frames.`);
  }
  await evaluate('window.setHandFixture("pointing_up")');
  if (!mobile) assert.equal(await game('document.fullscreenElement===document.querySelector(".gesture-battler")'), true);
  await capture('combat');
  if (directed) {
    const poses = ['pointing_up', 'victory', 'thumb_up', 'fist', 'right_hands'];
    let previousHp = hp;
    while (previousHp > 0) {
      const target = await game('Number(document.querySelector(".gesture-move-menu header strong").textContent.match(/[1-5]/)[0])');
      await evaluate('window.setHandFixture(' + JSON.stringify(poses[target - 1]) + ')');
      await until(() => game('Number(document.querySelector(".gesture-hp-row strong").textContent.split("/")[0])').then(current => current < previousHp), `directed target ${target} accepted`, 15000);
      previousHp--;
    }
  }
  await until(() => game('Boolean(document.querySelector(".gesture-battler-phase-results"))'), 'actual hand hold attacks and results', 30000);
  await capture('results');
  assert.equal(await evaluate('window.handFixtureStream.getTracks().every(track=>track.readyState==="ended")'), true, 'Results stop the camera.');
  assert.equal(await game('document.querySelectorAll(".results-table:not(.gesture-cast-results) tbody tr").length'), 5);
  assert.equal(await game('document.querySelectorAll(".gesture-cast-results tbody tr").length'), hp);
  await CheckResultsPresentation(game, { defaultMetric: 'similarityPercent', alternateMetric: 'enemyHpAfter', english, capture });
  const viewport = await game('(() => {const rect=document.querySelector(".gesture-battler-stage canvas").getBoundingClientRect();return [Math.round(rect.width),Math.round(rect.height),innerWidth,innerHeight,document.documentElement.scrollWidth];})()');
  assert.equal(viewport[0], viewport[2]); assert.equal(viewport[1], viewport[3]); assert.ok(viewport[4] <= viewport[2]);
  if (standalone) {
    await until(() => evaluate('(async () => Boolean(await caches.match("/input/hand-tracking-1.0.0/hand_landmarker.task")))()'), 'PWA precaches the actual hand model', 30000);
    const registration = await evaluate('(async () => (await navigator.serviceWorker.ready).scope)()');
    assert.ok(registration.endsWith(`/games/gesture-battler/${version}/`));
    const cached = await evaluate('(async () => {const keys=await caches.keys();const cache=await caches.open(keys.find(key=>key.startsWith("trainerhub-game:gesture-battler:")));return (await cache.keys()).map(request=>new URL(request.url).pathname);})()');
    assert.ok(cached.some(path => path.endsWith('/vision_wasm_internal.wasm')));
    assert.ok(cached.every(path => path.startsWith(`/games/gesture-battler/${version}/`) || path.startsWith('/runtime/') || path.startsWith('/input/hand-tracking-1.0.0/')));
    assert.match(await body(), english ? /Open from Hub/ : /從 Hub 開啟/);
    assert.equal(getSaveAttempts(), 0);
  } else {
    await until(() => body().then(text => text.includes(english ? 'Retry save' : '重試保存')), 'save error retained');
    await game('Array.from(document.querySelectorAll(".experiment-results button")).find(button=>button.textContent.includes(' + JSON.stringify(english ? 'Retry save' : '重試保存') + ')).click()');
    await until(() => body().then(text => text.includes(english ? 'Record saved' : '紀錄已保存')), 'saved acknowledgement');
    const rows = sqlite.prepare('SELECT payload_json,user_id,subject_id FROM training_records').all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].user_id, accountId);
    assert.equal(rows[0].subject_id === guestSubjectId, accountId === null);
    const record = JSON.parse(rows[0].payload_json);
    assert.deepEqual(record.config, { enemyMaxHp: hp, holdDurationSec: 0.5, strictnessPercent: 65, targetMode: directed ? 'directed' : 'free' });
    assert.equal(record.score.summary.successfulCasts, hp);
    assert.equal(record.score.rounds.filter(row => row.kind === 0).length, 5);
    const casts = record.score.rounds.filter(row => row.kind === 1);
    assert.equal(casts.length, hp);
    if (directed) assert.ok(casts.every(row => row.gesture === row.targetGesture), 'Only the requested gesture can attack.');
    assert.equal(record.metadata.release_version, version.replaceAll('.', '_'));
    assert.ok(getSaveAttempts() >= 2);
    assert.equal(getSessionAttempts(), sessionFailure ? 2 : 1);
  }
  assert.equal(requests.some(url => /gesture-battler.*(?:settings|score)\.json/.test(url)), false);
  assert.deepEqual(errors, []);
  await game('document.querySelector(".experiment-results > button:last-child").click()');
  await until(() => standalone ? game(`Boolean(document.querySelector('${settings}'))`) : evaluate('!document.querySelector("dialog.training-overlay")'), 'gesture returns to its entry');
  if (standalone) assert.equal(await game('document.fullscreenElement===null'), true, 'Return restores the standalone entry viewport.');
  assert.equal(await evaluate('window.handFixtureStream.getTracks().every(track=>track.readyState==="ended")'), true);
  console.log('Gesture Brave passed: spotlight, settings, trusted consent, real MediaPipe hand inference, seven calibrations, combat, full numeric results, retry and camera cleanup.');
}
