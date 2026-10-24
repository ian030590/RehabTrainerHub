import assert from 'node:assert/strict';
import { CheckConfirmationPresentation } from './r2-game-ui-browser.mjs';
import { CheckResultsPresentation } from './r2-game-results-browser.mjs';

export function KeyboardCameraProbe(standalone) {
  const consentSelector = standalone ? '#camera-consent:not([hidden])' : '.training-overlay-camera-consent';
  return `(() => {
    const mediaDevices = navigator.mediaDevices;
    window.seagullCameraCalls = 0;
    if (mediaDevices?.getUserMedia) {
      const getUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
      mediaDevices.getUserMedia = (...args) => { window.seagullCameraCalls++; return getUserMedia(...args); };
    }
    const consentSelector = ${JSON.stringify(consentSelector)};
    window.seagullCameraConsentSeen = Boolean(document.querySelector(consentSelector));
    window.seagullCameraConsentObserver = new MutationObserver(records => {
      if (document.querySelector(consentSelector)) window.seagullCameraConsentSeen = true;
      for (const record of records) {
        if (consentSelector.startsWith('#') && record.type === 'attributes' && record.attributeName === 'hidden'
          && record.target.id === 'camera-consent' && record.oldValue === null) window.seagullCameraConsentSeen = true;
        for (const node of record.addedNodes ?? []) {
          if (node.nodeType === 1 && (node.matches(consentSelector) || node.querySelector(consentSelector))) window.seagullCameraConsentSeen = true;
        }
      }
    });
    window.seagullCameraConsentObserver.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'], attributeOldValue: true,
    });
  })()`;
}

export async function CheckSeagullFlight({ game, evaluate, send, until, standalone, english, capture, checkSpotlight, sqlite,
  gameContext, session, getSaveAttempts, requests, errors, version, accountId, guestSubjectId, touch = false }) {
  await evaluate(KeyboardCameraProbe(standalone));
  const settings = { inputMode: 'keyboard', durationSec: 60, turnRangeDeg: 20, nodRangeDeg: 10, glideSec: 10, ringIntervalSec: 3 };
  const inputSession = gameContext.session || session;
  if (touch) for (const target of new Set([session, inputSession])) await send('Emulation.setTouchEmulationEnabled', {enabled:true,maxTouchPoints:5},target);
  const setInput = (name, value) => game(`(() => {
    const input = document.querySelector('[name=${name}]');
    Object.getOwnPropertyDescriptor(input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(String(value))});
    input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  })()`);
  const tap = async selector => {
    const at = await game(`(() => { const rect=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};})()`);
    if (touch) {
      await send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[at]},inputSession);
      await send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]},inputSession);
    } else {
      await send('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',clickCount:1,...at}, inputSession);
      await send('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',clickCount:1,...at}, inputSession);
    }
  };
  const phaseIs = name => game(`document.querySelector('.seagull-root').classList.contains('seagull-flight-phase-${name}')`);
  const noOverflow = () => game('document.documentElement.scrollWidth <= innerWidth');
  const waitForConfirmation = () => until(() => game(`(() => {
    const primary = document.querySelector('.training-confirmation .btn-primary');
    return Boolean(primary && !primary.disabled && !document.querySelector('.game-tour, .game-tour-blocker'));
  })()`), 'enabled confirmation after tutorial teardown');
  await until(() => game(`document.querySelector('form h2')?.textContent === ${JSON.stringify(english ? 'Seagull Flight' : '海鷗飛行')}`), 'game language');
  assert.equal(await game(`document.querySelector('dialog').matches(':modal')`), true);
  assert.ok(await noOverflow());
  await capture('settings');
  for (const [name, value] of Object.entries(settings)) await setInput(name, value);
  await game(`document.querySelector('[name=durationSec]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);
  await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'tutorial starts after confirming');
  for (const target of ['.seagull-preview-flap', '.seagull-preview-glide', '.seagull-preview-sea', '.seagull-hud']) {
    await checkSpotlight(target);
    await capture(`tutorial-${target.slice(1)}`);
    await game(`document.querySelector('.game-tour button').click()`);
  }
  await CheckConfirmationPresentation(game);
  await capture('confirmation');
  await game(`document.querySelector('.training-confirmation .btn-ghost').click()`);
  await until(() => phaseIs('menu'), 'return to settings');
  for (const [name,value] of Object.entries(settings)) assert.equal(await game(`document.querySelector('[name=${name}]').value`),String(value));
  await game(`document.querySelector('form .btn-primary').click()`);
  await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'tutorial restarts');
  await game(`document.querySelector('.game-tour button:nth-of-type(2)').click()`);
  await waitForConfirmation();
  await tap('.training-confirmation .btn-primary');
  await until(() => phaseIs('playing'), 'keyboard flight starts');
  assert.equal(await evaluate(`Boolean(document.querySelector('.training-overlay-camera-consent, #camera-consent:not([hidden])'))`), false);
  assert.equal(await game(`Boolean(document.querySelector('.seagull-calibration-overlay'))`), false);
  assert.ok(await game(`document.querySelector('.seagull-canvas').width > 0`));
  assert.ok(await game(`[...document.querySelectorAll('.seagull-controls button,.seagull-stop')].every(button=>{const rect=button.getBoundingClientRect();return rect.width>=44 && rect.height>=44 && rect.left>=0 && rect.right<=innerWidth && rect.bottom<=innerHeight;})`));
  assert.ok(await noOverflow());
  await capture('playing');
  // Escape discards a flight and does not save a partial record.
  await game(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  await until(() => phaseIs('menu'), 'Escape returns to settings');
  assert.equal(getSaveAttempts(), 0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM training_records').get().count, 0);
  await until(() => evaluate('document.fullscreenElement === null'), 'Escape leaves fullscreen');
  await game(`document.querySelector('form .btn-primary').click()`);
  await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'tutorial before full run');
  await game(`document.querySelector('.game-tour button:nth-of-type(2)').click()`);
  await waitForConfirmation();
  await tap('.training-confirmation .btn-primary');
  await until(() => phaseIs('playing'), 'second run starts');
  await game(`window.__seagullFlapTimer=setInterval(()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{key:' ',bubbles:true}));},1800)`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37},inputSession);
  await new Promise(done=>setTimeout(done,500));
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37},inputSession);
  await tap('.seagull-controls button:last-child');
  await tap('.seagull-controls .btn-primary');
  await capture('gliding');
  await until(() => game(`Boolean(document.querySelector('.experiment-results'))`), 'flight time reaches results', 80000);
  await game('clearInterval(window.__seagullFlapTimer)');
  await until(() => evaluate('document.fullscreenElement === null'), 'results leave fullscreen');
  await CheckResultsPresentation(game, {defaultMetric:'passed',alternateMetric:'headAngle',english,capture});
  assert.ok(await noOverflow());
  if (standalone) {
    assert.equal(getSaveAttempts(),0);
    assert.equal(await evaluate('navigator.serviceWorker.ready.then(registration=>new URL(registration.scope).pathname)'),`/games/seagull-flight/${version}/`);
  } else {
    await until(() => game(`Boolean(document.querySelector('.score-retry-button'))`),'failed save offers retry');
    await game(`document.querySelector('.score-retry-button').click()`);
    await until(() => game(`document.querySelector('.score-save-status').textContent === ${JSON.stringify(english ? 'Session record saved.' : '當次紀錄已保存。')}`),'save retry succeeds');
    const records=sqlite.prepare('SELECT * FROM training_records').all();
    assert.equal(records.length,1);
    assert.equal(records[0].user_id ?? null,accountId);
    if(accountId) assert.notEqual(records[0].subject_id,guestSubjectId); else assert.equal(records[0].subject_id,guestSubjectId);
    const saved=JSON.parse(records[0].payload_json);
    assert.equal(saved.gameId,'seagull-flight');
    assert.deepEqual(saved.config,settings);
    assert.equal(saved.score.summary.duration,60);
    assert.equal(saved.score.summary.crashed,0);
    assert.ok(saved.score.summary.flaps>10);
    assert.equal(saved.score.summary.maxTurnDeg,null);
    assert.equal(saved.score.summary.maxNodDeg,null);
    assert.ok(saved.score.rounds.length>=10);
  }
  if (!standalone) assert.equal(requests.some(url=>url.includes('/input/head-tracking-')),false,'Keyboard play never starts the camera proxy.');
  assert.equal(await evaluate('window.seagullCameraCalls'), 0, 'Keyboard play never opens the camera.');
  assert.equal(await evaluate('window.seagullCameraConsentSeen'), false, 'Camera consent never appears during keyboard play.');
  await evaluate('window.seagullCameraConsentObserver.disconnect()');
  assert.deepEqual(errors,[]);
  await game(`document.querySelector('.score-return-button').click()`);
  await until(() => standalone ? phaseIs('menu') : evaluate(`!document.querySelector('dialog iframe')`),'return to source');
  console.log('seagull-flight: keyboard settings, four spotlights, Escape without saving, 3D flight, flap and glide, 60 s results, save retry and return passed.');
}
