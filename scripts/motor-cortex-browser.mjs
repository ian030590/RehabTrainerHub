import assert from 'node:assert/strict';
import { CheckConfirmationPresentation } from './r2-game-ui-browser.mjs';
import { CheckResultsPresentation } from './r2-game-results-browser.mjs';

export async function CheckMotorCortex({ game, evaluate, until, standalone, english, capture, checkSpotlight,
  sqlite, getSaveAttempts, getSessionAttempts, sessionFailure, requests, errors, version, accountId, guestSubjectId, revokeRelease }) {
  const body = () => game('document.body.innerText');
  const choose = (name, value) => game(`(() => {const field=document.querySelector('[name=${name}]');const proto=field.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(field,${JSON.stringify(String(value))});field.dispatchEvent(new Event(field.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
  const confirm = () => game('document.querySelector("form .btn-primary").click()');
  const skip = () => game('document.querySelector(".game-tour button:nth-of-type(2)").click()');
  const tour = () => until(() => game('Boolean(document.querySelector(".game-tour"))'), 'motor spotlight');
  await until(() => game('document.querySelector("form h2").textContent').then(value => value === (english ? 'Hand Target Tracking Practice' : '手部目標追蹤練習')), 'motor private language');
  assert.match(await game('(async()=>{try{await navigator.mediaDevices.getUserMedia({video:true});return "allowed";}catch(error){return error.name;}})()'), /NotAllowedError|SecurityError/);
  assert.equal(await evaluate('Boolean(window.handFixtureStream)'), false);
  assert.equal(await game('Boolean(document.querySelector(".game-tour"))'), false);
  assert.ok(await game('document.querySelector(".motor-cortex-stage").getBoundingClientRect().height > 100'));
  assert.equal(await game('document.activeElement.name'), 'drill');
  await capture('settings');
  assert.equal(await game('document.fullscreenElement'), null, 'Settings stay windowed.');
  await choose('targetSizePercent', 74); await confirm();
  assert.ok(await game('Boolean(document.querySelector("form"))'), 'Invalid settings cannot start the tour.');
  await game('document.querySelector("[name=targetSizePercent]").dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}))');
  assert.ok(await game('Boolean(document.querySelector("form"))'), 'Enter retains invalid editable settings.');
  const drill = process.argv.includes('--random') ? 'random' : process.argv.includes('--vertical') ? 'vertical' : process.argv.includes('--horizontal') ? 'horizontal' : 'bounce';
  const hand = process.argv.includes('--left') ? 'left' : process.argv.includes('--right') ? 'right' : 'any';
  await choose('targetSizePercent', 130); await choose('speedPercent', 70); await choose('difficulty', 'beginner'); await choose('durationSec', 45); await choose('drill', drill); await choose('handChoice', hand);
  await game('document.querySelector("[name=speedPercent]").dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}))'); await tour();
  assert.equal(await evaluate('Boolean(window.handFixtureStream)'), false, 'Teaching cannot start the sensor.');
  for (const target of ['target', 'hand-cursor', 'hold-meter', 'hud', 'camera']) {
    const geometry = await checkSpotlight(`.motor-cortex-${target}`);
    assert.ok(geometry.panel.right <= geometry.target.left || geometry.panel.left >= geometry.target.right
      || geometry.panel.bottom <= geometry.target.top || geometry.panel.top >= geometry.target.bottom,
    `The ${target} explanation must leave the highlighted game target visible: ${JSON.stringify(geometry)}`);
    await capture(`tutorial-${target}`);
    await game('window.dispatchEvent(new Event("resize"));document.querySelector(".game-tour button").click()');
  }
  await CheckConfirmationPresentation(game); await capture('confirmation');
  assert.equal(await game('document.fullscreenElement'), null, 'Tutorial and final confirmation stay windowed.');
  assert.equal(await game('document.activeElement.classList.contains("btn-primary")'), true, 'Final confirmation focuses Start training.');
  await game('document.activeElement.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",shiftKey:true,bubbles:true}))');
  assert.equal(await game('document.activeElement.classList.contains("btn-ghost")'), true, 'Shift-Tab stays within final confirmation.');
  await game('document.activeElement.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",bubbles:true}))');
  assert.equal(await game('document.activeElement.classList.contains("btn-primary")'), true, 'Tab wraps to Start training.');
  assert.equal(await game('Boolean(document.querySelector(".game-tour-spotlight"))'), false);
  await game('document.querySelector(".motor-tutorial-ready .btn-ghost").click()');
  assert.equal(await game('document.querySelector("[name=targetSizePercent]").value'), '130');
  assert.equal(await game('document.querySelector("[name=drill]").value'), drill);
  await confirm(); await tour(); await game('document.querySelector(".game-tour button:last-child").click()');
  assert.equal(await game('Boolean(document.querySelector(".game-tour-blocker"))'), false);
  const ready = async () => { await confirm(); await tour(); await skip(); await until(() => game('Boolean(document.querySelector(".motor-tutorial-ready .btn-primary"))'), 'motor confirmation'); };
  await ready(); await game('document.querySelector(".motor-tutorial-ready .btn-primary").click()');
  const consent = standalone ? '#camera-consent:not([hidden])' : '.training-overlay-camera-consent';
  await until(() => evaluate(`Boolean(document.querySelector('${consent}'))`), 'trusted motor camera consent');
  assert.equal(await evaluate('document.fullscreenElement'), null, 'Camera consent must be visible outside fullscreen.');
  assert.equal(await evaluate(`(() => {const button=document.querySelector('${consent} button');const rect=button.getBoundingClientRect();return button===document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);})()`), true, 'Consent accepts a real pointer click.');
  assert.equal(await evaluate('Boolean(window.handFixtureStream)'), false);
  await evaluate(`document.querySelector('${consent} button:last-child').click()`);
  await until(() => game('Boolean(document.querySelector("form [role=alert]"))'), 'declined camera restores editable settings');
  assert.equal(getSaveAttempts(), 0);
  await ready(); await game('document.querySelector(".motor-tutorial-ready .btn-primary").click()');
  await until(() => evaluate(`Boolean(document.querySelector('${consent}'))`), 'camera consent retry');
  await evaluate(`document.querySelector('${consent} button').click()`);
  await until(() => game('Boolean(document.querySelector(".motor-tutorial-ready .btn-primary"))'), 'camera-ready Start training', 90000);
  assert.equal(await game('document.fullscreenElement'), null, 'Camera initialization cannot enter fullscreen or start the timer.');
  await game('document.querySelector(".motor-tutorial-ready .btn-primary").click()');
  await until(() => game('Boolean(document.querySelector(".motor-cortex-rehab-phase-playing"))'), 'actual motor game started', 90000);
  await until(() => game('document.querySelector(".motor-cortex-hand-cursor").classList.contains("is-visible")'), 'real MediaPipe hand detected', 30000);
  assert.equal(await evaluate('window.nativeCameraPermissionVerified'), true);
  assert.ok(requests.some(url => url.includes('/input/hand-tracking-1.0.0/wasm/') && url.endsWith('.wasm')));
  assert.equal(requests.some(url => /cdn\.jsdelivr|storage\.googleapis/.test(url)), false);
  assert.ok(await game('document.fullscreenElement===document.querySelector(".motor-cortex-rehab-game")'));
  if (process.argv.includes('--windowed')) {
    await game('document.exitFullscreen()');
    await until(() => game('document.fullscreenElement===null'), 'windowed gameplay');
    assert.equal(await evaluate('innerWidth-document.documentElement.clientWidth'), 0, 'Windowed gameplay does not expose the lobby scrollbar.');
  }
  const layout = await game(`(() => {
    const play = document.querySelector('.motor-cortex-play').getBoundingClientRect();
    const styles = getComputedStyle(document.querySelector('.motor-cortex-play'));
    const documentSize = document.documentElement;
    return { left: play.left, right: play.right, width: innerWidth,
      paddingLeft: styles.paddingLeft, paddingRight: styles.paddingRight,
      clientWidth: documentSize.clientWidth, clientHeight: documentSize.clientHeight,
      scrollWidth: documentSize.scrollWidth, scrollHeight: documentSize.scrollHeight };
  })()`);
  assert.ok(Math.abs(layout.left - (layout.width - layout.right)) <= 1, 'The gameplay area is horizontally centered.');
  assert.equal(layout.paddingLeft, layout.paddingRight, 'Gameplay preserves equal horizontal margins.');
  assert.ok(layout.scrollWidth <= layout.clientWidth && layout.scrollHeight <= layout.clientHeight,
    `Gameplay fits without an internal page scrollbar: ${JSON.stringify(layout)}`);
  await capture('playing');
  if (process.argv.includes('--revoke-playing')) {
    revokeRelease(); await evaluate('window.dispatchEvent(new Event("online"))');
    await until(() => evaluate('!document.querySelector("iframe") && Boolean(document.querySelector("[role=alert]"))'), 'revocation removes the active hand game');
    assert.equal(await evaluate('window.handFixtureStream.getTracks().every(track=>track.readyState==="ended")'), true, 'Revocation stops every camera track.');
    assert.equal(getSaveAttempts(), 0); return;
  }
  if (process.argv.includes('--camera-disconnect')) {
    await evaluate('window.handFixtureStream.getVideoTracks()[0].dispatchEvent(new Event("ended"))');
    await until(() => game('Boolean(document.querySelector("form [role=alert]"))'), 'disconnect returns to settings');
    assert.equal(await evaluate('window.handFixtureStream.getTracks().every(track=>track.readyState==="ended")'), true);
    assert.equal(getSaveAttempts(),0); return;
  }
  await until(async () => {
    if (await game('Boolean(document.querySelector(".experiment-results"))')) return true;
    // Move the recorded camera image towards the target; inference and gameplay stay real.
    const offset = await game(`(() => {const hand=document.querySelector('.motor-cortex-hand-cursor');if(!hand?.classList.contains('is-visible'))return null;const h=hand.getBoundingClientRect(),t=document.querySelector('.motor-cortex-target').getBoundingClientRect(),s=document.querySelector('.motor-cortex-stage').getBoundingClientRect();return {x:((h.left+h.right)-(t.left+t.right))/2/s.width,y:((t.top+t.bottom)-(h.top+h.bottom))/2/s.height};})()`);
    if (offset) await evaluate(`(() => {window.handFixtureOffset.x=Math.max(-.18,Math.min(.18,window.handFixtureOffset.x+${offset.x}*.3));window.handFixtureOffset.y=Math.max(-.18,Math.min(.18,window.handFixtureOffset.y+${offset.y}*.3));})()`);
    return false;
  }, 'real 45-second tracking session completes', 60000);
  assert.equal(await evaluate('window.handFixtureStream.getTracks().every(track=>track.readyState==="ended")'), true, 'Completion stops the camera.');
  await CheckResultsPresentation(game, { defaultMetric: 'accuracy', alternateMetric: 'holdSeconds', english, capture });
  const resultText = await body(); assert.match(resultText, english ? /Interrupted|Success/ : /中斷|成功/);
  assert.ok(await game('Boolean(document.querySelector(".score-chart circle"))'), 'At least one actual hold event reaches the chart.');
  if (standalone) {
    assert.equal(getSaveAttempts(),0);
    assert.equal(await game('document.querySelector(".score-save-status").textContent.includes(' + JSON.stringify(english ? 'device' : '獨立遊玩') + ')'),true);
    await until(() => evaluate('(async()=>Boolean(await caches.match("/input/hand-tracking-1.0.0/hand_landmarker.task")))()'), 'motor PWA cached hand model',30000);
    assert.ok((await evaluate('(async()=>(await navigator.serviceWorker.ready).scope)()')).endsWith(`/games/motor-cortex-rehab/${version}/`));
  } else {
    await until(() => game('Boolean(document.querySelector(".score-retry-button"))'), 'motor failed save retained');
    await game('document.querySelector(".score-retry-button").click()');
    await until(() => game('document.querySelector(".score-save-status").textContent').then(value => value === (english ? 'Saved' : '已保存')), 'motor save acknowledged');
    const rows=sqlite.prepare('SELECT payload_json,user_id,subject_id FROM training_records').all();
    assert.equal(rows.length,1);assert.equal(rows[0].user_id,accountId);assert.equal(rows[0].subject_id===guestSubjectId,accountId===null);
    const record=JSON.parse(rows[0].payload_json);
    assert.deepEqual(record.config,{drill,difficulty:'beginner',durationSec:45,handChoice:hand,targetSizePercent:130,speedPercent:70});
    assert.equal(record.score.rounds.length,record.score.summary.reps+record.score.summary.interrupted);
    assert.ok(record.score.rounds.length>0);assert.ok(record.score.summary.duration>=45);assert.ok(record.score.summary.tracking>0);
    assert.equal(record.metadata.release_version,version.replaceAll('.','_'));assert.ok(getSaveAttempts()>=2);
    assert.equal(getSessionAttempts(),sessionFailure?2:1);
  }
  assert.equal(requests.some(url=>/motor-cortex-rehab.*(?:settings|score)\.json/.test(url)),false);
  assert.equal(errors.length,0,errors.join('\n'));
  await game('document.querySelector(".motor-cortex-rehab-game").requestFullscreen()');
  assert.equal(await evaluate('Boolean(document.fullscreenElement)'), true, 'Return also handles fullscreen on the results screen.');
  await game('document.querySelector(".score-return-button").click()');
  await until(() => standalone ? game('Boolean(document.querySelector("form"))') : evaluate('!document.querySelector("dialog.training-overlay")'), 'motor return to original entry');
  assert.equal(await evaluate('document.fullscreenElement'), null, 'Returning to Hub or entry exits fullscreen.');
  if (standalone) assert.deepEqual(await game('Array.from(document.querySelectorAll(".motor-cortex-hud strong")).slice(1).map(item=>item.textContent)'), ['0%', '0%', '0', '1'], 'A fresh entry clears the previous session HUD.');
  console.log('Motor tracking Brave passed: own modal, five spotlights, actual MediaPipe, 45-second gameplay, numeric events, chart, retry, identity and camera cleanup.');
}
