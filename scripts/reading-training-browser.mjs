import assert from 'node:assert/strict';
import { CheckConfirmationPresentation } from './r2-game-ui-browser.mjs';
import { CheckResultsPresentation } from './r2-game-results-browser.mjs';

// Fastest valid pace keeps the real passage short: 5 tokens per display at 600 tokens/min.
const fastSettings = { passage: 1, wordsPerMinute: 600, crowding: 500, contrast: 50 };
// The batch-size slider shows segments (1–5); it saves the original percent value.
const controlValue = (name, value) => name === 'crowding' ? value / 100 : value;

export async function CheckReadingTraining({ game, evaluate, send, until, standalone, english, capture, checkSpotlight,
  sqlite, gameContext, session, getSaveAttempts, requests, errors, version, accountId, guestSubjectId, rendererFailure }) {
  await until(() => game(`document.querySelector('form h2').textContent === ${JSON.stringify(english ? 'Reading Training (RSVP)' : '閱讀訓練（RSVP）')}`), 'private init language');
  if (rendererFailure) {
    await until(() => game(`Boolean(document.querySelector('.renderer-error[role=alert]'))`), 'visible renderer failure');
    assert.equal(await game(`document.querySelector('form .btn-primary').disabled`), true);
    assert.equal(getSaveAttempts(), 0);
    await capture('renderer-failure');
    await game(`window.allowRendererRetry = true; document.querySelector('.renderer-error button').click()`);
  }
  await until(() => game(`!document.querySelector('form .btn-primary').disabled`), 'real Pixi initialized');
  assert.equal(await game(`Boolean(document.querySelector('.game-tour'))`), false, 'The tutorial waits for confirmed settings.');
  assert.equal(await game(`Boolean(document.querySelector('.reading-tutorial .reading-preview-word'))`), true, 'The tutorial scene renders behind the settings.');
  assert.equal(await game(`document.querySelector('dialog').matches(':modal')`), true);
  await capture('settings');
  const setInput = async (name, value) => game(`(() => {
    const input = document.querySelector('[name=${name}]');
    const prototype = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(String(value))});
    input.dispatchEvent(new Event('input', {bubbles:true})); input.dispatchEvent(new Event('change', {bubbles:true}));
  })()`);
  assert.equal(await game(`document.querySelector('[name=passage]').tagName`), 'SELECT', 'Passage material is a dropdown.');
  assert.deepEqual(await game(`[...document.querySelectorAll('[name=passage] option')].map(option => option.textContent)`),
    english ? ['Random', 'Passage 1', 'Passage 2', 'Passage 3'] : ['隨機', '第 1 篇', '第 2 篇', '第 3 篇']);
  assert.deepEqual(await game(`['min','max','step'].map(name => document.querySelector('[name=crowding]').getAttribute(name))`), ['1', '5', '1'], 'Batch size is chosen as 1–5 segments.');
  for (const [name, value] of Object.entries(fastSettings)) await setInput(name, controlValue(name, value));
  assert.match(await game(`document.querySelector('[name=crowding]').closest('label').querySelector('output').textContent`), english ? /5 per display/ : /每批 5 段/);
  assert.match(await game(`document.querySelector('.reading-preview-word').textContent`), english ? /^Elara was a nineteen-year-old mechanic$/ : /^小 貓 白 白 在$/,
    'The preview shows the configured tokens per display.');
  assert.equal(await game(`getComputedStyle(document.querySelector('.reading-preview-word')).color`), 'rgb(100, 100, 100)', 'Preview contrast follows the renderer gray level.');
  await game(`document.querySelector('[name=contrast]').dispatchEvent(new KeyboardEvent('keydown', {key:'Enter',bubbles:true}))`);
  await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'word spotlight');
  await checkSpotlight('.reading-preview-word');
  await capture('tutorial-word');
  await game(`document.querySelector('.game-tour button:last-child').click()`);
  await until(() => game(`Boolean(document.querySelector('form'))`), 'tutorial return preserves settings');
  for (const [name, value] of Object.entries(fastSettings)) assert.equal(await game(`document.querySelector('[name=${name}]').value`), String(controlValue(name, value)));
  assert.equal(await game(`Boolean(document.querySelector('.game-tour-spotlight'))`), false);
  await game(`document.querySelector('form .btn-primary').click()`);
  await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'restarted tutorial');
  const viewport = await evaluate('[innerWidth,innerHeight]');
  await send('Emulation.setDeviceMetricsOverride', { width: viewport[0] - 40, height: viewport[1] - 40,
    deviceScaleFactor: 1, mobile: process.argv.includes('--mobile') }, session);
  await until(() => game(`innerWidth === ${viewport[0] - 40}`), 'resized tutorial');
  await game('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  await checkSpotlight('.reading-preview-word');
  await send('Emulation.setDeviceMetricsOverride', { width: viewport[0], height: viewport[1], deviceScaleFactor: 1,
    mobile: process.argv.includes('--mobile') }, session);
  await until(() => game(`innerWidth === ${viewport[0]}`), 'restored tutorial');
  await game('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  for (const target of ['.reading-preview-word', '.reading-preview-pace', '.reading-preview-question']) {
    const spotlight = await checkSpotlight(target);
    const intersects = spotlight.target.left < spotlight.panel.right && spotlight.target.right > spotlight.panel.left
      && spotlight.target.top < spotlight.panel.bottom && spotlight.target.bottom > spotlight.panel.top;
    assert.equal(intersects, false, `${target}: the instruction panel leaves the target visible.`);
    await capture('tutorial-' + target.split('-').at(-1));
    await game(`document.querySelector('.game-tour button').click()`);
  }
  await until(() => game(`Boolean(document.querySelector('.training-confirmation'))`), 'final confirmation');
  await CheckConfirmationPresentation(game);
  assert.equal(await game(`Boolean(document.querySelector('.game-tour-spotlight'))`), false);
  await capture('confirmation');
  const pointerSession = gameContext.session || session;
  const tap = async selector => {
    const point = await game(`(() => {const rect=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};})()`);
    if (process.argv.includes('--mobile')) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] }, pointerSession);
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, pointerSession);
    } else {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point }, pointerSession);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point }, pointerSession);
    }
  };
  await tap('.training-confirmation .btn-primary');
  await until(() => game(`window.readingPixiApp?.stage?.children.some(child => child.text === '3')`), 'real jsPsych Pixi countdown');
  await until(() => game(`document.fullscreenElement === document.querySelector('.reading-training-game-root')`), 'native fullscreen root');
  if (process.argv.includes('--windowed')) await game(`document.exitFullscreen()`);
  await until(() => game(`(() => {
    const canvas=document.querySelector('canvas')?.getBoundingClientRect(), root=document.documentElement;
    return canvas && canvas.left === 0 && canvas.top === 0 && canvas.right === innerWidth && canvas.bottom === innerHeight
      && root.scrollWidth === root.clientWidth && root.scrollHeight === root.clientHeight;
  })()`), 'canvas fills viewport without overflow');
  await until(() => game(`window.readingPixiApp.stage.children.some(child => typeof child.text === 'string' && child.text.split(' ').length === 5)`), 'five tokens per display');
  const word = await game(`(() => { const text = window.readingPixiApp.stage.children.find(child => typeof child.text === 'string'); const bounds = text.getBounds(); return { fill: text.style.fill, left: bounds.x, right: bounds.x + bounds.width, width: innerWidth }; })()`);
  assert.ok(word.left >= 0 && word.right <= word.width + 1, 'RSVP text fits the viewport width.');
  await capture('gameplay');
  if (process.argv.includes('--stop')) {
    await tap('.reading-training-stop');
    await until(() => standalone ? game(`Boolean(document.querySelector('form'))`) : evaluate(`!document.querySelector('dialog iframe')`), 'cancel without saving');
    assert.equal(getSaveAttempts(), 0); assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM training_records').get().count, 0);
    assert.equal(await evaluate('document.fullscreenElement'), null);
    assert.deepEqual(errors, []);
    return;
  }
  await until(() => game(`Boolean(document.querySelector('.reading-qa-btn'))`), 'questions follow the full passage', 120000);
  await capture('question');
  assert.ok(await game(`document.documentElement.scrollWidth <= innerWidth`), 'Question layout does not overflow horizontally.');
  const questionLayout = await game(`(() => {
    const rect = element => element.getBoundingClientRect();
    const group = rect(document.querySelector('#jspsych-html-button-response-btngroup'));
    const buttons = [...document.querySelectorAll('.reading-qa-btn')].map(rect);
    const stop = rect(document.querySelector('.reading-training-stop'));
    return { width: innerWidth, height: innerHeight, left: group.left, right: group.right, top: rect(document.querySelector('.reading-qa-question')).top,
      inside: buttons.every(button => button.left >= 0 && button.right <= innerWidth && button.bottom <= stop.top) };
  })()`);
  assert.ok(Math.abs(questionLayout.left - (questionLayout.width - questionLayout.right)) <= 1, `Answers are centred: ${JSON.stringify(questionLayout)}`);
  assert.ok(questionLayout.inside && questionLayout.top >= 0, `Answers stay visible above the stop button: ${JSON.stringify(questionLayout)}`);
  let answered = 0;
  await until(async () => {
    if (await game(`Boolean(document.querySelector('.experiment-results'))`)) return true;
    if (!await game(`Boolean(document.querySelector('.reading-qa-btn'))`)) return false;
    const before = await game(`document.querySelector('.reading-qa-question')?.textContent`);
    await tap(`.reading-qa-btn:nth-of-type(${(answered % 4) + 1})`);
    answered++;
    await until(() => game(`document.querySelector('.reading-qa-question')?.textContent !== ${JSON.stringify(before)}`), 'next question');
    return false;
  }, 'answer every question', 60000);
  assert.equal(answered, 10);
  await until(() => game(`!document.fullscreenElement`), 'results exit fullscreen');
  await CheckResultsPresentation(game, { defaultMetric: 'responseMs', alternateMetric: 'correct', english, capture });
  assert.equal(await game(`document.querySelectorAll('.score-analysis tbody tr').length`), 10);
  assert.ok(await game(`[...document.querySelectorAll('.reading-question-text')].every(cell => cell.textContent.trim().length > 1)`), 'Each round shows its question text.');
  if (standalone) {
    const scope = await evaluate('navigator.serviceWorker.ready.then(registration=>new URL(registration.scope).pathname)');
    assert.equal(scope, `/games/reading-training/${version}/`);
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
    assert.equal(saved.gameId, 'reading-training');
    assert.deepEqual(saved.config, fastSettings);
    const words = english ? 565 : 74;
    assert.deepEqual({ ...saved.score.summary, presentationMs: undefined, correct: undefined }, { questions: 10, correct: undefined,
      presentationMs: undefined, wordCount: words, configuredWpm: 600, presented: words, finished: 1, passage: 1, language: english ? 1 : 0 });
    assert.equal(saved.score.summary.correct, saved.score.rounds.filter(row => row.correct === 1).length);
    const expectedMs = 3000 + Math.ceil(words / 5) * 500;
    assert.ok(Math.abs(saved.score.summary.presentationMs - expectedMs) < 1500, `Presentation time ${saved.score.summary.presentationMs} follows the configured pace (${expectedMs}).`);
    assert.ok(saved.score.rounds.every(row => row.options === 4 && row.responseMs > 0 && row.correct === Number(row.choice === row.expectedChoice)));
  }
  assert.deepEqual(errors, []);
  assert.ok(!requests.some(url=>/reading-training.*(?:settings|score)\.json/.test(url)));
  await game(`document.querySelector('.score-return-button').click()`);
  await until(() => standalone ? game(`Boolean(document.querySelector('form'))`) : evaluate(`!document.querySelector('dialog iframe')`), 'return to source');
  console.log('Reading settings, three spotlights, real RSVP passage, ten questions, results and save lifecycle passed.');
}
