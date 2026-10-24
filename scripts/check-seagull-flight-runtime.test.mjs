import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as three from 'three';

const gameRoot = resolve(import.meta.dirname, '../apps/rehabtrainerhub/games/seagull-flight');
async function Load(path, dependencies = {}) {
  const module = {exports:{}};
  const code = ts.transpileModule(await readFile(resolve(gameRoot,path),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',code)(name=>{assert.ok(name in dependencies,name);return dependencies[name];},module,module.exports);
  return module.exports;
}
async function Callback(name, context) {
  const source = await readFile(resolve(gameRoot,'SeagullFlightGame.tsx'),'utf8');
  const tree = ts.createSourceFile('game.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let body;
  const visit = node => {if(ts.isVariableDeclaration(node) && node.name.getText(tree)===name) body=ts.isCallExpression(node.initializer) ? node.initializer.arguments[0].getText(tree) : node.initializer.getText(tree);ts.forEachChild(node,visit);};
  visit(tree);
  const code=ts.transpileModule(`const ${name} = ${body};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  return runInNewContext(`${code}\n${name}`,context);
}
async function Start(context) { return Callback('startTraining', context); }
function Deferred() { let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve}; }
function Context() {
  const actions=[];
  const context={phaseRef:{current:'rules'},generationRef:{current:0},sensorReadyRef:{current:true},settings:{inputMode:'head'},ValidateSettings:()=>true,labels:{},
    setPhase:phase=>{context.phaseRef.current=phase;actions.push(phase);},setError:error=>actions.push(error),setSensorReady:()=>{},StartSensorInput:async()=>{},
    PrepareAudioFeedback:()=>actions.push('audio'),RequestContainerFullscreen:async()=>true,ExitContainerFullscreen:async()=>actions.push('exit'),
    beginCalibration:()=>actions.push('calibration'),beginPlay:()=>actions.push('play'),showConfiguration:()=>actions.push('settings'),InputErrorMessage:()=> 'camera failure'};
  return {context,actions};
}
test('seagull: keyboard camera checks distinguish asset loads from device access and retain transient consent', async () => {
  const { KeyboardCameraProbe } = await import('./seagull-flight-browser.mjs');
  for (const standalone of [false, true]) {
    const selector = standalone ? '#camera-consent:not([hidden])' : '.training-overlay-camera-consent';
    const stream = {};
    const mediaDevices = { async getUserMedia() { assert.equal(this, mediaDevices); return stream; } };
    let notify;
    class Observer {
      constructor(callback) { notify = callback; }
      observe() {}
      disconnect() {}
    }
    const window = {};
    const document = { documentElement: {}, querySelector: () => null };
    runInNewContext(KeyboardCameraProbe(standalone), { window, navigator: { mediaDevices }, document, MutationObserver: Observer });
    assert.equal(window.seagullCameraCalls, 0);
    assert.equal(window.seagullCameraConsentSeen, false);
    notify([{ type: 'childList', addedNodes: [{ nodeType: 1, matches: () => false, querySelector: () => null }] }]);
    assert.equal(window.seagullCameraConsentSeen, false, 'Loading a proxy script does not show consent or open the camera.');
    assert.equal(await mediaDevices.getUserMedia({ video: true }), stream);
    assert.equal(window.seagullCameraCalls, 1, 'The wrapper counts calls and preserves the native receiver and return value.');
    const consent = { nodeType: 1, matches: value => value === selector, querySelector: () => null };
    notify([{ type: 'childList', addedNodes: [consent] }]);
    assert.equal(window.seagullCameraConsentSeen, true, 'A consent panel that is added then removed is still detected.');
    if (standalone) {
      window.seagullCameraConsentSeen = false;
      notify([{ type: 'attributes', attributeName: 'hidden', oldValue: null, target: { id: 'camera-consent' } }]);
      assert.equal(window.seagullCameraConsentSeen, true, 'Showing and hiding the existing standalone consent panel is still detected.');
    }
  }
});
test('seagull: cancelling a pending fullscreen handshake exits fullscreen without starting',async()=>{
  const {context,actions}=Context();const fullscreen=Deferred();context.RequestContainerFullscreen=()=>fullscreen.promise;
  const start=await Start(context);const starting=start();context.generationRef.current++;fullscreen.resolve(true);await starting;
  assert.deepEqual(actions,['audio','exit']);
});
test('seagull: a denied camera returns to settings with the mapped reason',async()=>{
  const {context,actions}=Context();context.sensorReadyRef.current=false;context.StartSensorInput=async()=>{throw Error('permission');};
  await (await Start(context))();assert.deepEqual(actions,['','initializing','camera failure','settings']);
});
test('seagull: repeated Start clicks during fullscreen cannot start two runs',async()=>{
  const {context,actions}=Context();const fullscreen=Deferred();context.RequestContainerFullscreen=()=>fullscreen.promise;
  const start=await Start(context);const first=start();const second=start();fullscreen.resolve(true);await Promise.all([first,second]);
  assert.equal(actions.filter(action=>action==='calibration').length,1);
});

test('seagull: the component subtracts neutral, forgets half nods after a lost or late frame, calibrates and maps proxy errors',async()=>{
  const filters=await Load('logic/oneEuroFilter.ts');
  const head=await Load('logic/headInput.ts',{'./oneEuroFilter':filters});
  const labels=(await Load('labels.ts')).copy.en;
  let now=0;let face=false;let error='';let started=0;
  const context={sensorReadyRef:{current:true},phaseRef:{current:'playing'},labelsRef:{current:labels},
    frameRef:{current:{head:null,receivedAt:-Infinity}},neutralRef:{current:{yaw:2,pitch:1}},
    smootherRef:{current:head.CreateHeadSmoother()},flapDetectorRef:{current:head.CreateFlapDetector(10)},flapRef:{current:false},
    performance:{now:()=>now},setFaceVisible:value=>{face=value;},setError:value=>{error=value;},
    InputErrorMessage:(failure,copy)=>copy.errors[failure.message],showConfiguration:()=>{context.phaseRef.current='menu';},
    calibrationRef:{current:head.CreateNeutralCalibration(0)},setCalibration(){},beginPlayRef:{current:()=>{started++;context.phaseRef.current='playing';}}};
  const receive=await Callback('receive',context);
  const deliver=(yaw,pitch,found=true)=>receive({detail:{type:'frame',payload:{timestamp:now,face:found,yaw,pitch}}});
  deliver(12,21);assert.equal(face,true);assert.deepEqual({...context.frameRef.current.head},{yaw:10,pitch:20});
  now=100;deliver(null,null,false);assert.equal(face,false);assert.equal(context.frameRef.current.head,null);
  now=200;deliver(2,-19);assert.equal(context.flapRef.current,false,'A lost face clears the first half nod.');
  now=600;deliver(2,21);assert.equal(context.flapRef.current,false,'A late frame starts a fresh nod.');
  context.phaseRef.current='calibration';
  for(now=0;now<=2100;now+=33) deliver(3,-2);
  assert.equal(started,1);assert.deepEqual({...context.neutralRef.current},{yaw:3,pitch:-2});
  receive({detail:{type:'error',payload:{reason:'disconnected'}}});
  assert.equal(error,labels.errors.disconnected);assert.equal(context.phaseRef.current,'menu');
  const previous=context.frameRef.current;now+=33;deliver(50,50);assert.equal(context.frameRef.current,previous,'A stopped run ignores late frames.');
  context.phaseRef.current='initializing';
  receive({detail:{type:'error',payload:{reason:'permission'}}});
  assert.equal(error,labels.errors.permission,'A camera error during the fullscreen handshake still returns to settings.');
  assert.equal(context.phaseRef.current,'menu');
});

test('seagull: 250 ms without a frame freezes play, a fresh frame resumes it, and no frames can time out calibration',async()=>{
  const logic=await Load('logic/flight.ts');
  const head=await Load('logic/headInput.ts',{'./oneEuroFilter':await Load('logic/oneEuroFilter.ts')});
  const config={headControl:true,durationSec:60,turnRangeDeg:20,nodRangeDeg:10,glideSec:10,ringIntervalSec:3};
  const session=logic.CreateFlightSession(config,()=>0.7);session.countdown=0;
  let calibration;
  const context={last:0,crashStarted:null,animation:0,phaseRef:{current:'playing'},sessionRef:{current:session},
    frameRef:{current:{head:{yaw:10,pitch:0},receivedAt:0}},flapRef:{current:true},keysRef:{current:new Set()},pointersRef:{current:new Map()},
    smootherRef:{current:head.CreateHeadSmoother()},flapDetectorRef:{current:head.CreateFlapDetector(10)},
    calibrationRef:{current:head.CreateNeutralCalibration(0)},setCalibration:value=>{calibration=value;},setFaceVisible(){},
    StepFlight:logic.StepFlight,HeadTargetX:head.HeadTargetX,PlaySuccessSound(){},PlayFailureSound(){},PlayGameEndSound(){},
    hudKeyRef:{current:''},setHud(){},scene:{update(){}},finishRef:{current:()=>assert.fail('A stale frame cannot finish a run.')},
    preview:session,requestAnimationFrame:()=>1};
  const tick=await Callback('tick',context);tick(300);
  assert.equal(session.frozen,true);assert.equal(session.elapsed,0);assert.equal(session.altitude,logic.flight.startAltitude);assert.equal(context.flapRef.current,false);
  context.frameRef.current.receivedAt=350;tick(350);assert.equal(session.frozen,false);assert.ok(session.elapsed>0);
  context.phaseRef.current='calibration';context.frameRef.current.receivedAt=0;tick(15100);assert.equal(calibration.status,'failed');
});

test('seagull: the real Three scene renders matching rings, symmetric flaps and a level fixation, and disposes every resource once',async()=>{
  const {flight,CreateFlightSession}=await Load('logic/flight.ts');
  let renderer;let rendered;let ratio;
  class Renderer {
    domElement={className:'',remove:()=>{this.removed=true;}};
    disposed=0;
    constructor(){renderer=this;}
    setPixelRatio(value){ratio=value;}
    setSize(){}
    render(scene,camera){scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);rendered={scene,camera};}
    dispose(){this.disposed++;}
  }
  const previousWindow=globalThis.window,previousStyle=globalThis.getComputedStyle;
  const motion={matches:true};
  globalThis.window={devicePixelRatio:3,matchMedia:()=>motion};
  globalThis.getComputedStyle=()=>({getPropertyValue:()=> 'white'});
  try {
    const {CreateSeagullScene}=await Load('scene.ts',{'three':{...three,WebGLRenderer:Renderer},'./logic/flight':{flight}});
    const host={clientWidth:1200,clientHeight:800,appendChild(){}};
    const scene=CreateSeagullScene({}, host);
    const session=CreateFlightSession({headControl:false,durationSec:60,turnRangeDeg:20,nodRangeDeg:10,glideSec:10,ringIntervalSec:3},()=>0.7);
    session.clock=0.13;session.lastFlapClock=0;scene.update(session,0.1);
    assert.equal(ratio,2);
    const {scene:world,camera}=rendered;
    const torus=[];const geometryDisposals=new Map(),materialDisposals=new Map();
    world.traverse(object=>{
      if(object.geometry?.type==='TorusGeometry') torus.push(object);
      if(object.geometry && !geometryDisposals.has(object.geometry)){geometryDisposals.set(object.geometry,0);object.geometry.addEventListener('dispose',()=>geometryDisposals.set(object.geometry,geometryDisposals.get(object.geometry)+1));}
      if(object.material && !materialDisposals.has(object.material)){materialDisposals.set(object.material,0);object.material.addEventListener('dispose',()=>materialDisposals.set(object.material,materialDisposals.get(object.material)+1));}
    });
    assert.ok(torus.length>0);assert.equal(torus[0].geometry.parameters.radius,flight.ringRadius*8);
    const gull=world.children.find(object=>object.type==='Group' && object.children.length===6);
    assert.ok(gull);
    const [left,right]=gull.children.slice(4);
    const leftTip=new three.Vector3(1.25,0,0).applyMatrix4(left.matrixWorld);
    const rightTip=new three.Vector3(1.25,0,0).applyMatrix4(right.matrixWorld);
    assert.ok(Math.abs(leftTip.y-rightTip.y)<1e-6,'Both wings flap together.');
    const fixation=world.children.find(object=>object.type==='Group' && object.children.length===4);
    assert.ok(fixation.quaternion.angleTo(camera.quaternion)<1e-6);
    const sea=world.children.find(object=>object.geometry?.getAttribute('position').count>1000);
    const original=Array.from(sea.geometry.getAttribute('position').array);
    scene.update(session,0.5);assert.deepEqual(Array.from(sea.geometry.getAttribute('position').array),original,'Reduced motion holds decorative waves.');
    motion.matches=false;scene.update(session,0.5);assert.notDeepEqual(Array.from(sea.geometry.getAttribute('position').array),original);
    session.crashed=true;scene.update(session,0.1);assert.equal(gull.visible,false);
    for(const [width,height] of [[360,800],[820,1180],[1280,720]]) {
      host.clientWidth=width;host.clientHeight=height;scene.resize();scene.update(session,0);
      for(const side of [-1,1]) {
        const edge=new three.Vector3(side*(1+flight.ringRadius)*8,flight.ringAltitude*8+0.4,0).project(camera);
        assert.ok(Math.abs(edge.x)<=0.95,`The full reachable ring stays visible at ${width} x ${height}: ${edge.x}`);
      }
    }
    scene.resize();scene.dispose();
    assert.ok([...geometryDisposals.values()].every(count=>count===1));
    assert.ok([...materialDisposals.values()].every(count=>count===1));
    assert.equal(renderer.disposed,1);assert.equal(renderer.removed,true);
  } finally {globalThis.window=previousWindow;globalThis.getComputedStyle=previousStyle;}
});
