import assert from 'node:assert/strict';
import { CheckConfirmationPresentation } from './r2-game-ui-browser.mjs';
import { CheckResultsPresentation } from './r2-game-results-browser.mjs';

export async function CheckGaborPatching({ game, evaluate, send, until, standalone, english, capture, checkSpotlight,
  sqlite, gameContext, session, getSaveAttempts, requests, errors, version, accountId, guestSubjectId, rendererFailure }) {
  await until(() => game(`document.querySelector('form h2').textContent === ${JSON.stringify(english ? 'Gabor Patching' : '蓋伯斑塊練習')}`), 'private init language');
  if (rendererFailure) {
    await until(() => game(`Boolean(document.querySelector('.renderer-error[role=alert]'))`), 'visible renderer failure');
    assert.equal(await game(`document.querySelector('form .btn-primary').disabled`), true);
    assert.equal(getSaveAttempts(), 0);
    await capture('renderer-failure');
    await game(`window.allowRendererRetry = true; document.querySelector('.renderer-error button').click()`);
  }
  await until(() => game(`!document.querySelector('form .btn-primary').disabled`), 'real Pixi initialized');
  assert.equal(await game(`Boolean(document.querySelector('.game-tour'))`), false);
  assert.equal(await game(`document.querySelectorAll('.gabor-tutorial canvas').length`), 3);
  assert.equal(await game(`document.querySelector('dialog').matches(':modal')`), true);
  await capture('settings');
  const setInput = async (name, value) => game(`(() => {
    const input = document.querySelector('[name=${name}]');
    const prototype = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(String(value))});
    input.dispatchEvent(new Event('input', {bubbles:true})); input.dispatchEvent(new Event('change', {bubbles:true}));
  })()`);
  const difficulty = process.argv.includes('--hard') ? 'hard' : process.argv.includes('--medium') ? 'medium' : 'easy';
  await setInput('difficulty', difficulty);
  await setInput('durationSec', 30);
  await setInput('maxSpots', 3);
  const soundOn = process.argv.includes('--sound-on');
  if (!soundOn) await game(`document.querySelector('[name=soundEnabled]').click()`);
  await game(`window.gaborSoundCount = 0;
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function(...args) { window.gaborSoundCount++; return create.apply(this, args); };`);
  await game(`document.querySelector('[name=maxSpots]').dispatchEvent(new KeyboardEvent('keydown', {key:'Enter',bubbles:true}))`);
  await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'patch spotlight');
  await checkSpotlight('.gabor-preview-patch');
  await capture('tutorial-patch');
  await game(`document.querySelector('.game-tour button:last-child').click()`);
  await until(() => game(`Boolean(document.querySelector('form'))`), 'tutorial return preserves settings');
  assert.equal(await game(`document.querySelector('[name=durationSec]').value`), '30');
  assert.equal(await game(`document.querySelector('[name=maxSpots]').value`), '3');
  assert.equal(await game(`document.querySelector('[name=difficulty]').value`), difficulty);
  assert.equal(await game(`Boolean(document.querySelector('.game-tour-spotlight'))`), false);
  await game(`document.querySelector('form .btn-primary').click()`);
  await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'restarted tutorial');
  const viewport = await evaluate('[innerWidth,innerHeight]');
  await send('Emulation.setDeviceMetricsOverride', { width: viewport[0] - 40, height: viewport[1] - 40,
    deviceScaleFactor: 1, mobile: process.argv.includes('--mobile') }, session);
  await until(() => game(`innerWidth === ${viewport[0] - 40}`), 'resized tutorial');
  await game('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  await checkSpotlight('.gabor-preview-patch');
  await send('Emulation.setDeviceMetricsOverride', { width: viewport[0], height: viewport[1], deviceScaleFactor: 1,
    mobile: process.argv.includes('--mobile') }, session);
  await until(() => game(`innerWidth === ${viewport[0]}`), 'restored tutorial');
  await game('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  for (const target of ['.gabor-preview-patch', '.gabor-preview-timer', '.gabor-preview-score']) {
    const spotlight = await checkSpotlight(target);
    const intersects = spotlight.target.left < spotlight.panel.right && spotlight.target.right > spotlight.panel.left
      && spotlight.target.top < spotlight.panel.bottom && spotlight.target.bottom > spotlight.panel.top;
    assert.equal(intersects, false, 'The instruction panel leaves the target visible.');
    await capture('tutorial-' + target.split('-').at(-1));
    await game(`document.querySelector('.game-tour button').click()`);
  }
  await until(() => game(`Boolean(document.querySelector('.training-confirmation'))`), 'final confirmation');
  await CheckConfirmationPresentation(game);
  assert.equal(await game(`Boolean(document.querySelector('.game-tour-spotlight'))`), false);
  await capture('confirmation');
  const pointerSession = gameContext.session || session;
  const click = async selector => {
    const point = await game(`(() => {const rect=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};})()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point }, pointerSession);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point }, pointerSession);
  };
  await click('.training-confirmation .btn-primary');
  await until(() => game(`Boolean(document.querySelector('.gabor-timer')) && window.gaborPixiApp.stage.children.length >= 3`), 'real jsPsych Pixi trial');
  await until(() => game(`document.fullscreenElement === document.querySelector('.gabor-patching-game-root')`), 'native fullscreen root');
  if (process.argv.includes('--windowed')) await game(`document.exitFullscreen()`);
  await until(() => game(`(() => {
    const canvas=document.querySelector('canvas').getBoundingClientRect(), root=document.documentElement;
    return canvas.left === 0 && canvas.top === 0 && canvas.right === innerWidth && canvas.bottom === innerHeight
      && root.scrollWidth === root.clientWidth && root.scrollHeight === root.clientHeight;
  })()`), 'canvas fills viewport without overflow');
  const layout = await game(`(() => {const r=document.querySelector('canvas').getBoundingClientRect();return {width:innerWidth,height:innerHeight,left:r.left,right:r.right,top:r.top,bottom:r.bottom};})()`);
  console.log('Gabor gameplay viewport:', JSON.stringify(layout));
  await capture('gameplay');
  if (process.argv.includes('--stop')) {
    await click('.gabor-patching-stop');
    await until(() => standalone ? game(`Boolean(document.querySelector('form'))`) : evaluate(`!document.querySelector('dialog iframe')`), 'cancel without saving');
    assert.equal(getSaveAttempts(), 0); assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM training_records').get().count, 0);
    assert.equal(await evaluate('document.fullscreenElement'), null);
    assert.deepEqual(errors, []);
    return;
  }
  let lastClick = 0;
  await until(async () => {
    if (await game(`Boolean(document.querySelector('.experiment-results'))`)) return true;
    if (Date.now() - lastClick < 350) return false;
    const point = await game(`(() => {
      const app=window.gaborPixiApp;
      if (!app?.stage) return null;
      const patch=app.stage.children.find(child=>child.eventMode==='static' && child.alpha > .15);
      return patch ? {x:patch.x,y:patch.y} : null;
    })()`);
    if (point) {
      lastClick = Date.now();
      if (process.argv.includes('--mobile')) {
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] }, pointerSession);
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, pointerSession);
      } else {
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point }, pointerSession);
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point }, pointerSession);
      }
    }
    return false;
  }, 'complete real 30-second training', 45000);
  await until(() => game(`!document.fullscreenElement`), 'results exit fullscreen');
  assert.equal(await game(`window.gaborSoundCount > 0`), soundOn, 'Sound toggle controls actual WebAudio.');
  assert.ok(await game(`Number(document.querySelectorAll('.score-key-metric strong')[1].textContent) > 0`), 'Real pointer input hits patches.');
  await CheckResultsPresentation(game, { defaultMetric: 'reactionMs', alternateMetric: 'points', english, capture });
  if (standalone) {
    const scope = await evaluate('navigator.serviceWorker.ready.then(registration=>new URL(registration.scope).pathname)');
    assert.equal(scope, `/games/gabor-patching/${version}/`);
    const cached = await evaluate(`(async()=>{const paths=[];for(const name of await caches.keys()) for(const request of await (await caches.open(name)).keys()) paths.push(new URL(request.url).pathname);return paths;})()`);
    assert.ok(cached.includes(scope + 'package/game.json')); assert.ok(cached.includes(scope + 'package/preview.webp'));
    assert.ok(cached.filter(path=>path.startsWith('/games/')).every(path=>path.startsWith(scope)));
    assert.equal(getSaveAttempts(), 0);
  } else {
    await until(() => game(`Boolean(document.querySelector('.score-retry-button'))`), 'save failure offers retry');
    await game(`document.querySelector('.score-retry-button').click()`);
    await until(() => game(`document.querySelector('.score-save-status').textContent === ${JSON.stringify(english ? 'Saved' : '已保存')}`), 'fixed-session retry saved');
    const records = sqlite.prepare('SELECT * FROM training_records').all();
    assert.equal(records.length, 1); assert.ok(getSaveAttempts() >= 2);
    assert.equal(records[0].user_id ?? null, accountId);
    if (accountId) assert.notEqual(records[0].subject_id, guestSubjectId); else assert.equal(records[0].subject_id, guestSubjectId);
    const saved = JSON.parse(records[0].payload_json);
    assert.equal(saved.gameId, 'gabor-patching');
    assert.deepEqual(saved.config, { difficulty, durationSec: 30, maxSpots: 3, soundEnabled: soundOn });
    assert.equal(saved.score.summary.durationMs, 30000);
    assert.equal(saved.score.summary.hits, saved.score.rounds.filter(row=>row.outcome===1).length);
    assert.equal(saved.score.summary.score, saved.score.rounds.reduce((sum,row)=>sum+row.points,0));
    assert.ok(saved.score.rounds.every(row=>row.outcome===1 ? row.reactionMs >= 0 : row.reactionMs === null));
  }
  assert.deepEqual(errors, []);
  assert.ok(!requests.some(url=>/gabor-patching.*(?:settings|score)\.json/.test(url)));
  await game(`document.querySelector('.score-return-button').click()`);
  await until(() => standalone ? game(`Boolean(document.querySelector('form'))`) : evaluate(`!document.querySelector('dialog iframe')`), 'return to source');
  console.log('Gabor settings, three spotlights, real 30-second gameplay, results and save lifecycle passed.');
}
