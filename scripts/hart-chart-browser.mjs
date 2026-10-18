import assert from 'node:assert/strict';
import { CheckConfirmationPresentation } from './r2-game-ui-browser.mjs';
import { CheckResultsPresentation } from './r2-game-results-browser.mjs';

export async function CheckHartChart({ game, evaluate, send, until, standalone, english, capture, checkSpotlight,
  sqlite, gameContext, session, getSaveAttempts, requests, errors, accountId, guestSubjectId }) {
  const setInput = async (selector, value) => game(`(() => {
    const input=document.querySelector(${JSON.stringify(selector)});
    const prototype=input.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype,'value').set.call(input,${JSON.stringify(String(value))});
    input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true}));
  })()`);
  await until(() => game(`document.querySelector('form h2').textContent === ${JSON.stringify(english ? 'Hart Chart Training' : '哈特圖訓練')}`), 'private init language');
  assert.equal(await game(`document.querySelector('dialog').matches(':modal')`), true);
  assert.equal(await game(`document.querySelectorAll('.hart-preview-chart .hart-chart-cell').length`), 100);
  assert.equal(await game(`Boolean(document.querySelector('.game-tour'))`), false);
  await setInput('[name=rounds]', process.argv.includes('--hard') ? 30 : 5);
  await setInput('[name=chartSize]', process.argv.includes('--small') ? 'small' : 'large');
  const settings = await game(`({ rounds:Number(document.querySelector('[name=rounds]').value),chartSize:document.querySelector('[name=chartSize]').value })`);
  await capture('settings');
  await game(`document.querySelector('[name=chartSize]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);
  await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'chart spotlight');
  await game(`document.querySelector('.game-tour button:last-child').click()`);
  await until(() => game(`Boolean(document.querySelector('form'))`), 'back to settings');
  assert.equal(await game(`Number(document.querySelector('[name=rounds]').value)`), settings.rounds);
  assert.equal(await game(`Boolean(document.querySelector('.game-tour-spotlight'))`), false);
  await game(`document.querySelector('form .btn-primary').click()`);
  await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'restarted tour');
  const chartTarget = await game(`({ target:document.querySelector('.hart-preview-chart').getBoundingClientRect().width, chart:document.querySelector('.hart-preview-chart .hart-chart-grid').getBoundingClientRect().width })`);
  assert.ok(Math.abs(chartTarget.target-chartTarget.chart)<=1, 'The chart spotlight follows the chart itself: '+JSON.stringify(chartTarget));
  for (const target of ['.hart-preview-chart', '.hart-preview-decoder', '.hart-preview-tools']) {
    const state = await checkSpotlight(target);
    assert.equal(state.target.left < state.panel.right && state.target.right > state.panel.left
      && state.target.top < state.panel.bottom && state.target.bottom > state.panel.top, false, `${target} stays visible`);
    await game(`window.dispatchEvent(new Event('resize'))`);
    await checkSpotlight(target);
    await capture('tutorial-' + target.split('-').at(-1));
    await game(`document.querySelector('.game-tour button').click()`);
  }
  await until(() => game(`Boolean(document.querySelector('.training-confirmation'))`), 'final confirmation');
  await CheckConfirmationPresentation(game);
  await capture('confirmation');
  const pointerSession = gameContext.session || session;
  const tap = async selector => {
    const point = await game(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
    if (process.argv.includes('--mobile')) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] }, pointerSession);
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, pointerSession);
    } else {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point }, pointerSession);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point }, pointerSession);
    }
  };
  await tap('.training-confirmation .btn-primary');
  await until(() => game(`Boolean(document.querySelector('.hart-page'))`), 'real Hart gameplay');
  await until(() => game(`document.fullscreenElement === document.querySelector('.hart-chart-game-root')`), 'native fullscreen');
  if (process.argv.includes('--windowed')) await game(`document.exitFullscreen()`);
  const layout = await game(`(() => { const root=document.documentElement,r=document.querySelector('.hart-page').getBoundingClientRect();return {left:r.left,right:innerWidth-r.right,scrollWidth:root.scrollWidth,width:root.clientWidth,scrollHeight:root.scrollHeight,height:root.clientHeight};})()`);
  assert.ok(Math.abs(layout.left-layout.right)<=1 && layout.scrollWidth<=layout.width && layout.scrollHeight<=layout.height, JSON.stringify(layout));
  console.log('Hart viewport: '+JSON.stringify(layout));
  assert.equal(await game(`document.querySelectorAll('.hart-chart-cell').length`), 100);
  assert.equal(await game(`document.querySelectorAll('.hart-code-input').length`), settings.rounds);
  await capture('gameplay');
  if (process.argv.includes('--stop')) {
    await tap('.hart-back-button');
    await until(() => standalone ? game(`Boolean(document.querySelector('form'))`) : evaluate(`!document.querySelector('dialog iframe')`), 'stop without saving');
    assert.equal(getSaveAttempts(), 0); assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM training_records').get().count, 0);
    return;
  }
  await setInput('.hart-scale-control input', .9);
  assert.equal(await game(`document.querySelector('.hart-scale-control output').textContent`), '90%');
  await game(`document.querySelector('.hart-hints-toggle input').click()`);
  await game(`document.querySelector('.hart-code-input').focus()`);
  assert.equal(await game(`document.querySelectorAll('.hart-chart-cell-target').length`), 1);
  await game(`document.querySelector('.hart-decoder-drag-handle').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}))`);
  assert.equal(await game(`document.querySelector('.hart-page').classList.contains('hart-decoder-dock-left')`), true);
  await tap('.hart-topbar-controls button:nth-of-type(2)');
  await until(() => game(`Boolean(document.querySelector('.hart-qr-dialog img'))`), 'real QR image');
  const share = await game(`document.querySelector('.hart-share-url').textContent`);
  assert.match(share, /package\/index\.html#\/hart-chart\/display\?seed=\d+&scale=0.9/);
  const chartLetters = await game(`[...document.querySelectorAll('.hart-page .hart-chart-cell')].map(cell=>cell.textContent).join('')`);
  const displayTarget = await send('Target.createTarget', { url: share });
  try {
    const displaySession = await send('Target.attachToTarget', { targetId: displayTarget.targetId, flatten: true });
    const display = async expression => {
      try {
        const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, displaySession.sessionId);
        return response.result?.value;
      } catch (error) {
        if (/Cannot find default execution context/.test(error.message)) return undefined;
        throw error;
      }
    };
    await until(() => display(`document.querySelectorAll('.hart-display .hart-chart-cell').length === 100`), 'shared display actual chart');
    assert.equal(await display(`[...document.querySelectorAll('.hart-chart-cell')].map(cell=>cell.textContent).join('')`), chartLetters);
    assert.equal(await display(`Boolean(document.querySelector('form,.hart-code-input'))`), false);
  } finally { await send('Target.closeTarget', { targetId: displayTarget.targetId }); }
  await capture('qr');
  await game(`document.querySelector('.hart-qr-dialog .btn-primary').click()`);
  const entries = await game(`Array.from(document.querySelectorAll('.hart-code-input')).map(input=>{const [row,col]=input.placeholder.match(/[0-9]+/g).map(Number);return document.querySelectorAll('.hart-chart-cell')[(row-1)*10+col-1].textContent;})`);
  await setInput('.hart-code-input', entries[0] === 'A' ? 'B' : 'A');
  for (let index=0; index<entries.length; index++) await setInput(`.hart-code-input:nth-of-type(${index+1})`, entries[index]);
  await until(() => game(`Boolean(document.querySelector('.hart-finish-button'))`), 'all coordinates decoded');
  await tap('.hart-finish-button');
  await until(() => game(`Boolean(document.querySelector('.experiment-results'))`), 'complete results');
  await CheckResultsPresentation(game, { defaultMetric: 'accuracy', alternateMetric: 'attempts', english, capture });
  assert.equal(await game(`document.querySelectorAll('.results-table tbody tr').length`), 1);
  await game(`document.querySelector('.score-analysis select').value='attempts';document.querySelector('.score-analysis select').dispatchEvent(new Event('change',{bubbles:true}))`);
  await capture('results');
  if (standalone) {
    assert.equal(await game(`document.querySelector('.score-save-status').textContent`), english ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。');
    assert.equal(getSaveAttempts(), 0);
  } else {
    await until(() => game(`Boolean(document.querySelector('.score-retry-button'))`), 'first save fails visibly');
    await game(`document.querySelector('.score-retry-button').click()`);
    await until(() => game(`document.querySelector('.score-save-status').textContent === ${JSON.stringify(english ? 'Saved' : '已保存')}`), 'save retry');
    const records = sqlite.prepare('SELECT * FROM training_records').all();
    assert.equal(records.length, 1); assert.equal(records[0].user_id ?? null, accountId);
    if (accountId) assert.notEqual(records[0].subject_id, guestSubjectId); else assert.equal(records[0].subject_id, guestSubjectId);
    const saved = JSON.parse(records[0].payload_json);
    assert.deepEqual(saved.config, settings);
    assert.deepEqual({ ...saved.score.summary, durationMs: 0 }, { durationMs: 0, targets: settings.rounds, attempts: settings.rounds+1, accuracy: Math.round(settings.rounds/(settings.rounds+1)*100), hints: 1 });
    assert.deepEqual(saved.score.rounds, [saved.score.summary]);
  }
  assert.deepEqual(errors, []);
  assert.ok(!requests.some(url=>/hart-chart.*(?:settings|score)\.json/.test(url)));
  await game(`document.querySelector('.score-return-button').click()`);
  await until(() => standalone ? game(`Boolean(document.querySelector('form'))`) : evaluate(`!document.querySelector('dialog iframe')`), 'return to source');
  console.log('Hart settings, three spotlights, actual decoding, QR, hints, results and save lifecycle passed.');
}
