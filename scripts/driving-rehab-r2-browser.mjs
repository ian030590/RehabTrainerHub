import assert from 'node:assert/strict';
import { CheckConfirmationPresentation } from './r2-game-ui-browser.mjs';

export async function CheckDrivingRehab({ game, evaluate, send, until, standalone, english, capture, checkSpotlight,
  sqlite, gameContext, session, getSaveAttempts, requests, errors, version, accountId, guestSubjectId, rendererFailure }) {
  const pointerSession = gameContext.session || session;
  const mobile = process.argv.includes('--mobile') || process.argv.includes('--tablet');
  const press = async (code, key, type = 'keyDown') => send('Input.dispatchKeyEvent', { type, code, key, windowsVirtualKeyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : ({ ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39 }[code] ?? 32) }, pointerSession);
  const tap = async selector => {
    const point = await game(`(() => { const element=document.querySelector(${JSON.stringify(selector)});element.scrollIntoView({block:'nearest'});const r=element.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
    if (mobile) {
      await send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[point] }, pointerSession);
      await send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] }, pointerSession);
    } else {
      await send('Input.dispatchMouseEvent', { type:'mousePressed',button:'left',clickCount:1,...point }, pointerSession);
      await send('Input.dispatchMouseEvent', { type:'mouseReleased',button:'left',clickCount:1,...point }, pointerSession);
    }
  };
  assert.equal(await game(`document.querySelectorAll('.game-tour, .driving-rehab-root canvas').length`), 0, 'Settings show the preview without starting tutorial or gameplay.');
  assert.ok(await game(`document.querySelector('.driving-preview-hazard').getBoundingClientRect().width > 0`));
  assert.equal(await game('window.drivingNativeGamepadCheck'), 'allowed', 'Reviewed gamepad permission reaches the opaque game.');
  assert.equal(await game(`document.querySelector('[name=controlMode][value=arrow]').disabled`), true);
  assert.equal(await game(`document.querySelector('[name=controlMode][value=wheel]').disabled`), true, 'No physical wheel is falsely reported.');
  await capture('settings');
  await game(`document.querySelector('form .btn-ghost').focus()`);
  await press('KeyK','k'); await press('KeyK','k','keyUp');
  await until(() => game(`!document.querySelector('[name=controlMode][value=arrow]').disabled`), 'trusted keyboard input');
  const wheel = process.argv.includes('--wheel');
  if (wheel) {
    await game(`window.drivingFixtureWheel={connected:true,id:'Logitech G29 Driving Force Racing Wheel USB',index:0,axes:[0,1,1],buttons:[],timestamp:performance.now()};Object.defineProperty(navigator,'getGamepads',{value:()=>window.drivingFixtureWheel.connected?[window.drivingFixtureWheel]:[]});document.querySelector('form .btn-ghost').click()`);
    await until(() => game(`!document.querySelector('[name=controlMode][value=wheel]').disabled`), 'supported wheel detected');
  }
  const controlMode = wheel ? 'wheel' : mobile ? 'touch' : english ? 'wasd' : 'arrow';
  assert.equal(await game(`document.querySelector('[name=controlMode][value=${controlMode}]').disabled`), false,
    `The emulated input is available (touch points: ${await game('navigator.maxTouchPoints')}).`);
  const quality = process.argv.includes('--low') ? 'low' : process.argv.includes('--medium') ? 'medium' : 'high';
  const difficulty = process.argv.includes('--hard') ? 'hard' : 'easy';
  await game(`document.querySelector('[name=controlMode][value=${controlMode}]').click();document.querySelector('[name=renderQuality][value=${quality}]').click();document.querySelector('[name=difficulty][value=${difficulty}]').click()`);
  if (wheel) {
    await until(() => game(`Boolean(document.querySelector('.driving-wheel-setup'))`), 'wheel calibration');
    assert.equal(await game(`document.querySelector('form .btn-primary').disabled`),true, 'Uncalibrated pedals cannot start.');
    await game(`document.querySelector('.driving-wheel-setup button').click()`);
    await game(`document.querySelector('.driving-wheel-setup button').click()`);
    for (const axes of [[-1,1,1],[1,1,1],[0,-1,1],[0,1,-1]]) {
      await game(`window.drivingFixtureWheel.axes=${JSON.stringify(axes)};new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
      await game(`document.querySelector('.driving-wheel-setup button').click()`);
    }
    await game(`window.drivingFixtureWheel.axes=[0,1,1]`);
    await until(() => game(`!document.querySelector('form .btn-primary').disabled`), 'calibrated wheel ready');
  }
  const selected = { difficulty, renderQuality: quality, controlMode, redFlashEnabled: true };
  await game(`document.querySelector('form .btn-primary').click()`);
  await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'lane-crossing spotlight');
  await checkSpotlight('.driving-preview-hazard');
  await game(`document.querySelector('.game-tour button:last-child').click()`);
  await until(() => game(`Boolean(document.querySelector('dialog[open]'))`), 'return to settings');
  assert.equal(await game(`document.querySelector('[name=controlMode]:checked').value`), controlMode);
  assert.equal(await game(`Boolean(document.querySelector('.game-tour-spotlight'))`), false);
  await game(`document.querySelector('form .btn-primary').click()`);
  await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'restart tutorial');
  const viewport = await evaluate('[innerWidth,innerHeight]');
  await send('Emulation.setDeviceMetricsOverride', { width:viewport[0]-40,height:viewport[1]-40,deviceScaleFactor:1,mobile }, session);
  await until(() => game(`innerWidth === ${viewport[0]-40}`), 'responsive tutorial');
  await game(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
  await checkSpotlight('.driving-preview-hazard');
  await send('Emulation.setDeviceMetricsOverride', { width:viewport[0],height:viewport[1],deviceScaleFactor:1,mobile }, session);
  await until(() => game(`innerWidth === ${viewport[0]}`), 'restore viewport');
  await game(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
  for (const target of ['.driving-preview-hazard','.driving-preview-controls','.driving-preview-status']) {
    const spotlight = await checkSpotlight(target);
    assert.equal(spotlight.target.left < spotlight.panel.right && spotlight.target.right > spotlight.panel.left && spotlight.target.top < spotlight.panel.bottom && spotlight.target.bottom > spotlight.panel.top, false, `${target}: panel leaves target visible.`);
    await capture('tutorial-'+target.split('-').at(-1));
    await game(`document.querySelector('.game-tour button').click()`);
  }
  await until(() => game(`Boolean(document.querySelector('.training-confirmation'))`), 'final confirmation');
  await CheckConfirmationPresentation(game);
  await capture('confirmation');
  await tap('.training-confirmation .btn-primary');
  if (rendererFailure) {
    await until(() => game(`Boolean(document.querySelector('dialog[open] [role=alert]'))`), 'visible WebGL failure');
    assert.equal(getSaveAttempts(),0);
    assert.equal(await game('document.fullscreenElement'),null);
    await capture('renderer-error');
    await game(`window.allowRendererRetry=true;document.querySelector('form .btn-primary').click()`);
    await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'tutorial after renderer retry');
    await game(`document.querySelectorAll('.game-tour button')[1].click()`);
    await until(() => game(`Boolean(document.querySelector('.training-confirmation'))`), 'skip retry tutorial');
    await tap('.training-confirmation .btn-primary');
  }
  await until(() => game(`document.querySelector('.driving-rehab-root')?.getAttribute('aria-busy') === 'false'`), 'real Three scene and jsPsych started', 90000);
  assert.equal(await game(`document.fullscreenElement === document.querySelector('.driving-rehab-game-root')`),true);
  if (process.argv.includes('--windowed')) await game('document.exitFullscreen()');
  const layout = await game(`(() => { const canvas=document.querySelector('.driving-rehab-root canvas').getBoundingClientRect();const root=document.documentElement;return {left:canvas.left,right:canvas.right,top:canvas.top,bottom:canvas.bottom,width:innerWidth,height:innerHeight,overflowX:root.scrollWidth-root.clientWidth,overflowY:root.scrollHeight-root.clientHeight}; })()`);
  assert.equal(layout.left,0); assert.equal(layout.top,0); assert.equal(layout.right,layout.width); assert.equal(layout.bottom,layout.height); assert.equal(layout.overflowX,0); assert.equal(layout.overflowY,0);
  console.log('Driving viewport:',JSON.stringify(layout));
  await capture('gameplay');
  if (mobile) {
    assert.equal(await game(`['steering','pedals','camera'].every(group=>{const r=document.querySelector('[data-driving-control-group='+group+']').getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;})`), true, 'Touch controls remain in view.');
    await tap('[data-driving-control-group=camera]');
    await until(() => game(`document.querySelector('.driving-rehab-root').textContent.includes(${JSON.stringify(english?'Third-person':'第三人稱')})`), 'touch camera switches to third person');
    await capture('gameplay-third-person');
    await tap('[data-driving-control-group=camera]');
    await until(() => game(`document.querySelector('.driving-rehab-root').textContent.includes(${JSON.stringify(english?'First-person':'第一人稱')})`), 'touch camera returns to first person');
  }
  if (wheel) {
    await game(`window.drivingFixtureWheel.connected=false`);
    await until(() => game(`document.querySelector('.driving-rehab-root').textContent.includes(${JSON.stringify(english?'disconnected':'已中斷')})`), 'wheel disconnect pauses gameplay');
    await capture('wheel-disconnected');
    await game(`window.drivingFixtureWheel.connected=true`);
  }
  if (process.argv.includes('--stop')) {
    await tap('.driving-training-stop');
    await until(() => standalone ? game(`Boolean(document.querySelector('dialog[open]'))`) : evaluate(`!document.querySelector('dialog iframe')`), 'stop without saving');
    assert.equal(getSaveAttempts(),0);assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM training_records').get().count,0);
    assert.equal(await evaluate('document.fullscreenElement'),null);assert.deepEqual(errors,[]);return;
  }
  if (mobile) {
    const point = await game(`(() => {const r=document.querySelector('[data-driving-control-group=pedals] button:last-child').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]},pointerSession);
  } else await press(english ? 'KeyW' : 'ArrowUp',english ? 'w' : 'ArrowUp');
  await until(() => game(`Boolean(document.querySelector('.experiment-results'))`), 'full driving session completes', 240000);
  if (mobile) await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]},pointerSession);
  else await press(english ? 'KeyW' : 'ArrowUp',english ? 'w' : 'ArrowUp','keyUp');
  assert.equal(await game('document.fullscreenElement'),null);
  assert.equal(await game(`document.querySelectorAll('.score-key-metric').length`),4);
  assert.equal(await game(`document.querySelectorAll('.results-table th').length`),12);
  assert.equal(await game(`document.documentElement.scrollWidth <= innerWidth`),true);
  await game(`document.querySelector('.score-analysis').scrollIntoView()`);await capture('results-analysis');
  await game(`document.querySelector('.score-analysis select').value='avoided';document.querySelector('.score-analysis select').dispatchEvent(new Event('change',{bubbles:true}))`);
  assert.equal(await game(`document.querySelector('.score-analysis select').value`),'avoided');
  await capture('results-details');
  if (standalone) {
    const scope = await evaluate('navigator.serviceWorker.ready.then(registration=>new URL(registration.scope).pathname)');
    assert.equal(scope,`/games/driving-rehab/${version}/`);assert.equal(getSaveAttempts(),0);
    const cached = await evaluate(`(async()=>{const paths=[];for(const name of await caches.keys())for(const request of await(await caches.open(name)).keys())paths.push(new URL(request.url).pathname);return paths;})()`);
    for (const path of ['package/game.json','package/preview.webp','package/vehicle-data.js']) assert.ok(cached.includes(scope+path),path);
    assert.ok(cached.filter(path=>path.startsWith('/games/')).every(path=>path.startsWith(scope)), 'PWA caches stay within this game version.');
  } else {
    await until(() => game(`Boolean(document.querySelector('.score-retry-button'))`), 'save error offers retry');
    await game(`document.querySelector('.score-retry-button').click()`);
    await until(() => game(`document.querySelector('.score-save-status').textContent === ${JSON.stringify(english?'Saved':'已保存')}`), 'fixed-version retry saves');
    const rows=sqlite.prepare('SELECT * FROM training_records').all();assert.equal(rows.length,1);assert.ok(getSaveAttempts()>=2);
    assert.equal(rows[0].user_id??null,accountId);if(accountId)assert.notEqual(rows[0].subject_id,guestSubjectId);else assert.equal(rows[0].subject_id,guestSubjectId);
    const saved=JSON.parse(rows[0].payload_json);assert.deepEqual(saved.config,selected);assert.equal(saved.gameId,'driving-rehab');
    assert.ok(saved.score.summary.durationMs>0);assert.ok(saved.score.summary.fps>0);
    assert.equal(saved.score.rounds.length,saved.score.summary.rounds);
    assert.ok(saved.score.rounds.every(row=>row.rt===null||row.rt>=0));
  }
  assert.deepEqual(errors,[]);assert.equal(requests.some(url=>/driving-rehab.*(?:settings|score)\.json/.test(url)),false);
  await game(`document.querySelector('.score-return-button').click()`);
  await until(() => standalone ? game(`Boolean(document.querySelector('dialog[open]'))`) : evaluate(`!document.querySelector('dialog iframe')`), 'return to source');
  console.log('Driving controls, three spotlights, real Three session, full results and save lifecycle passed.');
}
