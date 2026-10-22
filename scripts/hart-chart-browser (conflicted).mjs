import assert from 'node:assert/strict';
import { CheckConfirmationPresentation } from './r2-game-ui-browser.mjs';
import { CheckResultsPresentation } from './r2-game-results-browser.mjs';

export async function CheckHartChart({ game, evaluate, send, until, standalone, english, capture, checkSpotlight,
  sqlite, gameContext, session, getSaveAttempts, requests, errors, accountId, guestSubjectId }) {
  const chinese = process.argv.includes('--chinese');
  const setInput = async (selector, value, index = 0) => game(`(() => {
    const input=document.querySelectorAll(${JSON.stringify(selector)})[${index}];
    const prototype=input.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype,'value').set.call(input,${JSON.stringify(String(value))});
    input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true}));
  })()`);
  await until(() => game(`document.querySelector('form h2').textContent === ${JSON.stringify(english ? 'Hart Chart Training' : '哈特圖訓練')}`), 'private init language');
  assert.equal(await game(`document.querySelector('dialog').matches(':modal')`), true);
  assert.equal(await game(`document.querySelectorAll('.hart-chart-cell').length`), 100);
  assert.equal(await game(`Boolean(document.querySelector('.game-tour'))`), false);
  assert.equal(await game(`document.querySelector('[name=characterSet]').value`), 'english', 'English letters are the default.');
  if (chinese) {
    await setInput('[name=characterSet]', 'chinese');
    await until(() => game(`[...document.querySelectorAll('.hart-chart-cell')].every(cell=>/^\\p{Script=Han}$/u.test(cell.textContent))`), 'Chinese chart behind the settings');
  }
  await setInput('[name=rounds]', process.argv.includes('--hard') ? 30 : 5);
  await setInput('[name=chartSize]', process.argv.includes('--small') ? 'small' : 'large');
  const settings = await game(`({ rounds:Number(document.querySelector('[name=rounds]').value),chartSize:document.querySelector('[name=chartSize]').value,characterSet:document.querySelector('[name=characterSet]').value })`);
  assert.equal(settings.characterSet, chinese ? 'chinese' : 'english');
  await capture('settings');
  await game(`document.querySelector('[name=chartSize]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);
  await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'chart spotlight');
  await game(`document.querySelector('.game-tour button:last-child').click()`);
  await until(() => game(`Boolean(document.querySelector('form'))`), 'back to settings');
  assert.equal(await game(`Number(document.querySelector('[name=rounds]').value)`), settings.rounds);
  assert.equal(await game(`Boolean(document.querySelector('.game-tour-spotlight'))`), false);
  await game(`document.querySelector('form .btn-primary').click()`);
  await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'restarted tour');
  assert.equal(await game(`Boolean(document.querySelector('.hart-page .hart-workspace .hart-chart-grid'))`), true,
    'The tutorial uses the real training workspace, rather than a separate preview.');
  const scene = () => game(`(() => {
    const chart=document.querySelector('.hart-chart-grid');
    return {dock:document.querySelector('.hart-page').className,
      fonts:['--hart-font-min','--hart-font-fluid','--hart-font-max'].map(name=>chart.style.getPropertyValue(name)),
      fields:document.querySelectorAll('.hart-code-input').length,
      letters:[...document.querySelectorAll('.hart-chart-cell')].map(cell=>cell.textContent).join(''),
      coordinates:[...document.querySelectorAll('.hart-code-input')].map(input=>input.placeholder),
      tools:[...document.querySelectorAll('.hart-topbar-controls button')].map(button=>button.textContent)};
  })()`);
  const tutorialScene = await scene();
  assert.equal(tutorialScene.fields, settings.rounds, 'The tutorial shows every requested decoder field.');
  assert.equal(await game(`document.querySelector('.hart-page').inert`), true);
  await setInput('.hart-code-input', 'A');
  assert.equal(await game(`document.querySelector('.hart-code-input').value`), '', 'Tutorial input cannot count as a training attempt.');
  assert.equal(getSaveAttempts(), 0);
  for (const target of ['.hart-chart-grid', '.hart-decoder-panel', '.hart-topbar-controls']) {
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
  await until(() => game(`Boolean(document.querySelector('.hart-page:not([inert])'))`), 'real Hart gameplay');
  assert.deepEqual(await scene(), tutorialScene, 'Training keeps the tutorial layout, typography, complete decoder and tools.');
  await until(() => game(`document.fullscreenElement === document.querySelector('.hart-chart-game-root')`), 'native fullscreen');
  if (process.argv.includes('--windowed')) await game(`document.exitFullscreen()`);
  const layout = await game(`(() => { const root=document.documentElement,r=document.querySelector('.hart-page').getBoundingClientRect();return {left:r.left,right:innerWidth-r.right,scrollWidth:root.scrollWidth,width:root.clientWidth,scrollHeight:root.scrollHeight,height:root.clientHeight};})()`);
  assert.ok(Math.abs(layout.left-layout.right)<=1 && layout.scrollWidth<=layout.width && layout.scrollHeight<=layout.height, JSON.stringify(layout));
  console.log('Hart viewport: '+JSON.stringify(layout));
  assert.equal(await game(`document.querySelectorAll('.hart-chart-cell').length`), 100);
  assert.equal(await game(`document.querySelectorAll('.hart-code-input').length`), settings.rounds);
  // Each word stays on one line, inside the decoder, with a wider gap between words than between cells.
  const checkDecoderLayout = async label => {
    const layout = await game(`(() => {
      const output=document.querySelector('.hart-code-output'), scroll=document.querySelector('.hart-decoder-scroll'), box=output.getBoundingClientRect();
      const words=[...output.querySelectorAll('.hart-code-word')];
      const rect=element=>element.getBoundingClientRect();
      const split=words.filter(word=>{const middles=[...word.children].map(child=>rect(child).top+rect(child).height/2);return Math.max(...middles)-Math.min(...middles)>2;}).length;
      const outside=words.filter(word=>rect(word).left<box.left-1||rect(word).right>box.right+1).length;
      let wordGap=Infinity, cellGap=0;
      for (let index=1; index<words.length; index++) { const a=rect(words[index-1]), b=rect(words[index]); if (Math.abs(a.top-b.top)<2) wordGap=Math.min(wordGap,b.left-a.right); }
      for (const word of words) for (let index=1; index<word.children.length; index++) cellGap=Math.max(cellGap,rect(word.children[index]).left-rect(word.children[index-1]).right);
      const cells=[...output.querySelectorAll('.hart-code-input')];
      return {words:words.length,longest:Math.max(...words.map(word=>word.querySelectorAll('.hart-code-input').length)),split,outside,
        scrollsSideways:scroll.scrollWidth>scroll.clientWidth+1,cell:rect(cells[0]).width,placeholder:parseFloat(getComputedStyle(cells[0],'::placeholder').fontSize),
        wordGap:Number.isFinite(wordGap)?wordGap:null,cellGap,decoder:rect(document.querySelector('.hart-decoder-panel')).width,
        text:words.map(word=>[...word.children].map(child=>child.tagName==='INPUT'?'_':child.textContent).join('')).join(' ')};
    })()`);
    console.log(`Hart decoder ${label}: ${JSON.stringify(layout)}`);
    assert.equal(layout.split, 0, 'No word is split across two lines.');
    assert.equal(layout.outside, 0, 'Every word fits inside the decoder.');
    assert.equal(layout.scrollsSideways, false);
    assert.ok(layout.cell >= 27.5, `Cells stay readable (${layout.cell}px).`);
    assert.ok(layout.placeholder >= 7, `Coordinates stay readable (${layout.placeholder}px).`);
    if (layout.wordGap !== null) assert.ok(layout.wordGap >= layout.cellGap + 6, 'Words are separated by a visible space.');
    return layout;
  };
  if (!chinese && process.argv.includes('--hard')) {
    // Reset until the sentence has a long word to decode (up to ten fields), the hardest case to fit.
    for (let reset = 0; reset < 120 && (await checkDecoderLayout('search')).longest < 9; reset++) {
      await game(`document.querySelector('.hart-topbar-controls .btn-primary').click()`);
    }
  }
  const firstLayout = await checkDecoderLayout('gameplay');
  if (!chinese && process.argv.includes('--hard')) assert.ok(firstLayout.longest >= 9, 'The long-word layout was exercised.');
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
  await checkDecoderLayout('left dock');
  await capture('decoder-left');
  await tap('.hart-topbar-controls button:nth-of-type(2)');
  await until(() => game(`Boolean(document.querySelector('.hart-qr-dialog img'))`), 'real QR image');
  const share = await game(`document.querySelector('.hart-share-url').textContent`);
  assert.match(share, /package\/index\.html#\/hart-chart\/display\?seed=\d+&scale=0.9/);
  assert.equal(share.includes('characters=chinese'), chinese, 'The shared screen shows the same kind of chart.');
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
  // Placeholders read [column,row]: the first number counts across, the second down.
  const entries = await game(`Array.from(document.querySelectorAll('.hart-code-input')).map(input=>{const [col,row]=input.placeholder.match(/[0-9]+/g).map(Number);return document.querySelectorAll('.hart-chart-cell')[(row-1)*10+col-1].textContent;})`);
  assert.deepEqual(await game(`Array.from(document.querySelectorAll('.hart-code-input')).map(input=>{const [col,row]=input.placeholder.match(/[0-9]+/g);return input.getAttribute('aria-label')===(${english}?'Column '+col+', row '+row:'第 '+col+' 欄，第 '+row+' 列');})`),
    entries.map(() => true), 'Screen readers hear the column first.');
  let first = 0;
  if (chinese) {
    assert.ok(entries.every(entry => /^\p{Script=Han}$/u.test(entry)));
    // Type the first field through the input method: a wrong character, then the right one.
    const wrong = entries[0] === '一' ? '二' : '一';
    const field = `document.querySelectorAll('.hart-code-input')[0]`;
    await game(`${field}.focus()`);
    await send('Input.imeSetComposition', { text: 'ㄧ', selectionStart: 1, selectionEnd: 1 }, pointerSession);
    assert.equal(await game(`${field}.value`), 'ㄧ', 'Phonetic symbols show while composing.');
    assert.equal(await game(`${field}.classList.contains('is-correct')`), false);
    await send('Input.insertText', { text: wrong }, pointerSession);
    await until(() => game(`${field}.value === ${JSON.stringify(wrong)}`), 'composed wrong character');
    await send('Input.imeSetComposition', { text: 'ㄗ', selectionStart: 1, selectionEnd: 1 }, pointerSession);
    await send('Input.insertText', { text: entries[0] }, pointerSession);
    await until(() => game(`${field}.value === ${JSON.stringify(entries[0])} && ${field}.classList.contains('is-correct')`), 'composed correct character');
    await until(() => game(`document.activeElement === document.querySelectorAll('.hart-code-input')[1]`), 'focus moves to the next field');
    await capture('chinese-ime');
    first = 1;
  } else {
    await setInput('.hart-code-input', entries[0] === 'A' ? 'B' : 'A');
  }
  for (let index=first; index<entries.length; index++) await setInput('.hart-code-input', entries[index], index);
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
