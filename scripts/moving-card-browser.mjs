import assert from 'node:assert/strict';
import { CheckConfirmationPresentation } from './r2-game-ui-browser.mjs';
import { CheckResultsPresentation } from './r2-game-results-browser.mjs';

export async function CheckMovingCard({ game, evaluate, send, until, standalone, english, capture, checkSpotlight,
  sqlite, gameContext, session, getSaveAttempts, requests, errors, version, accountId, guestSubjectId, rendererFailure }) {
  await until(() => game(`document.querySelector('form h2').textContent === ${JSON.stringify(english ? 'Moving Card Training' : '移動卡片訓練')}`), 'private init language');
  if (rendererFailure) {
    await until(() => game(`Boolean(document.querySelector('.renderer-error[role=alert]'))`), 'visible renderer failure');
    assert.equal(await game(`document.querySelector('form .btn-primary').disabled`), true);
    assert.equal(await game(`Boolean(document.querySelector('.game-tour, canvas'))`), false);
    assert.equal(getSaveAttempts(), 0);
    await capture('renderer-failure');
    await game(`window.allowRendererRetry = true; document.querySelector('.renderer-error button').click()`);
  }
  await until(() => game(`!document.querySelector('form .btn-primary').disabled`), 'real Pixi initialized');
  const arrangementLabels = await game(`[...document.querySelectorAll('[name=difficulty] option')].map(option => option.textContent)`);
  assert.equal(await game(`document.querySelectorAll('.moving-card-options p').length`), 18);
  assert.equal(await game(`document.querySelector('.moving-card-target').textContent`), 'AB');
  await CheckTutorialGeometry(game, english, arrangementLabels, { count: 18, calibration: 149, difficulty: 'medium' });
  assert.equal(await game(`Boolean(document.querySelector('.game-tour'))`), false);
  assert.ok(await game(`document.querySelector('dialog').matches(':modal')`));
  const calibrationBar = await game(`(() => {
    const bar = document.querySelector('.moving-card-calibration-bar');
    return {actual:bar.getBoundingClientRect().width,declared:Number(bar.previousElementSibling.textContent.match(/([0-9]+)px/)[1])};
  })()`);
  assert.equal(calibrationBar.actual, calibrationBar.declared, 'The measured calibration bar must retain its declared pixel length on phones.');
  await game(`window.movingCardSoundCount = 0;
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function(...args) { window.movingCardSoundCount++; return create.apply(this, args); };`);
  await capture('settings');
  const setInput = async (name, value) => game(`(() => {
    const input = document.querySelector('[name=${name}]');
    const prototype = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(String(value))});
    input.dispatchEvent(new Event('input', {bubbles:true})); input.dispatchEvent(new Event('change', {bubbles:true}));
  })()`);
  await setInput('calibrationLengthMm', 0);
  await game(`document.querySelector('form .btn-primary').click()`);
  assert.equal(await game(`Boolean(document.querySelector('form')) && !document.querySelector('.game-tour')`), true, 'Invalid calibration cannot start the tutorial.');
  await setInput('rounds', 5);
  await setInput('optionCount', 40);
  await setInput('optionMoveIntervalMs', 200);
  const difficulty = process.argv.includes('--hard') ? 'hard' : process.argv.includes('--medium') ? 'medium' : 'easy';
  await setInput('difficulty', difficulty);
  await setInput('calibrationLengthMm', 70);
  const soundOn = process.argv.includes('--sound-on');
  if (!soundOn) await game(`document.querySelector('[name=soundEnabled]').click()`);
  await game(`document.querySelector('[name=calibrationLengthMm]').dispatchEvent(new KeyboardEvent('keydown', {key:'Enter',bubbles:true}))`);
  await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'target spotlight');
  await checkSpotlight('.moving-card-target');
  await capture('tutorial-target');
  await game(`document.querySelector('.game-tour button:last-child').click()`);
  await until(() => game(`Boolean(document.querySelector('form'))`), 'tutorial back preserves settings');
  assert.equal(await game(`document.querySelector('[name=rounds]').value`), '5');
  assert.equal(await game(`document.querySelector('[name=optionCount]').value`), '40');
  assert.equal(await game(`document.querySelector('[name=calibrationLengthMm]').value`), '70');
  assert.equal(await game(`Boolean(document.querySelector('.game-tour-spotlight'))`), false);
  await game(`document.querySelector('form .btn-primary').click()`);
  await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'restarted tutorial');
  const tutorialGeometry = await CheckTutorialGeometry(game, english, arrangementLabels);
  const originalViewport = await evaluate('[innerWidth, innerHeight]');
  await send('Emulation.setDeviceMetricsOverride', { width: originalViewport[0] - 40, height: originalViewport[1] - 40,
    deviceScaleFactor: 1, mobile: process.argv.includes('--mobile') }, session);
  await until(() => game(`document.querySelector('.moving-card-tutorial').clientWidth !== ${tutorialGeometry.viewportWidth}`), 'resized tutorial scene');
  await game('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  await CheckTutorialGeometry(game, english, arrangementLabels);
  await checkSpotlight('.moving-card-target');
  await send('Emulation.setDeviceMetricsOverride', { width: originalViewport[0], height: originalViewport[1],
    deviceScaleFactor: 1, mobile: process.argv.includes('--mobile') }, session);
  await until(() => game(`document.querySelector('.moving-card-tutorial').clientWidth === ${tutorialGeometry.viewportWidth}`), 'restored tutorial scene');
  await game('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  await CheckTutorialGeometry(game, english, arrangementLabels);
  for (const target of ['.moving-card-target', '.moving-card-options', '.moving-card-round']) {
    await checkSpotlight(target);
    await capture('tutorial-' + target.split('-').at(-1));
    if (target === '.moving-card-options') await capture('tutorial-options-' + difficulty);
    await game(`document.querySelector('.game-tour button').click()`);
  }
  await until(() => game(`Boolean(document.querySelector('.training-confirmation'))`), 'complete tutorial');
  await CheckConfirmationPresentation(game);
  assert.equal(await game(`document.activeElement === document.querySelector('.training-confirmation .btn-primary')`), true);
  assert.equal(await game(`Boolean(document.querySelector('.game-tour-spotlight'))`), false);
  await capture('confirmation');
  const pointerSession = gameContext.session || session;
  const click = async selector => {
    const point = await game(`(() => {const rect=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};})()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point }, pointerSession);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point }, pointerSession);
  };
  await click('.training-confirmation .btn-primary');
  await until(() => game(`Boolean(document.querySelector('canvas')) && window.movingCardPixiApp.stage.children.length >= 8`), 'real jsPsych Pixi trial');
  assert.equal(await game(`window.movingCardPixiApp.stage.children.at(-1).children.length`), 40);
  await until(() => game(`document.fullscreenElement === document.querySelector('.moving-card-game-root')`), 'native fullscreen root');
  if (process.argv.includes('--windowed')) {
    await game(`document.exitFullscreen()`);
    await until(() => game(`!document.fullscreenElement`), 'exit fullscreen without losing gameplay');
  }
  await until(() => game(`(() => {
    const canvas = document.querySelector('canvas').getBoundingClientRect(), root = document.documentElement;
    return canvas.left === 0 && canvas.top === 0 && canvas.right === innerWidth && canvas.bottom === innerHeight
      && root.scrollWidth === root.clientWidth && root.scrollHeight === root.clientHeight;
  })()`), 'canvas fills the viewport after fullscreen resize');
  const layout = await game(`(() => {
    const canvas=document.querySelector('canvas').getBoundingClientRect(), root=document.documentElement;
    return {width:innerWidth,height:innerHeight,left:canvas.left,right:canvas.right,top:canvas.top,bottom:canvas.bottom,
      scrollWidth:root.scrollWidth,clientWidth:root.clientWidth,scrollHeight:root.scrollHeight,clientHeight:root.clientHeight};
  })()`);
  assert.ok(Math.abs(layout.left - (layout.width - layout.right)) <= 1, JSON.stringify(layout));
  assert.equal(layout.scrollWidth, layout.clientWidth); assert.equal(layout.scrollHeight, layout.clientHeight);
  assert.equal(layout.right - layout.left, layout.width); assert.equal(layout.bottom - layout.top, layout.height);
  console.log('Moving-card gameplay viewport:', JSON.stringify(layout));
  const gameGeometry = await game(`(() => {
    const app = window.movingCardPixiApp;
    const card = app.stage.children.at(-1).children[0];
    const shape = card.children[0].context.instructions[0].data.path.instructions[0].data;
    return {width: shape[2], height: shape[3], radius: shape[4], fontSize: card.children[1].style.fontSize,
      targetFontSize: app.stage.children[6].style.fontSize};
  })()`);
  if (layout.width === tutorialGeometry.viewportWidth && layout.height === tutorialGeometry.viewportHeight) {
    for (const key of ['width', 'height', 'radius', 'fontSize', 'targetFontSize']) {
      assert.ok(Math.abs(gameGeometry[key] - tutorialGeometry[key]) < 0.1,
        `Tutorial ${key} ${tutorialGeometry[key]} must match gameplay ${gameGeometry[key]}`);
    }
  }
  await capture('gameplay');
  await capture('gameplay-' + difficulty);
  if (process.argv.includes('--stop')) {
    await click('.moving-card-stop');
    await until(() => standalone ? game(`Boolean(document.querySelector('form'))`) : evaluate(`!document.querySelector('dialog iframe')`), 'stop without saving incomplete training');
    assert.equal(getSaveAttempts(), 0);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM training_records').get().count, 0);
    assert.equal(await evaluate('document.fullscreenElement'), null);
    assert.deepEqual(errors, []);
    console.log('Moving-card stopped without results or records and left fullscreen.');
    return;
  }
  const positions = () => game(`window.movingCardPixiApp.stage.children.at(-1).children.map(card=>[card.x,card.y])`);
  const before = await positions();
  await until(async () => JSON.stringify(await positions()) !== JSON.stringify(before), 'real card movement');
  const cardPoint = async correct => game(`(() => {
    const app=window.movingCardPixiApp;
    if (!app?.stage?.children[6]) return null;
    const target=app.stage.children[6].text;
    const card=app.stage.children.at(-1).children.findLast(card => (card.children[1].text===target) === ${correct});
    const rect=app.canvas.getBoundingClientRect();return {x:rect.left+card.x,y:rect.top+card.y,target};
  })()`);
  const selectCard = async correct => {
    const point = await cardPoint(correct);
    if (!point) return;
    const { x, y } = point;
    if (process.argv.includes('--mobile')) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }, pointerSession);
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, pointerSession);
    } else {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }, pointerSession);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }, pointerSession);
    }
  };
  const firstTarget = (await cardPoint(true)).target;
  await until(async () => {
    const wrongFeedback = await game(`window.movingCardPixiApp.stage.children.at(-1).children.some(card =>
      card.children[0].context.instructions[0]?.data.style.color === 0x3D1A1A)`);
    if (wrongFeedback) return true;
    await selectCard(false);
    return false;
  }, 'a real wrong selection flashes red before retry');
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.equal((await cardPoint(true)).target, firstTarget, 'Wrong selections allow retry in the same trial.');
  for (let round = 1; round <= 5; round++) {
    await until(async () => {
      if (await game(round === 5 ? `Boolean(document.querySelector('.experiment-results'))` :
        `window.movingCardPixiApp.stage.children[3]?.text.includes('${round + 1} / 5')`)) return true;
      await selectCard(true);
      return false;
    }, `complete real round ${round}`);
  }
  await until(() => game(`!document.fullscreenElement`), 'results leave fullscreen');
  assert.equal(await game(`window.movingCardSoundCount > 0`), soundOn, 'The sound checkbox controls actual WebAudio output.');
  assert.equal(await game(`document.querySelectorAll('.score-analysis tbody tr').length`), 5);
  assert.ok(await game(`parseFloat(getComputedStyle(document.querySelector('.score-key-metric strong')).fontSize) >= 32`), 'Key result values have a readable visual hierarchy.');
  await CheckResultsPresentation(game, { defaultMetric: 'searchMs', alternateMetric: 'errors', english, capture });
  if (standalone) {
    const scope = await evaluate('navigator.serviceWorker.ready.then(registration => new URL(registration.scope).pathname)');
    assert.equal(scope, `/games/moving-card/${version}/`);
    const cachedPaths = await evaluate(`(async () => {
      const paths = [];
      for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) paths.push(new URL(request.url).pathname);
      return paths;
    })()`);
    assert.ok(cachedPaths.includes(scope + 'package/game.json'));
    assert.ok(cachedPaths.includes(scope + 'package/preview.webp'));
    assert.ok(cachedPaths.filter(path => path.startsWith('/games/')).every(path => path.startsWith(scope)));
    assert.ok(await game(`document.querySelector('.score-save-status').textContent.includes(${JSON.stringify(english ? 'Local play' : '獨立練習')})`));
    assert.equal(getSaveAttempts(), 0);
  } else {
    await until(() => game(`Boolean(document.querySelector('.score-retry-button'))`), 'failed save is retryable');
    await game(`document.querySelector('.score-retry-button').click()`);
    await until(() => game(`document.querySelector('.score-save-status').textContent === ${JSON.stringify(english ? 'Saved' : '已保存')}`), 'retry saves original fixed session');
    const records = sqlite.prepare('SELECT * FROM training_records').all();
    assert.equal(records.length, 1); assert.ok(getSaveAttempts() >= 2, 'Failed save and successful retry use one record.');
    const record = records[0];
    assert.equal(record.user_id ?? null, accountId);
    if (accountId) assert.notEqual(record.subject_id, guestSubjectId); else assert.equal(record.subject_id, guestSubjectId);
    const saved = JSON.parse(record.payload_json);
    assert.equal(saved.gameId, 'moving-card');
    assert.equal(saved.config.optionCount, 40); assert.equal(saved.config.optionMoveIntervalMs, 200);
    assert.equal(saved.config.calibrationLengthMm, 70 * 700 / calibrationBar.actual);
    assert.equal(saved.config.soundEnabled, soundOn);
    assert.equal(saved.score.summary.completed, 5); assert.equal(saved.score.rounds.length, 5);
    assert.ok(saved.score.rounds[0].errors >= 1); assert.ok(saved.score.rounds[0].attempts >= 2);
    assert.ok(saved.score.rounds.every(row => row.searchMs >= 0));
  }
  assert.deepEqual(errors, []);
  assert.ok(!requests.some(url => /moving-card.*(?:settings|score)\.json/.test(url)));
  await game(`document.querySelector('.score-return-button').click()`);
  await until(() => standalone ? game(`Boolean(document.querySelector('form'))`) : evaluate(`!document.querySelector('dialog iframe')`), 'return to source');
  console.log('Moving-card settings, three spotlights, real pointer trials, results and save lifecycle passed.');
}

async function CheckTutorialGeometry(game, english, arrangementLabels, { count = 40, calibration = 175,
  difficulty = process.argv.includes('--hard') ? 'hard' : process.argv.includes('--medium') ? 'medium' : 'easy' } = {}) {
  const geometry = await game(`(() => {
    const scene = document.querySelector('.moving-card-tutorial');
    const cards = [...scene.querySelectorAll('.moving-card-preview-option')];
    const styles = cards.map(card => getComputedStyle(card));
    const number = value => parseFloat(value) || 0;
    const radius = styles[0].borderRadius.includes('%') ? number(styles[0].width) / 2 : number(styles[0].borderRadius);
    return {viewportWidth: scene.clientWidth, viewportHeight: scene.clientHeight,
      width: number(styles[0].width), height: number(styles[0].height), radius,
      fontSize: number(styles[0].fontSize), targetFontSize: number(getComputedStyle(scene.querySelector('.moving-card-target')).fontSize),
      positions: cards.map(card => ({x:card.offsetLeft, y:card.offsetTop})),
      rotations: styles.map(style => style.transform), count: cards.length};
  })()`);
  const hard = difficulty === 'hard';
  const circle = difficulty !== 'easy';
  const width = geometry.viewportWidth, height = geometry.viewportHeight;
  const areaWidth = width * 0.94;
  const areaTop = Math.max(height * 0.18, 72);
  const areaHeight = height - Math.max(height * 0.05, 64) - areaTop;
  const rows = Math.max(4, Math.ceil((count + 1) / 5));
  const cardWidth = areaWidth / 5 * 0.8, cardHeight = areaHeight / rows * 0.8;
  const diameter = Math.min(cardWidth, cardHeight, Math.sqrt(areaWidth * areaHeight / count) * 0.85);
  const expected = {width: circle ? diameter : cardWidth, height: circle ? diameter : cardHeight,
    radius: circle ? diameter / 2 : 4,
    fontSize: Math.min(Math.max(12, 10 * 700 / calibration), Math.min(circle ? diameter : cardWidth, circle ? diameter : cardHeight) * 0.7),
    targetFontSize: Math.max(16, Math.min(15 * 700 / calibration, height * 0.08, width * 0.1))};
  const failures = [];
  const expectedLabels = english ? ['Square grid', 'Scattered circles', 'Scattered circles with rotation']
    : ['方形排列', '圓形散亂', '圓形散亂旋轉'];
  if (JSON.stringify(arrangementLabels) !== JSON.stringify(expectedLabels)) failures.push(`Arrangement names: ${arrangementLabels.join(', ')}`);
  for (const key of Object.keys(expected)) {
    if (Math.abs(geometry[key] - expected[key]) >= 0.1) failures.push(`${key}: tutorial ${geometry[key]}, gameplay ${expected[key]}`);
  }
  const visibleRows = new Set(geometry.positions.map(position => position.y));
  if (circle ? visibleRows.size <= Math.ceil(count / 5) : visibleRows.size !== Math.ceil(count / 5)) failures.push('Cards must use the selected grid or scattered arrangement.');
  if (hard && new Set(geometry.rotations).size <= 2) failures.push('Rotated cards must show the gameplay range of angles.');
  assert.deepEqual(failures, [], 'Tutorial cards must match the calibrated gameplay on this viewport.');
  assert.equal(geometry.count, count);
  return geometry;
}
