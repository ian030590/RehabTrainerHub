import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptGameMessage } from '../../../packages/ui/src/selfContainedGame.js';
import { RenderServiceWorker } from '../functions/_lib/render.js';
import { HandleRequest } from '../functions/[[path]].js';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { ValidateRelease } from '../functions/_lib/release.js';

test('Pages routes the exact eye input version through Functions while other input stays static', async () => {
  const routes=JSON.parse(await readFile(new URL('../public/_routes.json',import.meta.url),'utf8'));
  assert.deepEqual(routes.include,['/games/*','/input/eye-tracking-1.0.0/*']);
  assert.deepEqual(routes.exclude,['/runtime/*']);
});

test('only the trusted official eye launcher can delegate camera; the game remains opaque and cannot connect', async () => {
  const bytes=Buffer.from('<!doctype html><title>Eye</title>');
  const files=[{path:'index.html',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}];
  const release={schemaVersion:1,status:'approved',gameId:'oculomotor-training',version:'2.0.0',name:'Eye',entry:'index.html',
    runtime:{name:'native',major:1},presentation:'game',capabilities:['eye-tracking'],files,
    contentSha256:createHash('sha256').update(JSON.stringify(files)).digest('hex')};
  assert.throws(()=>ValidateRelease({...release,gameId:'third-party'},'third-party','2.0.0'));
  let approved=true;
  const bucket={get:async key=>{
    const source=key.startsWith('official-games/') ? (approved ? JSON.stringify({schemaVersion:1,gameId:release.gameId,currentVersion:release.version,releases:{[release.version]:{contentSha256:release.contentSha256}}}) : null)
      : key.endsWith('/release.json') ? JSON.stringify(release) : null;
    if(source)return {size:Buffer.byteLength(source),text:async()=>source};
    if(key.endsWith('/files/index.html'))return {size:bytes.length,body:bytes,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
    return null;
  }};
  const read=path=>HandleRequest({request:new Request('https://runner.example/games/oculomotor-training/2.0.0/'+path),env:{GAME_RELEASE_BUCKET:bucket}});
  const launcher=await read('');assert.equal(launcher.status,200);
  assert.match(launcher.headers.get('Permissions-Policy'),/camera=\(self\)/);
  assert.doesNotMatch(launcher.headers.get('Content-Security-Policy'),/unsafe-eval/);
  const html=await launcher.text();assert.match(html,/sandbox="allow-scripts"/);assert.doesNotMatch(html,/allow-same-origin|allow="camera/);
  const game=await read('package/index.html');assert.equal(game.status,200);
  assert.match(game.headers.get('Permissions-Policy'),/camera=\(\)/);
  assert.match(game.headers.get('Content-Security-Policy'),/connect-src 'none'/);
  assert.doesNotMatch(game.headers.get('Content-Security-Policy'),/unsafe-eval/);
  approved=false;assert.equal((await read('')).status,404);
});

test('each eye inference clears the previous face state when the face disappears', async () => {
  const code=ts.transpileModule(await readFile(new URL('../runtime/eyeTrackingEntry.js',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  let environment;const tracker={predictionReady:true,model:Promise.resolve({})};
  const controller={Stop(){}};
  const window={addEventListener(){},webgazer:{params:{},removeMouseEventListeners(){},getRegression:()=>[],begin:async()=>{},pause(){},showPredictionPoints(){},
    getTracker:()=>tracker,getCurrentPrediction:async()=>null,recordScreenPosition(){}}};
  new Function('require','exports','window',code)(()=>({CreateEyeTrackingController:env=>{environment=env;return controller;}}),{},window);
  const engine=await environment.createEngine({getTracks:()=>[]});
  await engine.Predict();assert.equal(engine.FaceDetected(),false);
});

test('CSV retry keeps the original session and identity, and never falls back to guest after authorization fails', async () => {
  const code = ts.transpileModule(await readFile(new URL('../../../packages/ui/src/saveOculomotorCsv.ts',import.meta.url),'utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const {IsOculomotorCsvPayload}=await import('../../../packages/ui/src/oculomotorCsv.js');
  let token='account-token';let status=503;const requests=[];let verify=async()=> 'verification';
  const module={exports:{}};
  new Function('module','exports','require','fetch',code)(module,module.exports,path=>path.includes('authClient')
    ? {GetAuthToken:()=>token,CreateRemoteTrainingRecordVerificationToken:()=>verify()} : {IsOculomotorCsvPayload},
    async(url,options)=>{requests.push({url,...options});return {ok:status===201,status};});
  const payload={records:[[1,10,null,10,100,1,320,240,330,245,11.18,.2,1,'movement','right']],metadata:{eye_tracking_source:'webgazer'}};
  const session={recordId:'fixed-id',version:'2.0.0',token:'fixed-session'};
  const identity={token,subjectId:'account-subject'};
  await assert.rejects(module.exports.SaveOculomotorCsv(payload,session,identity));
  status=201;await module.exports.SaveOculomotorCsv(payload,session,identity);
  assert.equal(requests.length,2);assert.equal(requests[0].body,requests[1].body);
  assert.equal(JSON.parse(requests[1].body).recordId,session.recordId);
  assert.equal(requests[1].headers.Authorization,'Bearer account-token');
  status=401;await assert.rejects(module.exports.SaveOculomotorCsv(payload,session,identity));assert.equal(requests.length,3);
  verify=async()=>{token=null;return 'verification';};
  await assert.rejects(module.exports.SaveOculomotorCsv(payload,session,identity));assert.equal(requests.length,3);
});

test('eye broker requires consent and disposes an input controller arriving after cancellation', async () => {
  const {CreateEyeTrackingBroker}=await import('../../../packages/ui/src/eyeTrackingBroker.js');
  let consent;let resolveController;const messages=[];let acquisitions=0;let stops=0;
  const broker=CreateEyeTrackingBroker({requestConsent:()=>new Promise(resolve=>{consent=resolve;}),cancelConsent:()=>consent?.(false),
    createController:()=>{acquisitions++;return new Promise(resolve=>{resolveController=resolve;});},send:message=>messages.push(message)});
  const denied=broker.Start();assert.equal(acquisitions,0);consent(false);await denied;
  assert.equal(messages[0].payload.reason,'permission');
  const cancelled=broker.Start();consent(true);await new Promise(resolve=>setImmediate(resolve));broker.Stop();
  resolveController({Stop:()=>stops++});await cancelled;
  assert.equal(stops,1);assert.equal(messages.length,1);
});

test('native eye PWA retains the entire pinned proxy offline and keeps camera permission out of game responses', async () => {
  const release = { gameId: 'oculomotor-training', version: '2.0.0', entry: 'index.html', files: [], presentation: 'game', capabilities: ['eye-tracking'] };
  const sw = await RenderServiceWorker(release, '/games/oculomotor-training/2.0.0/');
  for (const path of ['preview.html', 'eyeTrackingEntry.js', 'eyeTrackingController.js', 'webgazer.js', 'preview.css', 'index.js',
    'models/facemesh/model.json', 'models/facemesh/group1-shard1of1.bin', 'models/blazeface/model.json', 'models/blazeface/group1-shard1of1.bin'])
    assert.ok(sw.includes('/input/eye-tracking-1.0.0/' + path), path);
  const response = await HandleRequest({ request: new Request('https://trainerhub-user-games.pages.dev/input/eye-tracking-1.0.0/preview.html'),
    env: {}, next: async () => new Response('trusted input') });
  assert.match(response.headers.get('Permissions-Policy'), /camera=\(self\)/);
  assert.match(response.headers.get('Content-Security-Policy'), /connect-src 'self'/);
  assert.doesNotMatch(response.headers.get('Content-Security-Policy'), /localhost|127\.0\.0\.1/);
});

test('only the official eye game can request gaze calibration on its private channel', () => {
  const state = { gameId: 'oculomotor-training', version: '2.0.0', sessionNonce: 'a'.repeat(64), sequence: -1, complete: false, capabilities: ['eye-tracking'] };
  const message = { schema: 'trainerhub.game/v1', gameId: state.gameId, version: state.version, sessionNonce: state.sessionNonce, sequence: 0, type: 'input-calibrate', payload: { x: .25, y: .5 } };
  assert.equal(AcceptGameMessage(message, { ...state }), true);
  for (const patch of [{ capabilities: [] }, { gameId: 'third-party' }, { complete: true }])
    assert.equal(AcceptGameMessage({ ...message, gameId: patch.gameId ?? state.gameId }, { ...state, ...patch }), false);
  for (const payload of [{ x: -1, y: .5 }, { x: Infinity, y: 0 }, { x: .5, y: .5, image: 'private' }])
    assert.equal(AcceptGameMessage({ ...message, payload }, { ...state }), false);
  for (const type of ['input-start', 'input-stop', 'input-reset'])
    assert.equal(AcceptGameMessage({ ...message, type, payload: {} }, { ...state }), true);
});

test('gaze CSV accepts canonical numeric samples, rejects identity, overflow and malformed rows', () => {
  const state = { gameId: 'oculomotor-training', version: '2.0.0', sessionNonce: 'a'.repeat(64), sequence: -1, complete: false, capabilities: ['eye-tracking'] };
  const payload = { records: [[1, 10, null, 10, 100, 1, 320, 240, 330, 245, 11.18, .2, 1, 'movement', 'right']], metadata: { mode: 'pursuit', eye_tracking_source: 'webgazer' } };
  const message = { schema: 'trainerhub.game/v1', gameId: state.gameId, version: state.version, sessionNonce: state.sessionNonce, sequence: 0, type: 'gaze-csv', payload };
  assert.equal(AcceptGameMessage(message, { ...state }), true);
  for (const changes of [{ records: [[1, 10]] }, { metadata: { ...payload.metadata, subjectId: 'secret' } }, { records: Array(36001).fill(payload.records[0]) }])
    assert.equal(AcceptGameMessage({ ...message, payload: { ...payload, ...changes } }, { ...state }), false);
  const accepted = { ...state };
  assert.equal(AcceptGameMessage(message, accepted), true);
  assert.equal(AcceptGameMessage(message, accepted), false);
});

test('eye controller emits only normalized gaze and disposes camera and model on stop or disconnect', async () => {
  const { CreateEyeTrackingController } = await import('../runtime/eyeTrackingController.js');
  const fixture = Fixture(); const frames = []; const errors = [];
  const controller = CreateEyeTrackingController(fixture.env);
  assert.equal(await controller.Start(frame => frames.push(frame), reason => errors.push(reason)), true);
  await fixture.Tick(100);
  assert.deepEqual(frames, [{ timestamp: 100, x: .32, y: .24, faceDetected: true }]);
  assert.equal(JSON.stringify(frames).includes('image'), false);
  controller.Calibrate(.1, .9); assert.deepEqual(fixture.calibration, [100, 900]);
  fixture.disconnect();
  assert.deepEqual(errors, ['disconnected']);
  assert.equal(fixture.stops, 1); assert.equal(fixture.disposes, 1); assert.equal(fixture.frames.size, 0);
});

test('late camera and engine initialization cannot restart an exited eye session', async () => {
  const { CreateEyeTrackingController } = await import('../runtime/eyeTrackingController.js');
  for (const stage of ['camera', 'engine']) {
    const fixture = Fixture(); let resolve;
    const pending = new Promise(reply => { resolve = reply; });
    fixture.env[stage === 'camera' ? 'getUserMedia' : 'createEngine'] = () => pending;
    const controller = CreateEyeTrackingController(fixture.env);
    const started = controller.Start(assert.fail, assert.fail);
    await new Promise(reply => setImmediate(reply)); controller.Stop();
    resolve(stage === 'camera' ? fixture.stream : fixture.engine);
    assert.equal(await started, false);
    assert.equal(fixture.stops, 1); assert.equal(fixture.disposes, stage === 'engine' ? 1 : 0);
    assert.equal(fixture.frames.size, 0);
  }
});

function Fixture() {
  const fixture = { stops: 0, disposes: 0, frames: new Map(), calibration: null };
  const track = { stop: () => fixture.stops++, addEventListener: (_type, callback) => { fixture.disconnect = callback; } };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const engine = { Predict: async () => ({ x: 320, y: 240, image: 'private', eyeFeatures: [] }), FaceDetected: () => true,
    Calibrate: (x, y) => { fixture.calibration = [x, y]; }, Reset() {}, Dispose: () => fixture.disposes++ };
  let next = 0;
  Object.assign(fixture, { stream, engine, env: { getUserMedia: async () => stream, createEngine: async () => engine,
    requestFrame: callback => { fixture.frames.set(++next, callback); return next; }, cancelFrame: id => fixture.frames.delete(id) },
    Tick: async time => { const [id, callback] = fixture.frames.entries().next().value; fixture.frames.delete(id); await callback(time); } });
  return fixture;
}
