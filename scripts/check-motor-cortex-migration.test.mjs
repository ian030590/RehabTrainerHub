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
  assert.deepEqual(defaultConfig, {drill:'bounce',difficulty:'intermediate',durationSec:60,handChoice:'any',targetSizePercent:100,speedPercent:100});
  assert.equal(IsMotorConfig(defaultConfig),true);
  for (const [key, values] of Object.entries({drill:['bounce','vertical','horizontal','random'],difficulty:['beginner','intermediate','advanced'],
    durationSec:[45,60,90],handChoice:['any','left','right'],targetSizePercent:[75,100,130],speedPercent:[70,100,140]})) {
    for (const value of values) assert.equal(IsMotorConfig({...defaultConfig,[key]:value}),true,`${key}: ${value}`);
  }
  for (const [key, values] of Object.entries({drill:['other'],difficulty:['medium'],durationSec:[0,46,Infinity],handChoice:['both'],
    targetSizePercent:[70,135,77,NaN],speedPercent:[65,145,72]})) {
    for (const value of values) assert.equal(IsMotorConfig({...defaultConfig,[key]:value}),false,`${key}: ${value}`);
  }
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
  const enemy = engine.CreateLaserEncounter();
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

test('pixel hero art and sound are packaged CC0 files with verified source hashes', async () => {
  const directory = resolve(gameRoot, 'public/assets/laser-hero');
  const sources = JSON.parse(await readFile(resolve(directory, 'SOURCES.json'), 'utf8'));
  assert.deepEqual(sources.map(item => item.file).sort(), ['complete.ogg', 'enemy-step.png', 'enemy.png', 'hit.ogg', 'laser.ogg', 'palm.png']);
  for (const source of sources) {
    assert.equal(source.license, 'CC0-1.0');
    assert.equal(new URL(source.source).origin, 'https://kenney.nl');
    const bytes = await readFile(resolve(directory, source.file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256);
    assert.equal(bytes.subarray(0, 4).toString(source.file.endsWith('.png') ? 'hex' : 'ascii'), source.file.endsWith('.png') ? '89504e47' : 'OggS');
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
  const result = {Duration_Seconds:45,Successful_Reps:1,Interrupted_Holds:1,Accuracy_Percent:0,Hand_Visible_Percent:50,Best_Hold_Seconds:.8,Adaptive_Level:2,
    Event_Records:[{Event_Number:1,Result:'success',Time_Seconds:1,Hold_Seconds:.8,Target_Size_Px:132,Adaptive_Level:1,Accuracy_Percent:0},
      {Event_Number:2,Result:'interrupted',Time_Seconds:2,Hold_Seconds:.3,Target_Size_Px:128,Adaptive_Level:2}]};
  const score = BuildGameScore(result);
  assert.equal(score.gameId,'motor-cortex-rehab');assert.equal(score.rounds.length,2);
  assert.equal(score.summary.timeInTarget,0);assert.equal(score.rounds[0].accuracy,0);assert.equal(score.rounds[1].accuracy,null);
  assert.equal(score.rounds[0].outcome,1);assert.equal(score.rounds[1].outcome,0);
  const { IsGameResult } = await import('../packages/ui/src/selfContainedGame.js');
  assert.equal(IsGameResult({config:{drill:'bounce'},score},'motor-cortex-rehab'),true);
});
