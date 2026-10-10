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

test('tracking is self-contained with private input, own modal and real-scene spotlight, full results and original preview', async () => {
  const packageJson = JSON.parse(await readFile(resolve(gameRoot,'package.json'),'utf8'));
  assert.equal(packageJson.version,'2.0.0');
  assert.deepEqual(Object.keys(packageJson.dependencies).sort(),['jspsych','react','react-dom']);
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
  assert.equal(createHash('sha256').update(preview).digest('hex'),createHash('sha256').update(await readFile(resolve(root,'apps/rehabtrainerhub/public/assets/training-modules/motor-cortex-rehab.webp'))).digest('hex'));
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
