import assert from 'node:assert/strict';
import { CheckResultsPresentation } from './r2-game-results-browser.mjs';
import { CheckConfirmationPresentation } from './r2-game-ui-browser.mjs';

// Uses the shared real runner/CSP, private channel and local SQLite harness.
export async function CheckAsteroidShield({ game, evaluate, send, until, gameContext, session, version,
  standalone, sqlite, requests, errors, saveAttempts, sessionAttempts, sessionFailure, capture, accountId, guestSubjectId }) {
  const soundOn = process.argv.includes('--sound-on');
  const english = process.argv.includes('--english');
  await until(() => game(`document.querySelector("form h2").textContent === ${JSON.stringify(english ? 'Asteroid Shield Defense' : '小行星護盾防衛')}`), 'private init applies the selected language');
  assert.equal(await game('document.querySelector("form h2").textContent'), english ? 'Asteroid Shield Defense' : '小行星護盾防衛');
  if (process.argv.includes('--renderer-failure')) {
    await until(() => game('Boolean(document.querySelector("dialog.game-settings-dialog .renderer-error"))'), 'renderer failure visible inside foreground settings');
    const notice = await game(`(() => {
      const element = document.querySelector('dialog .renderer-error'); const rect = element.getBoundingClientRect();
      return {message:element.textContent,top:rect.top,bottom:rect.bottom,height:rect.height,viewport:innerHeight,
        modal:document.querySelector('dialog').matches(':modal')};
    })()`);
    assert.equal(notice.modal, true);
    assert.ok(notice.height > 0 && notice.top >= 0 && notice.bottom <= notice.viewport);
    assert.ok(notice.message.includes(english ? 'The game could not load' : '遊戲無法載入'));
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM training_records').get().count, 0);
    assert.deepEqual(errors, []);
    await capture('renderer-error');
    console.log('Asteroid R2 renderer failure passed: visible modal notice; no record created.');
    return;
  }
  const checkSettingsPreview = async () => {
    assert.equal(await game('Boolean(document.querySelector(".asteroid-shield-tutorial"))'), true, 'Render the tutorial scene before configuring the game.');
    await until(() => game('Array.from(document.querySelectorAll(".mock-asteroid-group img")).every(image => image.complete && image.naturalWidth > 0)'), 'preview asteroid textures loaded');
    await until(() => game('Boolean(document.querySelector(".asteroid-shield-stage canvas"))'), 'background renderer and textures ready');
    const state = await game(`(() => {
      const dialog = document.querySelector('dialog.game-settings-dialog');
      const scene = document.querySelector('.asteroid-shield-tutorial');
      if (!dialog) return null;
      const rect = dialog.getBoundingClientRect();
      return {modal: dialog.matches(':modal'), labelled: dialog.getAttribute('aria-labelledby') === document.querySelector('form h2').id,
        sceneBackground: getComputedStyle(scene).backgroundImage,
        shipBackground: getComputedStyle(document.querySelector('.mock-spaceship')).backgroundImage,
        shieldBackground: getComputedStyle(document.querySelector('.mock-shield')).backgroundImage,
        shipWidth:document.querySelector('.mock-spaceship').getBoundingClientRect().width,
        left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,viewport:innerWidth,height:innerHeight,
        formScrollWidth:document.querySelector('form').scrollWidth,dialogWidth:dialog.clientWidth};
    })()`);
    assert.ok(state?.modal, 'Settings must be a foreground modal dialog.');
    assert.equal(state.labelled, true);
    assert.ok(state.shipWidth > state.viewport * 0.5, 'Tutorial must preview the wide bottom ship.');
    for (const key of ['sceneBackground', 'shipBackground', 'shieldBackground']) assert.notEqual(state[key], 'none');
    assert.ok(state.left >= 15 && state.right <= state.viewport - 15 && state.top >= 15 && state.bottom <= state.height - 15, JSON.stringify(state));
    assert.ok(state.formScrollWidth <= state.dialogWidth, 'The dialog must not overflow horizontally.');
    await game('new Promise(resolve => setTimeout(resolve, 500))');
    assert.equal(await game('Boolean(document.querySelector(".game-tour, .game-tour-spotlight"))'), false, 'Preview must wait for confirmation before starting the tour.');
    await game('void (window.asteroidPreviewScene = document.querySelector(".asteroid-shield-tutorial"))');
    await game('Array.from(document.querySelectorAll("form button")).at(-1).focus()');
    const pointerSession = gameContext.session || session;
    await send('Input.dispatchKeyEvent', {type:'keyDown', key:'Tab', code:'Tab', windowsVirtualKeyCode:9}, pointerSession);
    await send('Input.dispatchKeyEvent', {type:'keyUp', key:'Tab', code:'Tab', windowsVirtualKeyCode:9}, pointerSession);
    assert.equal(await game('document.activeElement === document.querySelector("form select")'), true, 'Tab stays within the settings dialog.');
    await send('Input.dispatchKeyEvent', {type:'keyDown', key:'Tab', code:'Tab', windowsVirtualKeyCode:9, modifiers:8}, pointerSession);
    await send('Input.dispatchKeyEvent', {type:'keyUp', key:'Tab', code:'Tab', windowsVirtualKeyCode:9, modifiers:8}, pointerSession);
    assert.equal(await game('document.activeElement === Array.from(document.querySelectorAll("form button")).at(-1)'), true, 'Shift-Tab wraps back to the last dialog control.');
    await game('document.querySelector("form select").focus(); document.querySelector("dialog.game-settings-dialog").scrollTop = 0');
  };
  await checkSettingsPreview();
  await game(`(() => {
    window.asteroidSoundCount = 0;
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function(...args) { window.asteroidSoundCount++; return create.apply(this, args); };
  })()`);
  assert.equal(await game('document.querySelectorAll("form input[type=range]").length'), 2);
  assert.deepEqual(await game('Array.from(document.querySelectorAll("form input[type=range]")).map(input => [input.min,input.max,input.step,input.value])'),
    [['30', '300', '15', '90'], ['1', '10', '1', '5']]);
  assert.equal(await game('document.querySelector("form select").value'), 'medium');
  assert.equal(await game('document.querySelector("form input[type=checkbox]").checked'), true);
  assert.ok(await game('document.documentElement.scrollWidth <= innerWidth'));
  await capture('settings');
  const set = async (selector, value) => game(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new Event('input', {bubbles:true}));
    element.dispatchEvent(new Event('change', {bubbles:true}));
  })()`);
  await set('form select', 'hard');
  await set('form input[type=range]', '300');
  await game(`(() => {
    const input = document.querySelectorAll('form input[type=range]')[1];
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '10');
    input.dispatchEvent(new Event('input', {bubbles:true})); input.dispatchEvent(new Event('change', {bubbles:true}));
  })()`);
  await game('document.querySelector("form input[type=checkbox]").click()');
  assert.equal(await game('document.querySelectorAll("form input[type=range]")[1].value'), '10');
  await game('document.querySelector("form .btn-primary").click()');
  await until(() => game('Boolean(document.querySelector(".game-tour"))'), 'asteroid three-step tutorial');
  assert.equal(await game('document.querySelector("dialog.game-settings-dialog")'), null);
  assert.equal(await game('window.asteroidPreviewScene === document.querySelector(".asteroid-shield-tutorial")'), true, 'Continue with the already rendered tutorial scene.');
  const checkSpotlight = async selector => {
    const state = await game(`(() => {
      const target = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      const spotlight = document.querySelector('.game-tour-spotlight').getBoundingClientRect();
      const panel = document.querySelector('.game-tour').getBoundingClientRect();
      return {target: {left:target.left,top:target.top,right:target.right,bottom:target.bottom},
        spotlight: {left:spotlight.left,top:spotlight.top,right:spotlight.right,bottom:spotlight.bottom},
        panel: {left:panel.left,top:panel.top,right:panel.right,bottom:panel.bottom}, width:innerWidth,height:innerHeight};
    })()`);
    for (const edge of ['left', 'top']) assert.ok(state.spotlight[edge] <= state.target[edge] + 1, `${selector}: ${JSON.stringify(state)}`);
    for (const edge of ['right', 'bottom']) assert.ok(state.spotlight[edge] >= state.target[edge] - 1, `${selector}: ${JSON.stringify(state)}`);
    assert.ok(state.panel.left >= 0 && state.panel.top >= 0 && state.panel.right <= state.width + 1 && state.panel.bottom <= state.height + 1);
  };
  await checkSpotlight('.mock-asteroid-group');
  await capture('tutorial');
  assert.equal(await game('document.fullscreenElement'), null, 'Asteroid tutorial remains windowed.');
  await game('document.querySelector(".asteroid-shield-tutorial .ui-button").click()');
  await until(() => game('Boolean(document.querySelector("form"))'), 'settings round trip');
  await checkSettingsPreview();
  assert.equal(await game('document.querySelector(".game-tour-spotlight")'), null);
  assert.deepEqual(await game('Array.from(document.querySelectorAll("form input[type=range]")).map(input => input.value)'), ['300', '10']);
  assert.equal(await game('document.querySelector("form select").value'), 'hard');
  assert.equal(await game('document.querySelector("form input[type=checkbox]").checked'), false);
  await set('form select', 'easy');
  await set('form input[type=range]', '30');
  if (soundOn) await game('document.querySelector("form input[type=checkbox]").click()');
  await game(`(() => {
    const input = document.querySelectorAll('form input[type=range]')[1];
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'1');
    input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true}));
    document.querySelector('form select').focus();
  })()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }, gameContext.session || session);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }, gameContext.session || session);
  await until(() => game('Boolean(document.querySelector(".game-tour"))'), 'keyboard opens tutorial without native form submission');
  const viewport = await game('[innerWidth,innerHeight]');
  await send('Emulation.setDeviceMetricsOverride', { width: viewport[0] - 20, height: viewport[1] - 20, deviceScaleFactor: 1, mobile: process.argv.includes('--mobile') }, session);
  await until(() => game(`innerWidth === ${viewport[0] - 20}`), 'tutorial viewport shrinks');
  await game('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  await checkSpotlight('.mock-asteroid-group');
  await send('Emulation.setDeviceMetricsOverride', { width: viewport[0], height: viewport[1], deviceScaleFactor: 1, mobile: process.argv.includes('--mobile') }, session);
  await until(() => game(`innerWidth === ${viewport[0]}`), 'tutorial viewport restores');
  await game('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  for (const selector of ['.mock-asteroid-group', '.mock-spaceship', '.mock-shield']) {
    await checkSpotlight(selector);
    await game('document.querySelector(".game-tour button").click()');
  }
  assert.equal(await game('Boolean(document.querySelector(".game-tour-spotlight"))'), false);
  assert.ok(await game('document.querySelector(".asteroid-shield-tutorial").textContent.includes("75%")'));
  assert.ok(await game('document.querySelector(".asteroid-shield-tutorial").textContent.includes("30s")'));
  await CheckConfirmationPresentation(game);
  await capture('confirmation');
  await until(() => game('!document.querySelector(".asteroid-shield-tutorial .ui-button-primary").disabled'), 'Pixi textures ready');
  await game('document.querySelector(".asteroid-shield-tutorial .ui-button-primary").click()');
  await until(() => game('Boolean(document.querySelector(".asteroid-shield-phase-playing canvas"))'), 'real asteroid gameplay');
  assert.equal(await game('document.querySelector(".asteroid-shield-tutorial, dialog.game-settings-dialog")'), null);
  assert.equal(await game('document.fullscreenElement === document.querySelector(".asteroid-shield-game")'), true);
  await until(() => game(`(() => {
    const app = window.asteroidPixiApp;
    const key = [innerWidth,innerHeight,app.screen.width,app.screen.height].join(',');
    if (window.asteroidViewportState?.key !== key) {
      window.asteroidViewportState = {key,since:performance.now()}; return false;
    }
    return performance.now()-window.asteroidViewportState.since >= 500
      && app.screen.width === innerWidth && app.screen.height === innerHeight;
  })()`), 'fullscreen viewport and renderer stabilize');
  const canvas = await game('(() => { const canvas=document.querySelector("canvas").getBoundingClientRect();return [Math.round(canvas.width),Math.round(canvas.height),innerWidth,innerHeight]; })()');
  assert.equal(canvas[0], canvas[2]); assert.equal(canvas[1], canvas[3]);
  const readDefense = () => game(`(() => {
    const [,,ship,shield] = window.asteroidPixiApp.stage.children;
    return {width:innerWidth,height:innerHeight,shipWidth:ship.width,shipBottom:ship.y+ship.height/2,
      shieldX:shield.x,shieldY:shield.y,shieldRotation:shield.rotation};
  })()`);
  const initialDefense = await readDefense();
  assert.ok(initialDefense.shipWidth > initialDefense.width * 0.5);
  assert.ok(initialDefense.shipBottom >= initialDefense.height * 0.95 && initialDefense.shipBottom <= initialDefense.height);
  assert.equal(initialDefense.shieldRotation, 0);
  await capture('gameplay');
  const pointerSession = gameContext.session || session;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 100, y: 300 }, pointerSession);
  await until(async () => (await readDefense()).shieldX < initialDefense.shieldX, 'mouse moves shield left');
  const movedDefense = await readDefense();
  assert.equal(movedDefense.shieldY, initialDefense.shieldY);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 100, y: 400 }, pointerSession);
  assert.equal((await readDefense()).shieldY, initialDefense.shieldY, 'Vertical input must not rotate or lift the shield.');
  if (process.argv.includes('--mobile')) {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 120, y: 300 }] }, pointerSession);
    await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 260, y: 350 }] }, pointerSession);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, pointerSession);
    await until(async () => (await readDefense()).shieldX > movedDefense.shieldX, 'touch moves shield right');
    assert.equal((await readDefense()).shieldY, initialDefense.shieldY);
  }
  await until(() => game('window.asteroidPixiApp.stage.children[1].children.length > 0'), 'animated falling objects');
  await game(`(() => {
    const sprites = window.asteroidPixiApp.stage.children[1].children;
    window.asteroidAnimationSample = {sprite:sprites.at(-1),x:sprites.at(-1).x,y:sprites.at(-1).y,
      width:sprites.at(-1).width,alpha:sprites.at(-1).alpha};
  })()`);
  await until(() => game('window.asteroidAnimationSample.sprite.y > window.asteroidAnimationSample.y + 5'), 'asteroid falls');
  const animation = await game(`(() => {
    const before = window.asteroidAnimationSample, sprite = before.sprite;
    return {sameX:sprite.x===before.x,changedWidth:sprite.width!==before.width,changedAlpha:sprite.alpha!==before.alpha,
      trailCount:window.asteroidPixiApp.stage.children[1].children.length};
  })()`);
  assert.equal(animation.sameX, true); assert.equal(animation.changedWidth, true); assert.equal(animation.changedAlpha, true);
  assert.ok(animation.trailCount >= 4, 'Falling objects must have animated trails.');
  await until(() => game('window.asteroidAnimationSample.sprite.y >= innerHeight * 0.25'), 'falling animation visible on screen');
  await capture('falling-animation');
  // Real-time gameplay can finish after 30 seconds, or earlier if durability reaches zero.
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline && !await game('Boolean(document.querySelector(".asteroid-shield-phase-results"))')) {
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.equal(await game('Boolean(document.querySelector(".asteroid-shield-phase-results"))'), true);
  assert.equal(await game('window.asteroidSoundCount > 0'), soundOn, 'The sound checkbox must control real WebAudio output.');
  assert.ok(await game('document.querySelectorAll(".results-table tbody tr").length > 0'));
  assert.deepEqual(await game('Array.from(document.querySelectorAll(".score-analysis select option")).map(option => option.value)'),
    ['object', 'elapsed', 'damage', 'hp', 'speedLevel', 'score']);
  await CheckResultsPresentation(game, { defaultMetric: 'elapsed', alternateMetric: 'score', english, capture });
  assert.equal(await game('document.querySelector(".score-analysis select").value'), 'elapsed');
  assert.ok(await game('Boolean(document.querySelector(".score-analysis svg[role=img]"))'));
  await set('.score-analysis select', 'damage');
  assert.ok(await game(`document.querySelector(".score-analysis svg").getAttribute("aria-label").includes(${JSON.stringify(english ? 'Damage' : '造成傷害')})`));
  assert.ok(await game(`document.querySelector(".score-analysis").textContent.includes(${JSON.stringify(english ? 'Sample standard deviation' : '樣本標準差')})`));
  await set('.score-analysis select', 'elapsed');
  assert.ok(await game('Array.from(document.querySelectorAll(".results-table th")).every(cell => cell.getBoundingClientRect().width >= 48)'), 'Result columns must remain readable on phones.');
  assert.ok(await game('document.documentElement.scrollWidth <= innerWidth'), 'Only the result table may scroll horizontally.');
  assert.equal(requests.some(url => /asteroid-shield.*(?:settings|score)\.json/.test(url)), false);
  if (standalone) {
    const scope = await evaluate('navigator.serviceWorker.ready.then(registration => new URL(registration.scope).pathname)');
    assert.equal(scope, `/games/asteroid-shield/${version}/`);
    const cachedPaths = await evaluate(`(async () => {
      const paths = [];
      for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) paths.push(new URL(request.url).pathname);
      return paths;
    })()`);
    assert.ok(cachedPaths.includes(scope + 'package/game.json'));
    assert.ok(cachedPaths.includes(scope + 'package/preview.webp'));
    assert.ok(cachedPaths.filter(path => path.startsWith('/games/')).every(path => path.startsWith(scope)), 'PWA cache must not include other games or versions.');
    assert.ok(await game(`document.body.textContent.includes(${JSON.stringify(english ? 'Open from Hub to save records' : '從 Hub 開啟才能保存紀錄')})`));
    assert.equal(saveAttempts(), 0);
  } else {
    await until(() => game(`document.body.textContent.includes(${JSON.stringify(english ? 'Save failed' : '保存失敗')})`), 'retry feedback');
    await game(`Array.from(document.querySelectorAll("button")).find(button=>button.textContent.includes(${JSON.stringify(english ? 'Retry save' : '重試保存')})).click()`);
    await until(() => game(`document.body.textContent.includes(${JSON.stringify(english ? 'Record saved' : '紀錄已保存')})`), 'private save acknowledgement');
    const rows = sqlite.prepare('SELECT payload_json,user_id,subject_id FROM training_records').all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].user_id, accountId);
    assert.equal(rows[0].subject_id === guestSubjectId, accountId === null);
    const record = JSON.parse(rows[0].payload_json);
    assert.deepEqual(record.config, { difficulty: 'easy', durationSec: 30, sensitivity: 1, soundEnabled: soundOn });
    assert.ok(record.score.summary.spawned >= 1);
    assert.ok(record.score.rounds.length >= 1);
    assert.equal(record.score.rounds.length, await game('document.querySelectorAll(".results-table tbody tr").length'));
    assert.equal(sessionAttempts(), sessionFailure ? 2 : 1);
    assert.ok(saveAttempts() >= 2);
  }
  await capture('results');
  await game('document.querySelector(".results-table").scrollIntoView({block:"start"})');
  await capture('results-details');
  await game('document.querySelector(".results-scroll").scrollLeft = document.querySelector(".results-table").scrollWidth');
  await capture('results-details-end');
  assert.deepEqual(errors, []);
  await game('document.querySelector(".experiment-results > button:last-child").click()');
  await until(() => standalone ? game('Boolean(document.querySelector("form"))') : evaluate('!document.querySelector("dialog.training-overlay")'), 'return to original entry');
  assert.equal(await evaluate('document.fullscreenElement'), null, 'Returning to Hub or entry exits fullscreen.');
  if (standalone) await checkSettingsPreview();
  console.log(`Asteroid R2 passed: settings/presets/bounds/Enter → three target tutorial/resize/cleanup → fullscreen Pixi ${canvas[0]}×${canvas[1]} → complete outcomes → ${standalone ? 'local PWA return' : 'failed save/retry/single SQL row/lobby'}.`);
}
