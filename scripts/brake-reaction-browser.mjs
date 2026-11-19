import assert from 'node:assert/strict';
import { ReadSavedGameRecord } from './r2-browser-fixtures.mjs';
import { CheckConfirmationPresentation } from './r2-game-ui-browser.mjs';

export async function CheckBrakeReaction({ game, evaluate, send, until, standalone, english, touch, capture,
  sqlite, rawDataBucket, gameContext, session, getSaveAttempts, requests, errors, version, accountId }) {
  const click = selector => game(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const exists = selector => game(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const waitFor = selector => until(() => exists(selector), selector);
  const brakeControl = '.brake-reaction-phase-playing #brake:not(:disabled)';
  const feedbackCard = '.round-feedback';
  const cue = () => until(() => exists('.brake-reaction-phase-playing canvas[data-brake-lit-at]'), 'same-lane brake cue');
  const press = async (focus = '#brake') => {
    if (touch) {
      const point = await game(`(() => {
        const rect = document.querySelector('#brake').getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      })()`);
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] }, gameContext.session || session);
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, gameContext.session || session);
    } else {
      await game(`document.querySelector(${JSON.stringify(focus)}).focus()`);
      const key = { key: ' ', code: 'Space', windowsVirtualKeyCode: 32 };
      await send('Input.dispatchKeyEvent', { ...key, type: 'keyDown' }, session);
      await send('Input.dispatchKeyEvent', { ...key, type: 'keyUp' }, session);
    }
  };
  await until(() => game(`!document.querySelector('form .btn-primary').disabled && document.querySelector('form h2').textContent === ${JSON.stringify(english ? 'Brake Reaction Practice' : '跟車煞車反應練習')}`), 'private init and language');
  const controls = await game(`(() => {
    const dialog = document.querySelector('dialog.game-settings-dialog');
    const cards = [...dialog.querySelectorAll('.training-config-body > section.training-setting')];
    const buttons = [...dialog.querySelectorAll('footer button')];
    const wide = innerWidth >= 640;
    const [back, confirm] = buttons.map(button => button.getBoundingClientRect());
    return {
      cards: cards.map(card => ({
        title: card.querySelector('h3').textContent,
        fields: [...card.querySelectorAll('label > select')].map(select => select.name)
      })),
      buttons: buttons.map(button => button.textContent),
      scenario: dialog.querySelector('[name=scenario]').value,
      backdrop: getComputedStyle(dialog, '::backdrop').backdropFilter,
      fits: dialog.scrollWidth <= dialog.clientWidth,
      targets: [...buttons, ...dialog.querySelectorAll('select')].every(control => control.getBoundingClientRect().height >= 44),
      order: wide ? confirm.left > back.left : confirm.top > back.top && confirm.width === back.width
    };
  })()`);
  assert.deepEqual(controls.cards, [
    { title: english ? 'Practice settings' : '練習設定', fields: ['traffic', 'scenario', 'speedKmh', 'road'] },
    { title: english ? 'Vehicles' : '車輛', fields: ['leadType', 'ownType'] },
  ]);
  assert.deepEqual(controls.buttons, [english ? (standalone ? 'Back to entry' : 'Back to lobby') : (standalone ? '返回入口' : '返回大廳'),
    english ? 'Confirm settings' : '確認設定']);
  assert.equal(controls.scenario, 'mixed');
  assert.equal(controls.backdrop, 'blur(12px)');
  assert.ok(controls.fits && controls.targets && controls.order);
  await capture('settings');
  await click('form .btn-primary');
  await waitFor('.game-tour-spotlight');
  await capture('tutorial');
  await click('.game-tour-actions button:nth-child(2)');
  await waitFor('.training-confirmation');
  await click('#demo');
  await waitFor(brakeControl);
  assert.equal(await game('document.fullscreenElement === null'), true);
  await cue();
  await new Promise(resolve => setTimeout(resolve, 130));
  await press();
  await waitFor(feedbackCard);
  assert.equal(await game("document.activeElement.id"), 'continue');
  assert.equal(getSaveAttempts(), 0);
  await click('#continue');
  await waitFor('.training-confirmation');
  await CheckConfirmationPresentation(game);
  await capture('confirmation');
  await click('#start');
  await waitFor(brakeControl);
  await until(() => game('document.fullscreenElement === document.querySelector("#game")'), 'scored practice fullscreen');
  assert.equal(await game('document.documentElement.scrollWidth <= innerWidth'), true);
  await click('#sound');
  assert.equal(await game("document.querySelector('#sound').getAttribute('aria-pressed')"), 'false');
  await click('#sound');

  await click('#stop');
  await waitFor('#resume');
  assert.equal(await game("document.activeElement.id"), 'resume');
  await click('#resume');
  await until(async () => !(await exists('#resume')), 'resumed round');
  assert.equal(await game("document.activeElement.id"), 'stop');
  await press();
  await waitFor('.round-feedback[data-verdict="earlyPress"]');
  assert.equal(await game("document.activeElement.id"), 'continue');
  await click('#continue');

  for (let index = 0; index < 6; index++) {
    await waitFor(brakeControl);
    if (index === 5) {
      await waitFor('.drive-notification [data-answer]:not(:disabled)');
      const choice = await game(`(() => {
        const [a, operation, b] = document.querySelector('#message').textContent.split(' ');
        const answer = operation === '×' ? Number(a) * Number(b) : Number(a) + Number(b);
        const button = [...document.querySelectorAll('[data-answer]')].find(button => Number(button.textContent) === answer);
        return button.dataset.answer;
      })()`);
      if (touch) await click(`[data-answer="${choice}"]`);
      else {
        await game(`document.querySelector('[data-answer="${choice}"]').focus()`);
        const enter = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 };
        await send('Input.dispatchKeyEvent', { ...enter, type: 'keyDown' }, session);
        await send('Input.dispatchKeyEvent', { ...enter, type: 'keyUp' }, session);
      }
      await until(() => game("!document.querySelector('.drive-notification [data-answer]:not(:disabled)')"), 'answer input clears the question');
      assert.equal(await exists(feedbackCard), false, 'Answer input must not brake.');
      await waitFor('.drive-notification [data-answer]:not(:disabled)');
    }
    await cue();
    if (index === 0) await capture('gameplay');
    await new Promise(resolve => setTimeout(resolve, 130));
    if (index !== 1) await press(index === 5 ? '.drive-notification [data-answer]:not(:disabled)' : '#brake');
    await waitFor(feedbackCard);
    assert.equal(await game("document.activeElement.id"), 'continue');
    assert.equal(await exists('.driving[inert] .road-frame canvas[data-world-distance]'), true);
    if (index === 5) assert.equal(await exists('.round-distraction'), true);
    await click('#continue');
  }
  await waitFor('.experiment-results');
  await until(() => game('document.fullscreenElement === null'), 'fullscreen ended after completion');
  await capture('results');
  await click('.score-details summary');
  assert.equal(await game("document.querySelectorAll('.results-table tbody tr').length"), 6);

  if (standalone) {
    assert.equal(getSaveAttempts(), 0);
  } else {
    await waitFor('.score-retry-button');
    await click('.score-retry-button');
    await until(() => game(`document.querySelector('.score-save-status').textContent === ${JSON.stringify(english ? 'Record saved' : '當次紀錄已保存')}`), 'record saved after retry');
    assert.ok(getSaveAttempts() >= 2);
    const records = sqlite.prepare('SELECT * FROM training_records').all();
    assert.equal(records.length, 1);
    assert.equal(records[0].user_id ?? null, accountId);
    const saved = await ReadSavedGameRecord(records[0], rawDataBucket, version);
    assert.equal(saved.score.rounds.length, 6);
    assert.ok(saved.score.rounds.every(row => row.r >= 0.1 && row.r <= 2.5));
    assert.equal(saved.score.rounds[0].falseStarts, 1);
    assert.equal(saved.score.rounds[1].timedOut, 1);
    assert.equal(saved.score.summary.distractionAnswered, 1);
  }
  assert.deepEqual(errors, []);
  assert.ok(!requests.some(url => /brake-reaction.*(?:settings|score)\.json/.test(url)));
  assert.ok(!requests.some(url => /\/assets\/cars-[^/]+\.webp(?:$|\?)/.test(url)), 'Car graphics must be painted locally.');
  await click('.score-return-button');
  await until(() => standalone ? exists('form') : evaluate("!document.querySelector('dialog iframe')"), 'return to source');
}
