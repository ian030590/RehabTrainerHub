import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const gameRoot = resolve(root, 'apps/rehabtrainerhub/games/asteroid-shield');
const originalPreviewSha256 = '48580bdf2930ce1af7f9e71a8b3f29f294a7a61a0179e646f15ad61cca457a98';

// Execute the game's renderer and input code with lightweight Pixi objects; keep physics out of fixtures.
async function LoadAsteroidGameplay() {
  const source = await readFile(resolve(gameRoot, 'AsteroidShieldGame.tsx'), 'utf8');
  const syntax = ts.createSourceFile('AsteroidShieldGame.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const constants = syntax.statements.filter(statement => ts.isVariableStatement(statement)
    && statement.declarationList.declarations.some(declaration => ['difficulties', 'speedLevelStep', 'defaultShieldSizePercent'].includes(declaration.name.getText(syntax))))
    .map(statement => statement.getText(syntax)).join('\n');
  const transpile = code => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  class Sprite {
    constructor({ texture, width = texture.width, height = texture.height, alpha = 1 }) {
      Object.assign(this, { texture, width, height, alpha, x: 0, y: 0, rotation: 0 });
    }
    removeFromParent() { this.removed = true; }
    destroy() { this.destroyed = true; }
  }
  const runtime = new Function('Sprite', 'Clamp', transpile(constants + '\n' + source.slice(source.indexOf('function CreateEmptyMetrics')))
    + '\nreturn { CreateEmptyMetrics, UpdateSceneLayout, GetShieldLayout, SpawnThreat, UpdateAsteroidGame, ClearAsteroidScene };')(Sprite, (value, min, max) => Math.min(max, Math.max(min, value)));
  const texture = { width: 64, height: 64 };
  const scene = { background: { tilePosition: { y: 0 } },
    ship: new Sprite({ texture: { width: 512, height: 164 } }),
    shield: new Sprite({ texture: { width: 178, height: 128 } }),
    objectsLayer: { addChild: () => {} }, textures: { normal: texture, heavy: texture, lethal: texture, energy: texture }, threats: [] };
  const app = { screen: { width: 1000, height: 700 } };
  const metricsRef = { current: runtime.CreateEmptyMetrics(10) };
  const shieldPositionRef = { current: 0.5 };
  const configRef = { current: { difficulty: 'beginner', durationSec: 30, maxHp: 10, shieldSizePercent: 95, controlMode: 'mouse' } };
  const records = [];
  const options = { app, sceneRef: { current: scene }, metricsRef, configRef, shieldPositionRef,
    resultRecordsRef: { current: records }, onSuccess: () => {}, onFailure: () => {}, onComplete: () => {} };
  let pointerDeclaration;
  const findPointer = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(syntax) === 'updateFromPointer') pointerDeclaration = node.getText(syntax);
    ts.forEachChild(node, findPointer);
  };
  findPointer(syntax);
  const pointer = new Function('host', 'phaseRef', 'activeControlModeRef', 'configRef', 'shieldPositionRef', 'metricsRef',
    'Clamp', transpile('const ' + pointerDeclaration) + '\nreturn updateFromPointer;')(
    { getBoundingClientRect: () => ({ left: 20, top: 40, width: app.screen.width, height: app.screen.height }) },
    { current: 'playing' }, { current: 'mouse' }, configRef, shieldPositionRef, metricsRef,
    (value, min, max) => Math.min(max, Math.max(min, value)));
  const layout = () => runtime.UpdateSceneLayout(app, scene, configRef.current.shieldSizePercent, shieldPositionRef.current);
  const spawn = (kind = 'normal', random = 0.5) => {
    const originalRandom = Math.random;
    Math.random = () => random;
    try {
      runtime.SpawnThreat(scene, app.screen.width, app.screen.height,
        { baseSpeed: 120, energyChance: kind === 'energy' ? 1 : 0, lethalChance: kind === 'lethal' ? 1 : 0, heavyChance: kind === 'heavy' ? 1 : 0 }, metricsRef.current);
    } finally { Math.random = originalRandom; }
    return scene.threats.at(-1);
  };
  return { ...runtime, app, scene, metricsRef, shieldPositionRef, configRef, records, pointer, layout, spawn,
    tick: (deltaMS = 16) => runtime.UpdateAsteroidGame({ ...options, ticker: { deltaMS } }) };
}

test('asteroid ship spans most of the bottom edge on desktop, tablet and phone', async () => {
  const game = await LoadAsteroidGameplay();
  for (const [width, height] of [[1440, 900], [752, 485], [768, 1024], [390, 844], [844, 390]]) {
    game.app.screen = { width, height };
    game.layout();
    const ship = game.scene.ship;
    assert.ok(ship.width > width * 0.5 && ship.width <= width, `${width}x${height}: wide ship`);
    assert.ok(ship.y + ship.height / 2 <= height && ship.y + ship.height / 2 >= height * 0.95, 'Ship sits along the bottom edge.');
    assert.equal(ship.rotation, 0);
    assert.ok(game.scene.shield.y + game.scene.shield.height / 2 < ship.y - ship.height / 2);
  }
});

test('mouse and touch pointer X move the shield horizontally, ignoring Y and clamping both edges', async () => {
  const game = await LoadAsteroidGameplay();
  game.pointer({ clientX: 220, clientY: 80 }); game.layout();
  const first = { x: game.scene.shield.x, y: game.scene.shield.y };
  game.pointer({ clientX: 820, clientY: 80 }); game.layout();
  assert.ok(game.scene.shield.x > first.x);
  assert.equal(game.scene.shield.y, first.y);
  assert.equal(game.scene.shield.rotation, 0);
  game.pointer({ clientX: 820, clientY: 680 }); game.layout();
  assert.equal(game.scene.shield.x, 800);
  assert.equal(game.scene.shield.y, first.y);
  for (const clientX of [-200, 1400]) {
    game.pointer({ clientX, clientY: 200 }); game.layout();
    assert.ok(game.scene.shield.x - game.scene.shield.width / 2 >= 0);
    assert.ok(game.scene.shield.x + game.scene.shield.width / 2 <= 1000);
  }
});

test('asteroids fall vertically from the top with visibly different individual speeds', async () => {
  const game = await LoadAsteroidGameplay();
  const slow = game.spawn('normal', 0.1);
  const fast = game.spawn('normal', 0.9);
  assert.ok(slow.y < 0 && fast.y < 0);
  assert.equal(slow.vx, 0); assert.equal(fast.vx, 0);
  assert.ok(fast.vy > slow.vy * 2, 'Individual fall speed should vary substantially, even for the same type.');
  const initial = { slowY: slow.y, fastY: fast.y, slowX: slow.x, fastX: fast.x };
  game.tick(50);
  assert.equal(slow.x, initial.slowX); assert.equal(fast.x, initial.fastX);
  assert.ok(fast.y - initial.fastY > (slow.y - initial.slowY) * 2);
});

test('falling asteroids animate their glow and trail, and dispose all visuals on exit', async () => {
  const game = await LoadAsteroidGameplay();
  for (const kind of ['normal', 'heavy', 'lethal']) {
    const threat = game.spawn(kind);
    threat.y = 100;
    const before = { width: threat.sprite.width, alpha: threat.sprite.alpha, rotation: threat.sprite.rotation };
    game.tick(50);
    assert.notEqual(threat.sprite.width, before.width, `${kind}: pulsing animation`);
    assert.notEqual(threat.sprite.alpha, before.alpha, `${kind}: animated glow`);
    assert.ok(threat.trail.length > 0, `${kind}: visible falling trail`);
    assert.ok(threat.trail.every(sprite => sprite.y < threat.y && sprite.alpha > 0));
    if (kind !== 'normal') assert.notEqual(threat.sprite.rotation, before.rotation);
  }
  const visuals = game.scene.threats.flatMap(threat => [threat.sprite, ...threat.trail]);
  game.ClearAsteroidScene(game.scene);
  assert.ok(visuals.every(sprite => sprite.destroyed));
});

test('horizontal shield and wide ship collisions preserve interception, damage, energy and missed outcomes', async () => {
  for (const [kind, target, expected] of [['normal', 'shield', 'shielded'], ['heavy', 'ship-left', 'hit'],
    ['normal', 'ship-right', 'hit'], ['lethal', 'ship-right', 'hit'], ['energy', 'shield', 'collected'],
    ['energy', 'ship-left', 'collected'], ['normal', 'outside', 'missed']]) {
    const game = await LoadAsteroidGameplay();
    const { ship, shield } = game.scene;
    game.layout();
    const threat = game.spawn(kind);
    threat.x = target === 'shield' ? shield.x : target === 'ship-left' ? ship.x - ship.width / 2 + 5
      : target === 'ship-right' ? ship.x + ship.width / 2 - 5 : 10;
    threat.y = target === 'shield' ? shield.y - shield.height / 2 - threat.radius - 1 : ship.y - ship.height / 2 - threat.radius - 1;
    threat.vy = 20000; // A long tick must still intercept at the shield/ship, rather than skip it.
    const visuals = [threat.sprite, ...(threat.trail ?? [])];
    game.metricsRef.current.hp = 5;
    game.tick(50);
    assert.equal(game.records[0]?.Outcome, expected, `${kind}/${target}`);
    assert.ok(visuals.every(sprite => sprite.destroyed));
    assert.equal(game.scene.threats.length, 0);
    if (expected === 'shielded') assert.equal(game.metricsRef.current.blocked, 1);
    if (expected === 'collected') assert.equal(game.metricsRef.current.hp, 7);
    if (expected === 'hit') assert.equal(game.metricsRef.current.hp, kind === 'lethal' ? 0 : kind === 'heavy' ? 2 : 4);
  }
});

test('asteroid settings preserve the old defaults, presets, boundaries and runtime conversion', async () => {
  const { defaultSettings, BuildRuntimeConfig } = await import('../apps/rehabtrainerhub/games/asteroid-shield/settings.ts');
  assert.deepEqual(defaultSettings, { difficulty: 'medium', durationSec: 90, sensitivity: 5, soundEnabled: true });
  assert.deepEqual(BuildRuntimeConfig(defaultSettings), {
    difficulty: 'intermediate', durationSec: 90, maxHp: 10, shieldSizePercent: 95, controlMode: 'mouse',
  });
  for (const [difficulty, runtimeDifficulty] of [['easy', 'beginner'], ['medium', 'intermediate'], ['hard', 'advanced']]) {
    for (const [durationSec, sensitivity] of [[30, 1], [120, 7], [300, 10]]) {
      const settings = { difficulty, durationSec, sensitivity, soundEnabled: false };
      const runtime = BuildRuntimeConfig(settings);
      assert.equal(runtime.difficulty, runtimeDifficulty);
      assert.equal(runtime.durationSec, durationSec);
      assert.equal(runtime.shieldSizePercent, 70 + sensitivity * 5);
      assert.deepEqual(BuildRuntimeConfig(JSON.parse(JSON.stringify(settings))), runtime);
    }
  }
  for (const patch of [{ difficulty: 'wrong' }, { durationSec: 29 }, { durationSec: 301 },
    { durationSec: 31 }, { durationSec: Infinity }, { sensitivity: 0 }, { sensitivity: 11 },
    { sensitivity: 1.5 }, { soundEnabled: 'false' }]) {
    assert.throws(() => BuildRuntimeConfig({ ...defaultSettings, ...patch }), JSON.stringify(patch));
  }
});

test('asteroid release owns UI, dependencies, metadata and the exact original preview', async () => {
  const files = await readdir(gameRoot, { recursive: true });
  for (const file of files.filter(file => /\.(?:tsx?|css|js)$/.test(file) && !/^(?:dist|node_modules)[\\/]/.test(file))) {
    const source = await readFile(resolve(gameRoot, file), 'utf8');
    assert.doesNotMatch(source, /@rehab-trainer\/|packages\/ui|SaveTrainingSessionRecord|GetHostedGameSetting/, file);
  }
  for (const file of ['settings.json', 'score.json']) await assert.rejects(access(resolve(gameRoot, file)));
  const pkg = JSON.parse(await readFile(resolve(gameRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '2.0.3');
  for (const dependency of ['react', 'react-dom', 'pixi.js', 'jspsych']) assert.ok(pkg.dependencies[dependency]);
  const hub = JSON.parse(await readFile(resolve(root, 'apps/rehabtrainerhub/package.json'), 'utf8'));
  assert.equal(hub.dependencies[pkg.name], undefined);
  const metadata = JSON.parse(await readFile(resolve(gameRoot, 'public/game.json'), 'utf8'));
  assert.equal(metadata.gameId, 'asteroid-shield');
  assert.equal(metadata.trainer, 'motor');
  assert.equal(metadata.category, 'upper-limb');
  assert.equal(metadata.copy['zh-TW'].title, '小行星護盾防衛');
  const preview = await readFile(resolve(gameRoot, 'public', metadata.preview));
  assert.equal(createHash('sha256').update(preview).digest('hex'), originalPreviewSha256);
  const catalog = await readFile(resolve(gameRoot, '../catalog.ts'), 'utf8');
  assert.match(catalog, /asteroidShieldCatalog\.category/);
  assert.match(catalog, /asteroidShieldCatalog\.preview/);
});

test('asteroid outcomes keep every old score column and all object rows using numeric codes', async () => {
  const { BuildGameScore } = await import('../apps/rehabtrainerhub/games/asteroid-shield/settings.ts');
  const record = { Total_Duration_Seconds: 30, Objects_Spawned: 12, Objects_Blocked: 3,
    Ship_Hits: 2, Energy_Collected: 1, Final_HP: 5, Score: 90, Final_Speed_Level: 2, Game_Result: 'Defeat',
    Object_Records: Array.from({ length: 12 }, (_, index) => ({ Object_Number: index + 1,
      Type: ['normal', 'heavy', 'lethal', 'energy'][index % 4],
      Outcome: ['shielded', 'hit', 'collected', 'missed'][index % 4],
      Spawn_Time_Seconds: index, Response_Time_Seconds: index === 11 ? null : 1.5,
      Damage: index % 3, HP_After: 5, Score_After: 90, Speed_Level: 2, Control_Source: 'mouse' })),
  };
  const score = BuildGameScore(record);
  assert.equal(score.gameId, 'asteroid-shield');
  assert.deepEqual(score.summary, { duration: 30, spawned: 12, blocked: 3, hits: 2,
    energy: 1, hp: 5, score: 90, speedLevel: 2, victory: 0 });
  assert.equal(score.rounds.length, 12, 'Do not truncate the old last-ten-row table into saved results.');
  assert.deepEqual(score.rounds[11], { object: 12, type: 3, outcome: 3, spawnedAt: 11,
    elapsed: null, damage: 2, hp: 5, score: 90, speedLevel: 2, controlSource: 0 });
  const { AcceptGameMessage } = await import('../packages/ui/src/selfContainedGame.js');
  const state = { gameId: score.gameId, version: '2.0.0', sessionNonce: 'a'.repeat(64), sequence: -1, complete: false };
  assert.equal(AcceptGameMessage({ schema: 'trainerhub.game/v1', gameId: state.gameId, version: state.version,
    sessionNonce: state.sessionNonce, sequence: 0, type: 'result',
    payload: { config: { difficulty: 'medium', durationSec: 30, sensitivity: 5, soundEnabled: true }, score } }, state), true);
});

test('asteroid result analysis retains selectable metrics and excludes missing outcomes from statistics', async () => {
  const { CalculateScoreStatistics } = await import('../apps/rehabtrainerhub/games/asteroid-shield/scoreStatistics.ts');
  assert.deepEqual(CalculateScoreStatistics([1, 2, null, 3, 4]), {
    observations: 4, mean: 2.5, median: 2.5, sampleSd: Math.sqrt(5 / 3), minimum: 1, maximum: 4,
  });
  assert.deepEqual(CalculateScoreStatistics([null]), {
    observations: 0, mean: null, median: null, sampleSd: null, minimum: null, maximum: null,
  });
  assert.equal(CalculateScoreStatistics([2]).sampleSd, null);
});

test('asteroid preserves its original success, failure and end sound sequences and mute setting', async () => {
  const sound = await import('../apps/rehabtrainerhub/games/asteroid-shield/runtime/soundManager.ts');
  const originalAudioContext = globalThis.AudioContext;
  const frequencies = [];
  let contexts = 0;
  class FakeAudioContext {
    constructor() { contexts++; }
    state = 'running'; currentTime = 1; destination = {};
    resume = async () => {};
    createOscillator = () => {
      const frequency = { value: 0, setValueAtTime: value => { frequency.value = value; } };
      return { frequency, connect: target => target, disconnect: () => {},
        start: () => frequencies.push(frequency.value), stop: () => {} };
    };
    createGain = () => ({ gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: () => {}, disconnect: () => {} });
  }
  globalThis.AudioContext = FakeAudioContext;
  try {
    const audio = new FakeAudioContext();
    const source = { current: { pluginAPI: { audioContext: () => audio } } };
    sound.SetSoundEnabled(false);
    sound.PrepareAudioFeedback(source); sound.PlaySuccessSound(source);
    assert.deepEqual(frequencies, []);
    sound.SetSoundEnabled(true);
    sound.PrepareAudioFeedback(source);
    sound.PlaySuccessSound(source); sound.PlayFailureSound(source);
    sound.PlayGameEndSound('Victory', source); sound.PlayGameEndSound('Defeat', source);
    assert.deepEqual(frequencies, [523.25, 659.25, 783.99, 246.94, 185,
      523.25, 659.25, 783.99, 1046.5, 220, 164.81, 130.81]);
    assert.equal(contexts, 1, 'Reuse the existing jsPsych AudioContext.');
    sound.SetSoundEnabled(false); sound.PlayFailureSound(source);
    assert.equal(frequencies.length, 12);
  } finally { globalThis.AudioContext = originalAudioContext; }
});

test('asteroid bridge binds once to the parent private port and ignores forged initialization and acknowledgements', async () => {
  const source = await readFile(resolve(gameRoot, 'runtime/hubBridge.ts'), 'utf8');
  const listeners = new Map();
  const events = [];
  const parent = {};
  const window = { parent, addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: type => listeners.delete(type), dispatchEvent: event => events.push(event) };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'window', 'document', ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(() => ({ version: '2.0.1' }), module, module.exports, window, { referrer: 'https://trainerhub.cc/' });
  module.exports.InstallHubBridge();
  assert.equal(module.exports.GetGameLanguage(), null);
  const sent = [];
  const port = { postMessage: message => sent.push(message), start: () => {}, onmessage: null };
  const event = { source: parent, origin: 'https://trainerhub.cc', ports: [port], data: {
    schema: 'trainerhub.game/v1', type: 'init', gameId: 'asteroid-shield', version: '2.0.1', sessionNonce: 'a'.repeat(64), language: 'en' } };
  for (const changes of [{ source: {} }, { origin: 'https://evil.example' }, { ports: [] },
    { data: { ...event.data, version: '1.0.0' } }, { data: { ...event.data, sessionNonce: 'invalid' } }]) {
    listeners.get('message')({ ...event, ...changes });
    assert.equal(module.exports.IsHubGame(), false);
  }
  listeners.get('message')(event);
  assert.equal(module.exports.IsHubGame(), true);
  assert.equal(module.exports.GetGameLanguage(), 'en', 'Retain init language for a provider that mounts later.');
  assert.equal(sent[0].type, 'ready');
  assert.equal(sent[0].gameId, 'asteroid-shield');
  assert.equal(listeners.has('message'), false);
  events.length = 0;
  port.onmessage({ data: { schema: 'trainerhub.game/v1', sessionNonce: 'b'.repeat(64), type: 'saved', state: 'saved' } });
  assert.equal(events.length, 0);
  port.onmessage({ data: { schema: 'trainerhub.game/v1', sessionNonce: 'a'.repeat(64), type: 'saved', state: 'error' } });
  assert.equal(events[0].detail, 'error');
  module.exports.RetryGameSave();
  module.exports.ExitGame();
  assert.deepEqual(sent.map(message => [message.type, message.sequence]), [['ready', 0], ['retry', 1], ['exit', 2]]);
});
