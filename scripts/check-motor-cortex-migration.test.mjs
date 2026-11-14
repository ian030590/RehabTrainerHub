import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const gameRoot = resolve(root, 'apps/rehabtrainerhub/games/motor-cortex-rehab');
async function LoadModule(path) {
  const source = await readFile(resolve(gameRoot, path), 'utf8');
  const module = { exports: {} };
  new Function('module', 'exports', 'require', ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(module, module.exports, name => name === './gameUtils' ? { Clamp: (v, min, max) => Math.max(min, Math.min(max, v)) } : {});
  return module.exports;
}

test('tracking preserves four paths, successful and interrupted holds, hand loss, adaptation and timed completion', async () => {
  let engine;
  if (existsSync(resolve(gameRoot, 'engine.ts'))) engine = await LoadModule('engine.ts');
  else {
    const original = await readFile(resolve(gameRoot, 'MotorCortexRehabGame.tsx'), 'utf8');
    const source = original.slice(original.indexOf('function CreateEmptyMetrics'))
      + '\nexports.engine = {CreateEmptyMetrics,CreateInitialTarget,UpdateTrainingLoop,GetHandCursorPoint};';
    const module = { exports: {} };
    new Function('module','exports','Clamp','trackingGraceMs','handCursorRadius', ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText)(module,module.exports,(v,min,max)=>Math.max(min,Math.min(max,v)),240,18);
    engine = module.exports.engine;
  }
  const difficulty = { radius: 66, speed: 165, holdMs: 760 };
  for (const drill of ['bounce', 'vertical', 'horizontal', 'random']) {
    const target = engine.CreateInitialTarget(drill, difficulty, 1, 1, 900, 600);
    assert.equal(target.radius, 66);
    assert.equal(target.holdTargetMs, drill === 'random' ? 1000 : 760);
    if (drill === 'vertical') assert.equal(target.vx, 0);
    if (drill === 'horizontal') assert.equal(target.vy, 0);
    if (drill === 'random') assert.deepEqual([target.vx,target.vy], [0,0]);
  }
  const target = engine.CreateInitialTarget('random', difficulty, 1, 1, 900, 600);
  const metrics = engine.CreateEmptyMetrics(); metrics.startedAt = 100; metrics.lastTickAt = 100;
  let completed = 0;
  const tick = (now, visible = true) => engine.UpdateTrainingLoop({now,rect:{width:900,height:600},drill:'random',activeDifficulty:difficulty,
    durationSec:45,targetSizeScale:1,speedScale:1,target,hand:{x:target.x,y:target.y,visible,lastSeenAt:now},metrics,
    labels:{drillNames:{random:'Random targets'}},onSuccess(){},onComplete(){completed++;}});
  for (let now=190;now<=4690;now+=90) tick(now);
  assert.ok(metrics.successes >= 4);
  assert.equal(target.level, 2);
  assert.ok(target.radius < 66);
  for (let now=4780;now<=5050;now+=90) tick(now);
  tick(5140, false);
  assert.equal(metrics.events.at(-1).Result,'interrupted');
  assert.equal(metrics.currentHoldMs,0);
  const visibleMs = metrics.handVisibleMs; tick(5230,false); assert.equal(metrics.handVisibleMs,visibleMs);
  tick(45100); assert.equal(completed,1);
  assert.deepEqual(engine.GetHandCursorPoint(Array.from({length:21},()=>({x:.25,y:.4,z:0})),900,600),{x:675,y:240});
});

test('tracking configuration retains presets, bounds and hand selection', async () => {
  const { defaultConfig, IsMotorConfig } = await LoadModule('config.ts');
  assert.deepEqual(defaultConfig, {drill:'bounce',difficulty:'intermediate',durationSec:60,handChoice:'any',targetSizePercent:100,speedPercent:100,raiseLinePercent:65});
  assert.equal(IsMotorConfig(defaultConfig),true);
  for (const [key, values] of Object.entries({drill:['bounce','vertical','horizontal','random'],difficulty:['beginner','intermediate','advanced'],
    durationSec:[45,60,90],handChoice:['any','left','right'],targetSizePercent:[75,100,130],speedPercent:[70,100,140],raiseLinePercent:[50,65,80]})) {
    for (const value of values) assert.equal(IsMotorConfig({...defaultConfig,[key]:value}),true,`${key}: ${value}`);
  }
  for (const [key, values] of Object.entries({drill:['other'],difficulty:['medium'],durationSec:[0,46,Infinity],handChoice:['both'],
    targetSizePercent:[70,135,77,NaN],speedPercent:[65,145,72],raiseLinePercent:[49,51,64,66,79,81,65.5,'65',NaN,undefined]})) {
    for (const value of values) assert.equal(IsMotorConfig({...defaultConfig,[key]:value}),false,`${key}: ${value}`);
  }
});

test('saved settings predating the firing line keep their choices and restore the default line', async () => {
  const { defaultConfig, IsMotorConfig } = await LoadModule('config.ts');
  const { RestoreSettings } = await LoadModule('runtime/settingsMemory.ts');
  const old = { drill:'vertical',difficulty:'beginner',durationSec:45,handChoice:'left',targetSizePercent:125,speedPercent:70 };
  assert.deepEqual(RestoreSettings(old, defaultConfig, IsMotorConfig), { ...old, raiseLinePercent:65 });
  assert.equal(RestoreSettings({ ...old, raiseLinePercent:60 }, defaultConfig, IsMotorConfig), null);
});

test('each firing height gates the inclusive palm boundary, stale input and raised session time', async () => {
  const engine = await LoadModule('engine.ts');
  const rect = { width:900,height:600 };
  const difficulty = { radius:66,speed:165,holdMs:2000 };
  for (const raiseLinePercent of [50,65,80]) {
    const target = { ...engine.CreateInitialTarget('random', difficulty, 1, 1, 900, 600 * raiseLinePercent / 100), x:450,y:600 * raiseLinePercent / 100 - 70 };
    const enemy = { ...engine.CreateLaserEncounter(), spawnedAt:1, baseRadius:66 };
    const metrics = { ...engine.CreateEmptyMetrics(), startedAt:5000,lastTickAt:5000 };
    let now = 5000;
    const hand = { x:450,y:0,visible:true,lastSeenAt:now };
    const tick = (y, stale = false) => {
      now += 90; hand.y = y; hand.lastSeenAt = stale ? now - 241 : now;
      engine.UpdateLaserEncounter({ now,rect,drill:'random',activeDifficulty:difficulty,durationSec:45,targetSizeScale:1,speedScale:1,
        raiseLinePercent,target,hand,metrics,enemy,labels:{drillNames:{random:'Random'}},onSuccess(){},onComplete(){} });
      return engine.BuildLaserLiveState(now,45,rect,target,hand,metrics,enemy,raiseLinePercent);
    };
    const line = rect.height * raiseLinePercent / 100;
    assert.equal(tick(line).laserActive, true, 'A tracked palm on the line fires.');
    assert.equal(metrics.raisedMs, 90);
    assert.equal(tick(line + 1).laserActive, false, 'One pixel below the selected line stops firing.');
    assert.equal(metrics.currentHoldMs, 0);
    assert.equal(metrics.raisedMs, 90);
    assert.equal(tick(line - 10, true).laserActive, false);
    assert.equal(metrics.raisedMs, 90, 'Stale points cannot contribute raised time.');
    assert.equal(tick(line - 10).laserActive, true);
    assert.equal(metrics.raisedMs, 180);
    enemy.defeatedUntil = now + 400;
    assert.equal(tick(line - 10).laserActive, false);
    assert.equal(metrics.raisedMs, 270, 'Raised time also counts in the defeat window.');
  }
});

test('enemies enter from the horizon then follow their drill; the full sprite fits above each line after resize', async () => {
  const engine = await LoadModule('engine.ts');
  const difficulty = { radius:82,speed:120,holdMs:1500 };
  for (const raiseLinePercent of [50,65,80]) for (const drill of ['bounce','vertical','horizontal','random']) {
    let rect = { width:900,height:600 };
    const target = engine.CreateInitialTarget(drill,difficulty,1.3,.7,900,600 * raiseLinePercent / 100);
    const enemy = engine.CreateLaserEncounter();
    const metrics = engine.CreateEmptyMetrics();
    const tick = now => engine.UpdateLaserEncounter({ now,rect,drill,activeDifficulty:difficulty,durationSec:45,targetSizeScale:1.3,speedScale:.7,
      raiseLinePercent,target,enemy,metrics,hand:{x:0,y:0,visible:false,lastSeenAt:0},labels:{drillNames:{[drill]:drill}},onSuccess(){},onComplete(){} });
    tick(1000);
    assert.ok(Math.abs(target.x - 450) < 1, 'Each enemy starts at the central vanishing point.');
    assert.ok(target.y >= 600 * .12 && target.y <= 600 * .18, 'The approach starts on the horizon.');
    const start = { ...target };
    tick(1000 + 2100 / .7);
    assert.ok(target.radius > start.radius, 'The runner grows while approaching.');
    assert.ok(target.y > start.y, 'The runner travels down the road.');
    tick(1000 + 4200 / .7);
    const arrived = { ...target };
    metrics.lastTickAt = 7000; tick(7090);
    if (drill === 'random') assert.deepEqual([target.x,target.y],[arrived.x,arrived.y], 'Random stands at its chosen spot.');
    const padding=target.radius+Math.min(24,rect.width/12,rect.height*raiseLinePercent/1200);
    const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
    if (drill === 'vertical') {
      assert.ok(Math.abs(target.x-clamp(rect.width/2+Math.sin(7090*.0012)*rect.width*.08,padding,rect.width-padding))<1e-8);
      assert.notEqual(target.y,arrived.y);
    }
    if (drill === 'horizontal') {
      assert.ok(Math.abs(target.y-clamp(arrived.y+Math.sin(7090*.0012)*rect.height*raiseLinePercent/100*.08,padding,rect.height*raiseLinePercent/100-padding))<1e-8);
      assert.notEqual(target.x,arrived.x);
    }
    if (drill === 'bounce') { assert.notEqual(target.x,arrived.x); assert.notEqual(target.y,arrived.y); }
    for (const size of [[358,220],[640,130],[240,80]]) {
      rect = { width:size[0],height:size[1] }; tick(7180);
      assert.ok(target.x-target.radius >= 0 && target.x+target.radius <= rect.width, 'Full width fits.');
      assert.ok(target.y-target.radius >= 0 && target.y+target.radius <= rect.height*raiseLinePercent/100, 'Full enemy stays above the selected line.');
    }
  }
});

test('arrived patrols keep deterministic perpendicular sway around their own lanes and guide bounds', async () => {
  const engine=await LoadModule('engine.ts');
  const difficulty={radius:40,speed:120,holdMs:2000};
  for(const drill of ['vertical','horizontal']) {
    const target=engine.CreateInitialTarget(drill,difficulty,1,1,900,390);
    const enemy=engine.CreateLaserEncounter();const metrics=engine.CreateEmptyMetrics();
    let rect={width:900,height:600};
    const tick=now=>engine.UpdateLaserEncounter({now,rect,drill,activeDifficulty:difficulty,durationSec:45,targetSizeScale:1,speedScale:1,raiseLinePercent:65,
      target,enemy,metrics,hand:{x:0,y:0,visible:false,lastSeenAt:0},labels:{drillNames:{[drill]:drill}},onSuccess(){},onComplete(){}});
    tick(1000);tick(5200);
    const laneY=target.y;
    for(const now of [6000,7200,8800]) {
      tick(now);
      if(drill==='vertical') assert.ok(Math.abs(target.x-(450+Math.sin(now*.0012)*72))<1e-8,'Vertical sway uses the supplied frame time.');
      else {
        assert.ok(Math.abs(target.y-(laneY+Math.sin(now*.0012)*31.2))<1e-8,'Horizontal sway stays centred on arrival, without accumulating drift.');
        const live=engine.BuildLaserLiveState(now,45,rect,target,{x:0,y:0,visible:false,lastSeenAt:0},metrics,enemy,65);
        assert.ok(Math.abs(live.patrolY-laneY/600*100)<1e-8,'The guide follows the actual centre lane.');
      }
    }
    if(drill==='horizontal') {
      rect={width:900,height:400};const now=7*Math.PI/2/.0012;tick(now);
      const arenaHeight=rect.height*.65,padding=target.radius+Math.min(24,rect.width/12,arenaHeight/12);
      const centre=Math.max(padding,Math.min(arenaHeight-padding,laneY));
      assert.ok(Math.abs(target.y-(centre-arenaHeight*.08))<1e-8,'A resized lane is clamped before sway, preserving available movement.');
    }
    rect={width:358,height:130};tick(10000);
    assert.ok(target.x-target.radius>=0&&target.x+target.radius<=rect.width);
    assert.ok(target.y-target.radius>=0&&target.y+target.radius<=rect.height*.65,'Sway never crosses the firing line after resize.');
  }
});

test('approaching runners can be defeated and the next runner starts only after the 400 ms feedback window', async () => {
  const engine = await LoadModule('engine.ts');
  const difficulty = { radius:66,speed:165,holdMs:1500 };
  const target = engine.CreateInitialTarget('random',difficulty,1,1,900,390);
  const enemy = engine.CreateLaserEncounter();
  const metrics = engine.CreateEmptyMetrics();
  const tick = now => {
    const hand = {x:target.x,y:target.y,visible:true,lastSeenAt:now};
    engine.UpdateLaserEncounter({now,rect:{width:900,height:600},drill:'random',activeDifficulty:difficulty,durationSec:45,
      targetSizeScale:1,speedScale:1,raiseLinePercent:65,target,hand,metrics,enemy,labels:{drillNames:{random:'Random'}},onSuccess(){},onComplete(){}});
  };
  tick(1000);
  for (let now=1090;now<=2890;now+=90) tick(now);
  assert.equal(metrics.successes,1,'A continuous hit during the approach defeats the runner.');
  assert.equal(enemy.arrived,false);
  const defeatedAt = enemy.defeatedUntil-400;
  for(const [elapsed,frame] of [[0,0],[80,1],[160,2],[240,3],[320,4]]) {
    const live=engine.BuildLaserLiveState(defeatedAt+elapsed,45,{width:900,height:600},target,{x:0,y:0,visible:false,lastSeenAt:0},metrics,enemy,65);
    assert.equal(live.defeatFrame,frame); assert.equal(live.laserActive,false);
  }
  tick(enemy.defeatedUntil-1); assert.equal(enemy.number,1); assert.equal(metrics.successes,1);
  tick(enemy.defeatedUntil);
  assert.equal(enemy.number,2); assert.equal(target.x,450); assert.equal(target.y,90); assert.equal(metrics.successes,1);
});

test('raised time includes the frame where a defeated enemy is replaced without carrying hold damage', async () => {
  const engine=await LoadModule('engine.ts');
  const difficulty={radius:66,speed:165,holdMs:2000};
  const target=engine.CreateInitialTarget('random',difficulty,1,1,900,390);
  const enemy={...engine.CreateLaserEncounter(),spawnedAt:1000,baseRadius:66,defeatedUntil:10000};
  const metrics={...engine.CreateEmptyMetrics(),startedAt:1000,lastTickAt:9910,raisedMs:8000,handVisibleMs:8000};
  engine.UpdateLaserEncounter({now:10000,rect:{width:900,height:600},drill:'random',activeDifficulty:difficulty,durationSec:45,
    raiseLinePercent:65,targetSizeScale:1,speedScale:1,target,enemy,metrics,hand:{x:450,y:90,visible:true,lastSeenAt:10000},
    labels:{drillNames:{random:'Random'}},onSuccess(){},onComplete(){}});
  assert.equal(metrics.raisedMs,8090);
  assert.equal(metrics.handVisibleMs,8090);
  assert.equal(metrics.currentHoldMs,0,'The new runner gets no damage from the defeat interval.');
});

test('laser difficulty requires a steady 1.5 to 2.5 second aim, including after adaptation', async () => {
  const { difficulties } = await LoadModule('config.ts');
  const engine = await LoadModule('engine.ts');
  assert.deepEqual(difficulties.map(item => item.holdMs), [1500, 2000, 2500]);
  for (const difficulty of difficulties) {
    const target = engine.CreateInitialTarget('bounce', difficulty, 1, 1, 900, 480);
    engine.AdaptTarget(target, difficulty, 1, 1, { ...engine.CreateEmptyMetrics(), streak: 4, handVisibleMs: 1000, inTargetMs: 1000 });
    assert.ok(target.holdTargetMs >= difficulty.holdMs, 'Adaptive enemies keep the selected minimum hold.');
  }
});

test('laser enemies require a raised hand and a continuous hold; one defeat scores once before the next enemy', async () => {
  const engine = await LoadModule('engine.ts');
  const difficulty = { radius: 66, speed: 165, holdMs: 760 };
  const target = engine.CreateInitialTarget('random', difficulty, 1, 1, 900, 480);
  const enemy = { ...engine.CreateLaserEncounter(), spawnedAt:-10000, arrived:true };
  const metrics = { ...engine.CreateEmptyMetrics(), startedAt: 1000, lastTickAt: 1000 };
  let now = 1000, completed = 0, kills = 0;
  const tick = ({ raised = true, hit = true, visible = true, stale = false } = {}) => {
    now += 90;
    target.x = 450; target.y = raised ? 200 : 550;
    engine.UpdateLaserEncounter({ now, rect: { width: 900, height: 600 }, drill: 'random', activeDifficulty: difficulty,
      durationSec: 45, targetSizeScale: 1, speedScale: 1, target, enemy, metrics,
      hand: { x: hit ? target.x : 0, y: target.y, visible, lastSeenAt: stale ? now - 300 : now },
      labels: { drillNames: { random: 'Random targets' } }, onSuccess() { kills++; }, onComplete() { completed++; } });
  };
  for (let index = 0; index < 16; index++) tick({ raised: false });
  assert.equal(metrics.successes, 0, 'An on-target lowered hand cannot deal damage.');
  assert.ok(metrics.handVisibleMs > 0, 'A lowered but tracked hand still counts as visible.');
  for (let index = 0; index < 5; index++) tick();
  assert.ok(metrics.currentHoldMs > 0);
  tick({ hit: false });
  assert.equal(metrics.currentHoldMs, 0, 'Moving off the enemy resets the continuous hold.');
  assert.equal(metrics.events.at(-1).Result, 'interrupted');
  for (let index = 0; index < 5; index++) tick();
  tick({ stale: true });
  assert.equal(metrics.currentHoldMs, 0, 'A stale sensor frame cannot keep the laser locked.');
  assert.equal(metrics.successes, 0, 'Separate short holds cannot add up to a kill.');
  for (let index = 0; index < 4; index++) tick();
  now += 1000; tick();
  assert.equal(metrics.currentHoldMs, 0, 'Returning after a background gap starts a new continuous hold.');
  for (let index = 0; index < 12; index++) tick();
  assert.equal(metrics.successes, 1);
  assert.equal(kills, 1);
  assert.equal(enemy.number, 1);
  assert.ok(enemy.defeatedUntil > now);
  for (let index = 0; index < 3; index++) tick();
  assert.equal(metrics.successes, 1, 'The dissolving enemy cannot score twice.');
  assert.equal(enemy.number, 1, 'The next enemy waits for the defeat animation.');
  for (let index = 0; index < 3; index++) tick({ visible: false });
  assert.equal(enemy.number, 2);
  assert.equal(metrics.currentHoldMs, 0);
  now = 45950; tick();
  assert.equal(completed, 1);
});

test('the approaching enemy remains inside a small or resized play field', async () => {
  const engine = await LoadModule('engine.ts');
  const difficulty = { radius: 82, speed: 120, holdMs: 560 };
  const target = engine.CreateInitialTarget('bounce', difficulty, 1.3, .7, 900, 480);
  const enemy = { ...engine.CreateLaserEncounter(), spawnedAt: 1000, baseRadius: target.radius };
  const metrics = { ...engine.CreateEmptyMetrics(), startedAt: 1000, lastTickAt: 5990 };
  for (const [width, height] of [[900,600],[358,220],[640,130]]) {
    engine.UpdateLaserEncounter({ now: 6000, rect: { width, height }, drill: 'bounce', activeDifficulty: difficulty,
      durationSec: 45, targetSizeScale: 1.3, speedScale: .7, target, enemy, metrics,
      hand: { x: 0, y: height, visible: false, lastSeenAt: 0 }, labels: { drillNames: { bounce: 'Roaming' } }, onSuccess() {}, onComplete() {} });
    assert.ok(target.x - target.radius >= 0 && target.x + target.radius <= width, 'The whole enemy fits horizontally.');
    assert.ok(target.y - target.radius >= 0 && target.y + target.radius <= height, 'The whole enemy fits vertically.');
  }
});

test('laser presentation stops firing for a lowered or stale hand and while the enemy dissolves', async () => {
  const engine = await LoadModule('engine.ts');
  const metrics = { ...engine.CreateEmptyMetrics(), startedAt: 1000 };
  const target = engine.CreateInitialTarget('random', { radius: 66, speed: 165, holdMs: 760 }, 1, 1, 900, 480);
  target.x = 450; target.y = 200;
  const enemy = { ...engine.CreateLaserEncounter(), spawnedAt: 1000 };
  const hand = { x: 450, y: 200, visible: true, lastSeenAt: 2000 };
  const state = () => engine.BuildLaserLiveState(2000, 45, { width: 900, height: 600 }, target, hand, metrics, enemy);
  assert.equal(state().laserActive, true);
  assert.equal(state().insideTarget, true);
  hand.y = 550;
  assert.equal(state().laserActive, false);
  hand.y = 200; hand.lastSeenAt = 1700;
  assert.equal(state().laserActive, false);
  hand.lastSeenAt = 2000; enemy.defeatedUntil = 2200;
  assert.equal(state().enemyPhase, 'defeated');
  assert.equal(state().insideTarget, false);
  assert.equal(state().laserActive, false);
});

test('laser audio stops on lowered hands and cancellation, including a late play promise', async () => {
  const { CreateLaserAudio } = await LoadModule('runtime/laserAudio.ts');
  const samples = [];
  let finishPlay;
  const audio = CreateLaserAudio(url => {
    const sample = { src: url, paused: true, currentTime: 0, plays: 0, loop: false,
      play() { this.plays++; return new Promise(done => { finishPlay = () => { this.paused = false; done(); }; }); },
      pause() { this.paused = true; }, removeAttribute() { this.src = ''; }, load() {} };
    samples.push(sample); return sample;
  });
  audio.setFiring(true);
  assert.equal(samples[0].loop, true);
  audio.setFiring(false);
  finishPlay(); await new Promise(done => setImmediate(done));
  assert.equal(samples[0].paused, true, 'A delayed play cannot restart a lowered hand laser.');
  audio.playHit();
  audio.dispose();
  finishPlay(); await new Promise(done => setImmediate(done));
  assert.ok(samples.every(sample => sample.paused && !sample.src), 'Exit releases all samples.');
  const count = samples.reduce((sum, sample) => sum + sample.plays, 0);
  audio.setFiring(true); audio.playHit(); audio.playComplete();
  assert.equal(samples.reduce((sum, sample) => sum + sample.plays, 0), count, 'Disposed audio cannot restart.');
});

test('laser audio switches between firing and rising charge, and every stop defeats late plays', async () => {
  const { CreateLaserAudio } = await LoadModule('runtime/laserAudio.ts');
  const samples = [];
  const audio = CreateLaserAudio(url => {
    const sample = { src:url,paused:true,currentTime:0,playbackRate:1,preservesPitch:true,pending:[],plays:0,
      play() { this.plays++; return new Promise(done => this.pending.push(() => { this.paused=false; done(); })); },
      pause() { this.paused=true; }, removeAttribute() { this.src=''; }, load() {} };
    samples.push(sample); return sample;
  });
  const settle = async () => { for (const sample of samples) sample.pending.splice(0).forEach(done=>done()); await new Promise(done=>setImmediate(done)); };
  const laser = samples.find(sample=>sample.src.endsWith('/laser.ogg'));
  const charge = samples.find(sample=>sample.src.endsWith('/charge.ogg'));
  assert.ok(charge, 'A separate charge sample is packaged.');
  audio.setFiring(true); await settle();
  assert.equal(laser.paused,false); assert.equal(charge.paused,true);
  audio.setFiring(true,true,0); await settle();
  assert.equal(laser.paused,true); assert.equal(charge.paused,false); assert.equal(charge.loop,true);
  assert.equal(charge.playbackRate,1); assert.equal(charge.preservesPitch,false);
  audio.setFiring(true,true,.5); assert.equal(charge.playbackRate,1.3);
  audio.setFiring(true,true,1); assert.equal(charge.playbackRate,1.6);
  audio.setFiring(true,false); await settle();
  assert.equal(laser.paused,false); assert.equal(charge.paused,true);
  for (const stop of [()=>audio.setFiring(false),()=>audio.stop()]) {
    audio.setFiring(false); audio.setFiring(true,true,.4); stop(); await settle();
    assert.ok(samples.every(sample=>sample.paused), 'Lowered/stale/hidden/cancelled activity cannot restart charge.');
  }
  audio.setFiring(true,true,.9); audio.playHit(); audio.stop(); await settle();
  assert.ok(samples.every(sample=>sample.paused), 'A stop also cancels late defeat feedback.');
  audio.playComplete(); audio.stop(); await settle();
  assert.ok(samples.every(sample=>sample.paused), 'A hidden page or exit also stops completion audio.');
  audio.setFiring(true,true,.9); audio.dispose(); await settle();
  assert.ok(samples.every(sample=>sample.paused&&!sample.src));
});

test('firing height appears in settings, confirmation and results; real scene uses the palm beam and cues', async () => {
  const config = await LoadModule('config.ts');
  const labels = await LoadModule('labels.ts');
  const engine = await LoadModule('engine.ts');
  const source = await readFile(resolve(gameRoot,'MotorCortexRehabGame.tsx'),'utf8');
  const gameUtils=await LoadModule('gameUtils.ts');
  for (const language of ['zh','en']) for (const phase of ['menu','ready','playing','results']) {
    const result = { Event_Records:[],Raised_Percent:37.5,Raise_Line_Percent:50 };
    const live = { timeRemaining:45,accuracy:0,visibility:1,successes:1,level:1,currentHoldPercent:.5,targetX:40,targetY:25,
      targetRadius:40,handX:60,handY:60,handVisible:true,handRaised:false,laserActive:false,insideTarget:false,enemyPhase:'active',enemyNumber:2,enemyMoving:true,enemyFacingLeft:false,defeatFrame:0,interrupted:true };
    const jsx = (type,props) => ({type,props});
    const updates=[];
    let refsCreated=0;
    const hooks = { useState: value => [value==='menu'?phase:value===null?result:typeof value==='object'&&'drill' in value?{...config.defaultConfig,raiseLinePercent:50}:typeof value==='object'&&'timeRemaining' in value?live:value,value=>updates.push(value)],
      useRef: value => ({ current:refsCreated++===1?{clientWidth:358,clientHeight:130}:value }),useCallback: value=>value,useEffect(){} };
    const module = {exports:{}};
    new Function('module','exports','require',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(module,module.exports,name=>({
      react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},'./config':config,'./engine':engine,'./labels':labels,'./gameUtils':gameUtils,
      './i18n/useT':{useT:()=>({lang:language})},'./runtime/hubBridge':{IsHubGame:()=>false},'./score':{BuildGameScore:()=>({rounds:[]})},
    }[name]??{}));
    const tree = module.exports.MotorCortexRehabGame({onExit(){}});
    const nodes=[]; const walk=node=>{ if(!node||typeof node!=='object')return; if(Array.isArray(node)){node.forEach(walk);return;} nodes.push(node);walk(node.props?.children); }; walk(tree);
    const textOf = node => Array.isArray(node)?node.map(textOf).join(' '):node&&typeof node==='object'?textOf(node.props?.children):String(node??'');
    if (phase==='menu') {
      const radius=Number.parseFloat(tree.props.style['--motor-target-size'])/2;
      const centre=Number.parseFloat(tree.props.style['--motor-target-y'])/100*130;
      assert.ok(centre-radius>=0&&centre+radius<=65,'The full tutorial enemy also fits above a high line in a short landscape stage.');
      const select=nodes.find(node=>node.type==='select'&&node.props.name==='raiseLinePercent');
      assert.ok(select,'Firing height is a real select.');
      assert.equal(select.props.value,50);
      assert.deepEqual(select.props.children.map(option=>option.props.value),[80,65,50]);
      select.props.onChange({target:{value:'80'}});
      assert.deepEqual(updates.at(-1),{...config.defaultConfig,raiseLinePercent:80},'The control updates the selected line and keeps other settings.');
      assert.match(textOf(tree),language==='en'?/joint angle/:/關節角度/);
    }
    if (phase==='playing') {
      assert.ok(nodes.some(node=>node.props?.className?.includes('motor-firing-line')),'The line is in the actual scene.');
      assert.match(textOf(tree),language==='en'?/Raise a little higher/:/再舉高一點/);
      assert.match(textOf(tree),language==='en'?/Interrupted, aim again/:/中斷，重新瞄準/);
      const line=nodes.find(node=>node.type==='line'&&node.props.className==='motor-laser-edge');
      assert.notEqual(line.props.x1,50,'The beam follows the foreground glove horizontally.');
      assert.ok(Number(line.props.y1)>50,'The source palm is below the selected line.');
    }
    if (phase==='ready') {
      assert.match(textOf(tree),language==='en'?/Firing line height/:/發射高度線/);
      assert.match(textOf(tree),language==='en'?/High \(50%\)/:/高（50%）/);
    }
    if (phase==='results') {
      assert.match(textOf(tree),/37\.5%/,'Raised time is shown as a percentage.');
      assert.match(textOf(tree),language==='en'?/Time above the line/:/舉手過線時間/);
      assert.match(textOf(tree),language==='en'?/Firing line height/:/發射高度線/);
    }
  }
});

test('the camera preview draws the selected line and emphasises a palm below it', async () => {
  const source=await readFile(resolve(gameRoot,'MotorCortexRehabGame.tsx'),'utf8');
  const tree=ts.createSourceFile('game.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const draw=tree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='DrawHand');
  const engine=await LoadModule('engine.ts');
  const strokes=[];
  const context={clearRect(){},beginPath(){this.path=[];},moveTo(x,y){this.path.push([x,y]);},lineTo(x,y){this.path.push([x,y]);},arc(){},fill(){},setLineDash(value){this.dash=value;},
    stroke(){strokes.push({path:this.path,dash:this.dash,width:this.lineWidth,color:this.strokeStyle});}};
  const canvas={width:320,height:240,getContext:()=>context};
  const run=new Function('GetHandCursorPoint','getComputedStyle',`${ts.transpileModule(draw.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText};return DrawHand;`)(engine.GetHandCursorPoint,()=>({getPropertyValue:key=>key}));
  for(const height of [50,65,80]) for(const y of [.1,.9]) {
    run(canvas,Array.from({length:21},()=>({x:.5,y})),height);
    assert.deepEqual(strokes.at(-1).path,[[0,240*height/100],[320,240*height/100]]);
    assert.deepEqual(strokes.at(-1).dash,[8,6]);
    assert.equal(strokes.at(-1).width,y===.9?4:2);
  }
});

test('playing loops stop on lowered or stale input; hidden pages still stop all audio', async () => {
  const source=await readFile(resolve(gameRoot,'MotorCortexRehabGame.tsx'),'utf8');
  const tree=ts.createSourceFile('game.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let effect;
  const visit=node=>{if(ts.isCallExpression(node)&&node.expression.getText(tree)==='useEffect'&&/setFiring/.test(node.arguments[0]?.getText(tree))) effect=node.arguments[0];ts.forEachChild(node,visit);};visit(tree);
  const create=new Function('phase','live','handRef','stageRef','config','laserAudioRef','document','window','performance',`return (${ts.transpileModule(effect.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText.trim().replace(/;$/, '')});`);
  for(const phase of ['playing','results']) {
    const calls=[];const listeners=new Map();let interval=null;
    const hand={x:400,y:200,visible:true,lastSeenAt:1000};const document={hidden:false,addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key)};
    const run=create(phase,{laserActive:true,insideTarget:true,currentHoldPercent:.5},{current:hand},{current:{clientHeight:600}},{raiseLinePercent:50},
      {current:{stop:()=>calls.push('stop'),setFiring:(...values)=>calls.push(values)}},document,{setInterval:fn=>{interval=fn;return 1;},clearInterval:()=>{interval=null;}},{now:()=>1000});
    const dispose=run();
    if(phase==='playing') {
      assert.deepEqual(calls.at(-1),[true,true,.5]);
      hand.y=301; interval(); assert.deepEqual(calls.at(-1),[false]);
      hand.y=200;hand.lastSeenAt=759; interval();assert.deepEqual(calls.at(-1),[false]);
    }
    document.hidden=true;listeners.get('visibilitychange')();assert.equal(calls.at(-1),'stop');
    dispose(); assert.equal(listeners.size,0);assert.equal(interval,null);
  }
});

test('lowered or stale hands preserve a playing defeat one-shot while both loops stay paused', async () => {
  const {CreateLaserAudio}=await LoadModule('runtime/laserAudio.ts');
  const source=await readFile(resolve(gameRoot,'MotorCortexRehabGame.tsx'),'utf8');
  const tree=ts.createSourceFile('game.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let effect;const visit=node=>{if(ts.isCallExpression(node)&&node.expression.getText(tree)==='useEffect'&&/setFiring/.test(node.arguments[0]?.getText(tree)))effect=node.arguments[0];ts.forEachChild(node,visit);};visit(tree);
  const create=new Function('phase','live','handRef','stageRef','config','laserAudioRef','document','window','performance',`return (${ts.transpileModule(effect.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText.trim().replace(/;$/, '')});`);
  for(const reason of ['lowered','stale','missing']) {
    const samples=[];const audio=CreateLaserAudio(src=>{
      const sample={src,paused:true,currentTime:0,play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;},removeAttribute(){},load(){}};
      samples.push(sample);return sample;
    });
    audio.setFiring(true,true,.5);await new Promise(done=>setImmediate(done));
    audio.playHit();await new Promise(done=>setImmediate(done));
    const hit=samples.find(sample=>sample.src.endsWith('/hit.ogg'));hit.currentTime=.3;
    const listeners=new Map();let interval;
    const hand={visible:true,y:200,lastSeenAt:1000};const document={hidden:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
    const dispose=create('playing',{laserActive:false,insideTarget:false,currentHoldPercent:0},{current:hand},{current:{clientHeight:600}},{raiseLinePercent:65},{current:audio},document,
      {setInterval:fn=>{interval=fn;return 1;},clearInterval(){}},{now:()=>1000})();
    if(reason==='lowered')hand.y=500;if(reason==='stale')hand.lastSeenAt=759;if(reason==='missing')hand.visible=false;
    interval();await new Promise(done=>setImmediate(done));
    assert.equal(hit.paused,false,`${reason} input must not cut off hit.ogg.`);
    assert.equal(hit.currentTime,.3,'The one-shot must not rewind.');
    assert.ok(samples.filter(sample=>sample.loop).every(sample=>sample.paused),'Both firing and charge loops are silent.');
    document.hidden=true;listeners.get('visibilitychange')();
    assert.ok(samples.every(sample=>sample.paused),'A hidden page still stops every sample.');
    dispose();audio.dispose();
  }
});

test('skyline repeats buildings at one pixel scale to cover phone, tablet and desktop horizons', async () => {
  for(const [width,height] of [[358,420],[788,840],[1282,440],[640,130]]) {
    const {tree,nodes}=await RenderMotorScene({width,height});
    const size=Number.parseFloat(tree.props.style['--motor-building-size']);
    const skyline=nodes.find(node=>node.props?.className==='motor-skyline');
    assert.ok(Number.isFinite(size)&&size>=16&&size%16===0,'Every building uses the same integer tile scale.');
    const buildings=skyline.props.children;
    assert.ok(buildings.length*size>=width,'Repeated tiles fill the complete horizon.');
    assert.ok(buildings.every(node=>node.type==='img'&&node.props.src.startsWith('./assets/laser-hero/building-')));
  }
  const css=await readFile(resolve(gameRoot,'game.css'),'utf8');
  assert.match(css,/\.motor-skyline\s*\{[^}]*overflow:\s*hidden/);
  assert.match(css,/\.motor-skyline img\s*\{[^}]*width:\s*var\(--motor-building-size\)/);
  assert.match(css,/\.motor-skyline\s*\{[^}]*gap:\s*0/);
});

test('patrol guides follow the arrival lane and keep the vertical guide below the skyline', async () => {
  const {tree}=await RenderMotorScene({phase:'playing',live:{patrolY:58,targetY:61}});
  assert.equal(tree.props.style['--motor-patrol-y'],'58%');
  const css=await readFile(resolve(gameRoot,'game.css'),'utf8');
  assert.match(css,/\.motor-cortex-path-horizontal\s*\{[^}]*top:\s*var\(--motor-patrol-y\)/);
  assert.match(css,/\.motor-cortex-path-vertical\s*\{[^}]*top:\s*15%/);
  assert.match(css,/\.motor-cortex-path-vertical\s*\{[^}]*height:\s*calc\(var\(--motor-raise-line\)\s*-\s*15%\)/);
});

test('raise prompts stay above the reticle, inside the stage and clear of camera/Stop', async () => {
  for(const [width,height] of [[358,420],[788,840],[1282,440],[640,130]]) for(const language of ['zh','en']) for(const handX of [0,50,100]) {
    const obstacles={'.motor-cortex-camera':{left:0,top:height-48,right:168,bottom:height+96},'.motor-exit-button':{left:width-90,top:height-32,right:width,bottom:height+20}};
    const {tree,nodes}=await RenderMotorScene({width,height,language,phase:'playing',obstacles,live:{handVisible:true,handRaised:false,handX,handY:99}});
    const label=nodes.find(node=>String(node.props?.className).includes('motor-aim-label'));
    assert.equal(label.props.role,'status');assert.ok(label.props.className.includes('needs-raise'),'The live announcement follows the reticle.');
    const x=Number.parseFloat(tree.props.style['--motor-prompt-x']),y=Number.parseFloat(tree.props.style['--motor-prompt-y']);
    const w=Number.parseFloat(tree.props.style['--motor-prompt-width']);
    assert.ok(x-w/2>=8&&x+w/2<=width-8&&y>=8&&y+24<=height-8,'The prompt is clamped inside the stage.');
    assert.ok(y+24<=height*.99-18,'The prompt stays above the reticle.');
    for(const obstacle of Object.values(obstacles))assert.equal(x-w/2<obstacle.right&&x+w/2>obstacle.left&&y<obstacle.bottom&&y+24>obstacle.top,false,'Camera and Stop never cover the cue.');
  }
});

test('tutorial enemy and its health bar clear the title on the road when they fit; short stages keep fitting', async () => {
  const {tree}=await RenderMotorScene({width:358,height:390,phase:'rules',settings:{raiseLinePercent:65,targetSizePercent:130},titleBottom:48});
  const radius=Number.parseFloat(tree.props.style['--motor-target-size'])/2;
  const centre=Number.parseFloat(tree.props.style['--motor-target-y'])/100*390;
  assert.ok(centre-radius-10>=56,'The health bar sits below the title with a gap.');
  assert.ok(centre>=390*.15&&centre+radius<=390*.65,'The preview is on the road above the line.');
  const short=await RenderMotorScene({width:358,height:130,phase:'rules',settings:{raiseLinePercent:50}});
  assert.equal(Number.parseFloat(short.tree.props.style['--motor-target-y']),25,'An impossible title fit keeps the existing centre.');
  assert.ok(Number.parseFloat(short.tree.props.style['--motor-target-size'])<=65);
});

async function RenderMotorScene({width=900,height=600,language='zh',phase='menu',settings={},live={},obstacles={},titleBottom=40}={}) {
  const config=await LoadModule('config.ts'),labels=await LoadModule('labels.ts'),engine=await LoadModule('engine.ts'),gameUtils=await LoadModule('gameUtils.ts');
  const source=await readFile(resolve(gameRoot,'MotorCortexRehabGame.tsx'),'utf8');
  const jsx=(type,props)=>({type,props});let refsCreated=0;
  const stage={clientWidth:width,clientHeight:height,clientTop:0,clientLeft:0,getBoundingClientRect:()=>({left:0,top:0,width,height,right:width,bottom:height})};
  const root={querySelector:selector=>selector==='.motor-mission-title'?{getBoundingClientRect:()=>({bottom:titleBottom})}:obstacles[selector]?{getBoundingClientRect:()=>obstacles[selector]}:null};
  const hooks={useState:value=>[value==='menu'?phase:value&&typeof value==='object'&&'drill' in value?{...config.defaultConfig,...settings}:value&&typeof value==='object'&&'timeRemaining' in value?{...value,...live}:value,()=>{}],
    useRef:value=>({current:refsCreated++===0?root:refsCreated===2?stage:value}),useCallback:value=>value,useEffect(){}};
  const module={exports:{}};
  new Function('module','exports','require',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(module,module.exports,name=>({
    react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},'./config':config,'./engine':engine,'./labels':labels,'./gameUtils':gameUtils,'./i18n/useT':{useT:()=>({lang:language})},'./runtime/hubBridge':{IsHubGame:()=>false},
  }[name]??{}));
  const tree=module.exports.MotorCortexRehabGame({onExit(){}}),nodes=[];
  const walk=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(walk);return;}nodes.push(node);walk(node.props?.children);};walk(tree);
  return {tree,nodes};
}

test('pixel hero art and sound are packaged CC0 files with verified source hashes', async () => {
  const directory = resolve(gameRoot, 'public/assets/laser-hero');
  const sources = JSON.parse(await readFile(resolve(directory, 'SOURCES.json'), 'utf8'));
  const shipped = ['hero-glove.png','reticle.png','laser.ogg','charge.ogg','hit.ogg','complete.ogg','smoke.png',
    ...Array.from({length:4},(_,index)=>`burst-${index}.png`),...Array.from({length:4},(_,index)=>`building-${index}.png`),
    ...Array.from({length:4},(_,index)=>[`enemy-${index}.png`,`enemy-${index}-step.png`]).flat()].sort();
  assert.deepEqual(sources.map(item => item.file).sort(),shipped);
  assert.deepEqual((await readdir(directory)).filter(file=>!['SOURCES.json','LICENSES.txt'].includes(file)).sort(),shipped,'No unused assets ship.');
  for (const source of sources) {
    assert.equal(source.license, 'CC0-1.0');
    assert.equal(new URL(source.source).origin, 'https://kenney.nl');
    const bytes = await readFile(resolve(directory, source.file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256);
    assert.equal(bytes.subarray(0, 4).toString(source.file.endsWith('.png') ? 'hex' : 'ascii'), source.file.endsWith('.png') ? '89504e47' : 'OggS');
  }
  assert.match(sources.find(item=>item.file==='hero-glove.png').modification,/red.*gold/i);
  assert.equal(sources.find(item=>item.file==='hero-glove.png').original,'Tiles/tile_0138.png');
  assert.equal(sources.find(item=>item.file==='charge.ogg').original,'Audio/forceField_001.ogg');
  assert.equal(sources.find(item=>item.file==='complete.ogg').original,'Audio/powerUp3.ogg');
  for (const [index,tile] of [0,6,15,21].entries()) {
    assert.equal(sources.find(item=>item.file===`enemy-${index}.png`).original,`Tiles/Characters/tile_${String(tile).padStart(4,'0')}.png`);
    assert.equal(sources.find(item=>item.file===`enemy-${index}-step.png`).original,`Tiles/Characters/tile_${String(tile+1).padStart(4,'0')}.png`);
  }
  assert.match(await readFile(resolve(directory, 'LICENSES.txt'), 'utf8'), /Creative Commons Zero, CC0/);
});

test('tracking is self-contained with private input, own modal and real-scene spotlight, full results and original preview', async () => {
  const packageJson = JSON.parse(await readFile(resolve(gameRoot,'package.json'),'utf8'));
  assert.equal(packageJson.version,'2.1.0');
  assert.deepEqual(Object.keys(packageJson.dependencies).sort(),['jspsych','react','react-dom','tone']);
  assert.ok(packageJson.rehabTrainer.capabilities.includes('hand-tracking'));
  for (const file of (await readdir(gameRoot,{recursive:true})).filter(file=>/\.(tsx?|css)$/.test(file)&&!file.startsWith('dist'))) {
    assert.doesNotMatch(await readFile(resolve(gameRoot,file),'utf8'),/@rehab-trainer\/|packages\/ui|mediaDevices|@mediapipe|SaveTrainingSessionRecord|\.\.\/\.\.\//,file);
  }
  for (const file of ['settings.json','score.json']) await assert.rejects(access(resolve(gameRoot,file)));
  const registry = JSON.parse(await readFile(resolve(root,'packages/ui/src/officialGameReleases.json'),'utf8'));
  assert.ok(registry['motor-cortex-rehab']);
  const hub = JSON.parse(await readFile(resolve(root,'apps/rehabtrainerhub/package.json'),'utf8'));
  assert.equal(hub.dependencies['@rehab-trainer/game-motor-cortex-rehab'],undefined);
  const metadata = JSON.parse(await readFile(resolve(gameRoot,'public/game.json'),'utf8'));
  assert.equal(metadata.category,'upper-limb'); assert.equal(metadata.copy['zh-TW'].title,'手部目標追蹤練習');
  const preview = await readFile(resolve(gameRoot,'public/preview.webp'));
  const capture = JSON.parse(await readFile(new URL('../docs/game-preview-captures.json', import.meta.url), 'utf8')).find(item => item.gameId === metadata.gameId);
  assert.equal(createHash('sha256').update(preview).digest('hex'), capture.previewSha256);
});

test('numeric results retain all events and outcomes without identity or missing values becoming zero', async () => {
  const { BuildGameScore } = await LoadModule('score.ts');
  const result = {Duration_Seconds:45,Successful_Reps:1,Interrupted_Holds:1,Accuracy_Percent:0,Hand_Visible_Percent:50,Raised_Percent:25,Raise_Line_Percent:65,Best_Hold_Seconds:.8,Adaptive_Level:2,
    Event_Records:[{Event_Number:1,Result:'success',Time_Seconds:1,Hold_Seconds:.8,Target_Size_Px:132,Adaptive_Level:1,Accuracy_Percent:0},
      {Event_Number:2,Result:'interrupted',Time_Seconds:2,Hold_Seconds:.3,Target_Size_Px:128,Adaptive_Level:2}]};
  const score = BuildGameScore(result);
  assert.equal(score.gameId,'motor-cortex-rehab');assert.equal(score.rounds.length,2);
  assert.equal(score.summary.timeInTarget,0);assert.equal(score.rounds[0].accuracy,0);assert.equal(score.rounds[1].accuracy,null);
  assert.equal(score.rounds[0].outcome,1);assert.equal(score.rounds[1].outcome,0);
  assert.equal(score.summary.raised,25); assert.equal(Object.keys(score.summary).length,8);
  assert.equal(BuildGameScore({...result,Raised_Percent:0}).summary.raised,0);
  assert.equal(BuildGameScore({...result,Raised_Percent:undefined}).summary.raised,null);
  const { IsGameResult } = await import('../packages/ui/src/selfContainedGame.js');
  assert.equal(IsGameResult({config:{drill:'bounce'},score},'motor-cortex-rehab'),true);
});
