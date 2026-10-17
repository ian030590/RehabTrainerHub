import assert from 'node:assert/strict';
import { CheckConfirmationPresentation } from './r2-game-ui-browser.mjs';

export async function CheckOculomotor({ game, evaluate, send, until, standalone, english, capture, checkSpotlight,
  sqlite, gameContext, session, getSaveAttempts, getCsvAttempts, csvObjects, accountId, guestSubjectId, version, findEyeContext, revokeRelease }) {
  const moduleIndex = process.argv.indexOf('--activity');
  const activity = moduleIndex < 0 ? 'pursuit' : process.argv[moduleIndex + 1];
  assert.ok(['vor', 'pursuit', 'saccade', 'fixation'].includes(activity));
  const tracking = process.argv.includes('--gaze');
  await evaluate(`window.eyeDownloadBlob=null;window.eyeDownloadName=null;
    const create=URL.createObjectURL;URL.createObjectURL=function(blob){window.eyeDownloadBlob=blob;return create.call(this,blob);};
    const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download?.endsWith('_gaze_record.csv'))window.eyeDownloadName=this.download;else click.call(this);};`);
  await until(() => game(`!document.querySelector('form .btn-primary').disabled`), 'experiment initialized');
  assert.equal(await game(`document.querySelector('form h2').textContent`), english ? 'Oculomotor practice' : '眼動練習');
  assert.equal(await game(`document.querySelectorAll('form [data-axis-key]').length`), 8);
  if (standalone) assert.equal(await game(`Boolean(document.querySelector('.game-tour'))`), false);
  await capture('settings');
  const setInput = async (name, value) => game(`(() => {
    const input=document.querySelector('[name=${name}]'); const prototype=input.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype,'value').set.call(input,${JSON.stringify(String(value))});
    input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true}));
  })()`);
  await setInput('module', activity); await setInput(`${activity}TotalSec`, 5);
  // The fixture supplies measurements for its emulated screen, not a physical monitor.
  const screenAspect = await evaluate(`innerHeight / innerWidth`);
  const incorrectScreenHeight = process.argv.includes('--incorrect-screen-height');
  const staleMeasurements = process.argv.includes('--measurements-16-9');
  if (process.argv.includes('--screen-3-2')) {
    const expression = `({screenWidth:screen.width,screenHeight:screen.height,innerWidth,innerHeight,dpr:devicePixelRatio})`;
    console.log('3:2 screen report: '+JSON.stringify({container:await evaluate(expression),game:await game(expression)}));
    assert.ok(Math.abs(screenAspect - 2 / 3) < .0001, 'The emulated display area itself is 3:2');
  }
  await setInput('screenWidthCm', 48);
  const measurementAspect = staleMeasurements ? 9 / 16 : screenAspect;
  await setInput('screenHeightCm', 48 * measurementAspect * (incorrectScreenHeight ? 2 : 1));
  await setInput('distanceThresholdArcmin', 120);
  assert.equal(await game(`document.querySelector('#slider-threshold-arcmin').value`), '120');
  await game(`(() => { const slider=document.querySelector('#slider-threshold-arcmin'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(slider,'600'); slider.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  assert.equal(await game(`document.querySelector('[name=distanceThresholdArcmin]').value`), '600');
  await setInput('distanceThresholdArcmin', 90);
  if (activity !== 'vor') {
    await game(`document.querySelector('[data-center-btn]').click()`);
    assert.equal(await game(`document.querySelectorAll('[data-axis-key][aria-pressed=true]').length`), 4);
    await game(`document.querySelector('[data-center-btn]').click()`);
    assert.equal(await game(`document.querySelectorAll('[data-axis-key][aria-pressed=true]').length`), 8);
    assert.equal(await game(`Boolean(document.querySelector('[name=speedArcminSec]'))`), ['pursuit','fixation'].includes(activity));
  }
  await setInput('module', activity === 'vor' ? 'pursuit' : 'vor');
  await setInput('module', activity);
  assert.equal(await game(`document.querySelector('[name=${activity}TotalSec]').value`), '5', 'Each module retains its own settings');
  await setInput('eyeTrackingSource', tracking ? 'webgazer' : 'off');
  await game(`document.querySelector('[name=module]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);
  await until(() => game(`Boolean(document.querySelector('.game-tour'))`), 'spotlight');
  await checkSpotlight('.oculomotor-preview-target');
  await game(`document.querySelector('.game-tour button:last-child').click()`);
  await until(() => game(`Boolean(document.querySelector('form'))`), 'back to retained settings');
  assert.equal(await game(`document.querySelector('[name=${activity}TotalSec]').value`), '5');
  await game(`document.querySelector('form .btn-primary').click()`);
  for (const target of ['.oculomotor-preview-target', '.oculomotor-preview-directions', '.oculomotor-preview-calibration', '.oculomotor-preview-stop']) {
    await until(() => game(`Boolean(document.querySelector('.game-tour'))`), target);
    if (standalone && target === '.oculomotor-preview-calibration') {
      const install=await evaluate(`(() => {const button=document.querySelector('#install-button');return button && !button.hidden ? button.getBoundingClientRect().toJSON() : null;})()`);
      if (install) {
        const label=await game(`document.querySelector('.oculomotor-preview-calibration').getBoundingClientRect().toJSON()`);
        assert.ok(label.bottom <= install.top || label.top >= install.bottom || label.right <= install.left || label.left >= install.right,'The PWA install control must not obscure the spotlight target');
      }
    }
    await checkSpotlight(target); await capture('tutorial-' + target.split('-').at(-1));
    await game(`document.querySelector('.game-tour button').click()`);
  }
  await until(() => game(`Boolean(document.querySelector('.training-confirmation'))`), 'confirmation');
  await CheckConfirmationPresentation(game);
  assert.equal(await game(`document.fullscreenElement`), null);
  await capture('confirmation');
  let eyeContext;
  if (tracking) {
    console.log('Eye camera: requesting consent');
    await game(`document.querySelector('.training-confirmation button').click()`);
    await until(() => evaluate(`Boolean(document.querySelector('${standalone ? '#camera-consent:not([hidden])' : '.training-overlay-camera-consent'}'))`), 'explicit camera consent');
    assert.equal(await evaluate(`Boolean(document.querySelector('iframe[title="WebGazer camera preview"]'))`), false, 'No camera before consent');
    if (process.argv.includes('--camera-denied')) {
      await evaluate(`document.querySelector('${standalone ? '#camera-cancel' : '.training-overlay-camera-consent button:last-child'}').click()`);
      await until(() => game(`Boolean(document.querySelector('.training-confirmation [role=alert]'))`), 'camera refusal remains visible');
      assert.equal(await game(`document.querySelector('.training-confirmation button:nth-last-child(2)').disabled`),true);
      assert.equal(getSaveAttempts(),0);
      await game(`document.querySelector('.training-confirmation button').click()`);
      await until(() => evaluate(`Boolean(document.querySelector('${standalone ? '#camera-consent:not([hidden])' : '.training-overlay-camera-consent'}'))`), 'camera retry asks consent');
    }
    await evaluate(`document.querySelector('${standalone ? '#camera-enable' : '.training-overlay-camera-consent button'}').click()`);
    console.log('Eye camera: consent accepted');
    await until(async () => {eyeContext=await findEyeContext();return Boolean(eyeContext);}, 'trusted input document');
    console.log('Eye camera: input document loaded');
    await send('Runtime.runIfWaitingForDebugger',{},eyeContext.session || session);
    await until(() => game(`window.OculomotorInput.FaceDetected()`), 'fresh private FaceMesh frame on portrait stream', 60000);
    await until(() => game(`!document.querySelector('.training-confirmation .btn-primary').disabled`), 'camera ready',60000);
    assert.equal(await evaluate(`window.eyeFixtureStream.getTracks()[0].readyState`,eyeContext), 'live');
    assert.equal(await evaluate(`window.nativeCameraPermissionVerified`,eyeContext),true,'Camera permissions succeed only in the trusted input document');
    assert.equal(await game(`document.featurePolicy.allowsFeature('camera')`), false, 'Opaque game cannot acquire camera');
    await capture('camera-ready');
  }
  await game(`document.querySelector('.training-confirmation .btn-primary').click()`);
  if (tracking) {
    await until(() => game(`Boolean(document.querySelector('#webgazer-camera-continue')) && !document.querySelector('#webgazer-camera-continue').disabled`), 'face positioning ready',60000);
    assert.match(await game(`document.querySelector('#webgazer-eye-status').textContent`), english ? /detected.*ready/i : /已偵測.*就緒/);
    await capture('camera-position');
    const positioning = await game(`(() => { const shell=document.querySelector('.webgazer-camera-page .app-shell'), rect=shell.getBoundingClientRect(); return { x:rect.left+rect.width/2-innerWidth/2, y:rect.top+rect.height/2-innerHeight/2, width:innerWidth, height:innerHeight, contentHeight:rect.height }; })()`);
    assert.ok(Math.abs(positioning.x)<2 && Math.abs(positioning.y)<2,'Positioning text is centered in both axes: '+JSON.stringify(positioning));
    await CheckTextLayout(game, '.webgazer-camera-page', 'h1,p,button');
    await capture('camera-position');
    await until(() => game(`(() => {
      const button=document.querySelector('#webgazer-camera-continue');
      if(button && !button.disabled) button.click();
      return Boolean(document.querySelector('.gaze-calibration-point'));
    })()`), 'ready camera enters calibration',60000);
    for (let index=0;index<18;index++) {
      await until(() => game(`Boolean(document.querySelector('.gaze-calibration-point'))`), 'calibration point');
      await CheckTextLayout(game, '.gaze-calibration', 'p,button');
      await game(`document.querySelector('.gaze-calibration-point').click()`);
      await new Promise(resolve=>setTimeout(resolve,120));
    }
    await until(() => game(`Boolean(document.querySelector('[data-val-action]'))`), 'five point validation',30000);
    await capture('validation');
    await CheckTextLayout(game, '.webgazer-validate-card', 'h2,p,dt,dd,.webgazer-validate-stat-value,button');
    assert.match(await game(`document.querySelector('.webgazer-validate-card').textContent`),english ? /Mean Angular Error/ : /平均角度誤差/);
    await game(`document.querySelector('[data-val-action=proceed], [data-val-action=done]').click()`);
  }
  await until(() => game(`Boolean(document.querySelector('#training-stimulus'))`), 'original stimulus engine');
  assert.equal(await game(`document.fullscreenElement === document.querySelector('.oculomotor-game-root')`), true);
  const stimulusSize = await game(`(() => {const rect=document.querySelector('#training-stimulus').getBoundingClientRect();return {width:rect.width,height:rect.height};})()`);
  const expectedRatio = measurementAspect / screenAspect * (incorrectScreenHeight ? 2 : 1);
  assert.ok(Math.abs(stimulusSize.width / stimulusSize.height - expectedRatio) < .01,
    `Correct screen aspect renders a circle; incorrect aspect must deform: ${JSON.stringify(stimulusSize)}`);
  console.log(`Stimulus geometry (${incorrectScreenHeight ? 'incorrect height' : staleMeasurements ? 'stale 16:9 measurements' : 'matching aspect'}): ${JSON.stringify(stimulusSize)}`);
  const start = await game(`document.querySelector('#training-stimulus').style.transform`);
  await new Promise(resolve => setTimeout(resolve, 1200));
  const after = await game(`document.querySelector('#training-stimulus').style.transform`);
  if (['pursuit', 'saccade'].includes(activity)) assert.notDeepEqual(after, start, 'The original stimulus moves');
  if (activity === 'vor') assert.match(await game(`document.querySelector('#stimulus-number').textContent`), /^\d+$/, 'Central recognition retains its numbered stimulus');
  await capture('gameplay');
  if (process.argv.includes('--camera-disconnect')) {
    assert.ok(tracking);
    await evaluate(`window.eyeFixtureStream.getVideoTracks()[0].dispatchEvent(new Event('ended'))`,eyeContext);
    await until(() => game(`Boolean(document.querySelector('form [role=alert]'))`), 'disconnected camera returns a visible error');
    await until(() => game(`!document.fullscreenElement`), 'camera disconnect exits fullscreen');
    assert.equal(await game(`document.querySelector('[name=eyeTrackingSource]').value`), 'webgazer');
    assert.equal(await evaluate(`Boolean(document.querySelector('iframe[title="WebGazer camera preview"]'))`),false);
    assert.equal(getSaveAttempts(),0); assert.equal(getCsvAttempts(),0);
    await capture('camera-disconnected');
    await game(`document.querySelector('form .btn-ghost').click()`);
    console.log('Eye camera disconnect stopped inference and fullscreen without saving or changing settings.');
    return;
  }
  if (process.argv.includes('--revoke-playing')) {
    assert.equal(standalone,false);
    revokeRelease(); await evaluate(`window.dispatchEvent(new Event('online'))`);
    await until(() => evaluate(`!document.querySelector('dialog iframe') && Boolean(document.querySelector('dialog [role=alert]'))`), 'revocation during activity removes the game and camera');
    assert.equal(getSaveAttempts(),0);assert.equal(getCsvAttempts(),0);
    console.log('Revocation during eye activity stopped the game and camera without saving.');
    return;
  }
  if (process.argv.includes('--stop')) {
    await game(`document.querySelector('.oculomotor-stop').click()`);
    await until(() => standalone ? game(`Boolean(document.querySelector('form'))`) : evaluate(`!document.querySelector('dialog iframe')`), 'stop returns without saving');
    assert.equal(getSaveAttempts(), 0); return;
  }
  await until(() => game(`Boolean(document.querySelector('.experiment-results'))`), 'complete activity');
  await until(() => game(`!document.fullscreenElement`), 'completion exits fullscreen');
  assert.equal(await game(`document.querySelectorAll('.results-table tbody tr').length`), 1);
  assert.equal(await game(`document.querySelectorAll('.results-table tbody td').length`), 12);
  assert.equal(await game(`(() => {const metric=document.querySelectorAll('.score-key-grid>div')[1]; return getComputedStyle(metric).color !== getComputedStyle(metric).backgroundColor;})()`), true, 'Result values must be readable on their surface');
  assert.equal(await game(`document.fullscreenElement`), null);
  assert.equal(await game(`document.querySelector('.score-analysis select').value`),'accuracy','Accuracy is the default analysis');
  assert.match(await game(`document.querySelector('.score-priority').textContent`), /Accuracy[\s\S]*TFF/);
  assert.equal(await game(`Boolean(document.querySelector('.score-context').compareDocumentPosition(document.querySelector('.score-analysis')) & Node.DOCUMENT_POSITION_PRECEDING)`),true,'Metadata follows statistics');
  await CheckTextLayout(game, '.score-priority', 'h2,p,strong');
  if (standalone) {
    const install = await evaluate(`(() => {const button=document.querySelector('#install-button');return button && !button.hidden ? button.getBoundingClientRect().toJSON() : null;})()`);
    if (install) assert.ok((await game(`document.querySelector('.score-header').getBoundingClientRect().top`)) >= install.bottom,'PWA install control must not obscure the result title');
  }
  if (!tracking) assert.match(await game(`document.querySelector('.score-key-grid').innerText`), english ? /Missing/ : /缺測/);
  await game(`document.querySelector('.score-analysis select').value='accuracy';document.querySelector('.score-analysis select').dispatchEvent(new Event('change',{bubbles:true}))`);
  if (!tracking) assert.match(await game(`document.querySelector('.score-chart').innerText`), english ? /Missing/ : /缺測/);
  await capture('results');
  if (standalone) {
    assert.equal(getSaveAttempts(), 0); assert.match(await game(`document.querySelector('.score-save-status').textContent`), english ? /Local/ : /獨立/);
  } else {
    await until(() => game(`Boolean(document.querySelector('.score-retry-button'))`), 'retryable save failure');
    await game(`document.querySelector('.score-retry-button').click()`);
    if (tracking) {
      await until(() => game(`Boolean(document.querySelector('.score-retry-button'))`), 'summary save retry after CSV succeeded');
      await game(`document.querySelector('.score-retry-button').click()`);
    }
    await until(() => game(`document.querySelector('.score-save-status').textContent === ${JSON.stringify(english ? 'Saved' : '已保存')}`), 'same session saved');
    const rows=sqlite.prepare('SELECT * FROM training_records').all(); assert.equal(rows.length, 1);
    const record=JSON.parse(rows[0].payload_json);
    if (tracking) {
      assert.ok(record.score.summary.samples > 0); assert.equal(getCsvAttempts(),2);assert.equal(csvObjects.size,1);
      const [[key,value]]=csvObjects;assert.equal(key,`${accountId?'users/'+accountId:'guests/'+rows[0].subject_id}/${record.id}.csv`);
      assert.equal(value.customMetadata.officialGameVersion,version); assert.equal(Number(value.customMetadata.gazeSampleCount),record.score.summary.samples);
      assert.match(value.csv,/sample_index,trial_time_ms/);assert.doesNotMatch(value.csv,/data:image|authToken|email/);
    } else { assert.equal(record.score.summary.samples,null);assert.equal(getCsvAttempts(),0); }
    assert.equal(record.config.module,activity); assert.equal(record.config.eyeTrackingSource,tracking?'webgazer':'off');
    assert.equal(record.config[`${activity}TotalSec`],5); assert.equal(rows[0].user_id,accountId);
    if (accountId) assert.notEqual(rows[0].subject_id,guestSubjectId,'Account uses its separate subject'); else assert.equal(rows[0].subject_id,guestSubjectId);
  }
  await game(`document.querySelector('.score-download-button').click()`);
  await until(() => evaluate(`Boolean(window.eyeDownloadName && window.eyeDownloadBlob)`), 'reference CSV download');
  assert.match(await evaluate(`window.eyeDownloadBlob.text()`),/# -- Oculomotor Practice Session Record --/);
  const referenceCsv = await evaluate(`window.eyeDownloadBlob.text()`);
  assert.match(referenceCsv, /accuracy_eligible,accuracy_delta_t_ms,gaze_velocity_deg_s,is_fixation,tff_ms/);
  if (tracking) assert.match(referenceCsv, /"webgazer_inference_start_to_browser_performance"/, 'Private frames retain their inference timestamp across input and game documents');
  assert.match(await evaluate(`window.eyeDownloadName`),/^SUBJ_.*_gaze_record\.csv$/);
  if (tracking) assert.equal(await evaluate(`Boolean(document.querySelector('iframe[title="WebGazer camera preview"]'))`),false,'Completion removes the camera document');
  if (standalone) {
    await until(() => evaluate(`caches.keys().then(keys=>keys.some(key=>key.startsWith('trainerhub-game:oculomotor-training:${version}:')))`), 'versioned offline cache');
    const cached=await evaluate(`caches.keys().then(async keys=>{const cache=await caches.open(keys.find(key=>key.startsWith('trainerhub-game:oculomotor-training:${version}:')));return (await cache.keys()).map(request=>new URL(request.url).pathname);})`);
    for (const path of ['index.js','preview.html','eyeTrackingEntry.js','eyeTrackingController.js','webgazer.js','models/facemesh/model.json','models/facemesh/group1-shard1of1.bin','models/blazeface/model.json','models/blazeface/group1-shard1of1.bin'])
      assert.ok(cached.includes('/input/eye-tracking-1.1.0/'+path),path);
    assert.equal(cached.some(path=>/^\/games\/(?!oculomotor-training\/)/.test(path)),false,'Cache stays within this release');
    await until(() => evaluate(`Boolean(navigator.serviceWorker.controller)`), 'active PWA service worker');
    await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1},session);
    try {
      for (const path of ['/input/eye-tracking-1.1.0/models/facemesh/model.json','/input/eye-tracking-1.1.0/models/blazeface/group1-shard1of1.bin',`/games/oculomotor-training/${version}/package/reference/experiment.js`])
        assert.ok(await evaluate(`fetch(${JSON.stringify(path)}).then(async response=>response.ok && (await response.arrayBuffer()).byteLength>0)`), 'Offline PWA serves '+path);
    } finally {
      await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1},session);
    }
  }
  await game(`document.querySelector('.score-return-button').click()`);
  await until(() => standalone ? game(`Boolean(document.querySelector('form'))`) : evaluate(`!document.querySelector('dialog iframe')`), 'single return action');
  if (standalone) assert.equal(await game(`Boolean(document.querySelector('.game-tour'))`), false);
  console.log(`Oculomotor ${activity}: original activity, four spotlights, numerical results and private save passed.`);
}

async function CheckTextLayout(game, root, selector) {
  const issue = await game(`(() => {
    const root=document.querySelector(${JSON.stringify(root)});
    const elements=[...root.querySelectorAll(${JSON.stringify(selector)})].filter(node=>node.getClientRects().length);
    for(let index=0;index<elements.length;index++) {
      const node=elements[index], rect=node.getBoundingClientRect();
      if(node.scrollWidth>node.clientWidth+2) return 'Horizontal overflow: '+node.textContent;
      for(const other of elements.slice(index+1)) {
        if(node.contains(other)||other.contains(node)) continue;
        const next=other.getBoundingClientRect();
        if(Math.min(rect.right,next.right)-Math.max(rect.left,next.left)>2 && Math.min(rect.bottom,next.bottom)-Math.max(rect.top,next.top)>2) return 'Overlapping text: '+node.textContent+' / '+other.textContent;
      }
    }
    return null;
  })()`);
  assert.equal(issue,null);
}
