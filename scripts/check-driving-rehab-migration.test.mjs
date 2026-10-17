import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const gameRoot = resolve(root, 'apps/rehabtrainerhub/games/driving-rehab');
const legacy = JSON.parse(await readFile(resolve(root, 'scripts/fixtures/driving-rehab-legacy.json'), 'utf8'));
async function LoadModule(file, stubs = {}) {
  const path = resolve(gameRoot, file);
  const module = { exports: {} };
  const source = (await readFile(path, 'utf8')).replaceAll('import.meta.url', JSON.stringify(pathToFileURL(path).href));
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('module', 'exports', 'require', output)(module, module.exports, name => {
    assert.ok(Object.hasOwn(stubs, name), `Unexpected dependency ${name} in ${file}`);
    return stubs[name];
  });
  return module.exports;
}

test('driving retains original settings, validates enums and preserves the four control choices', async () => {
  const { defaultSettings, ValidateSettings } = await LoadModule('settings.ts');
  const fields = legacy.settings.sections.flatMap(section => section.fields);
  assert.deepEqual(defaultSettings, Object.fromEntries(fields.map(field => [field.key, field.default])));
  assert.equal(ValidateSettings(defaultSettings), true);
  for (const field of fields) {
    for (const option of field.options ?? []) assert.equal(ValidateSettings({ ...defaultSettings, [field.key]: option.value }), true);
    assert.equal(ValidateSettings({ ...defaultSettings, [field.key]: 'invalid' }), false);
  }
});

test('driving keeps numeric results, unanswered events, zero latency and unfinished outcomes', async () => {
  const { BuildGameScore } = await LoadModule('score.ts');
  const score = BuildGameScore([{ trial_type: 'three-driving-rehab', duration_ms: 80000, average_rt: 0,
    median_rt: 0, valid_event_count: 1, reaction_event_count: 1, collisions: 2, lane_deviations: 3,
    average_fps: 59, successful_avoidance_count: 1, event_count: 3, driving_events: [
      { rt_ms: 0, avoidance_success: true, valid: true, collision: false, distance_m: 12, other_vehicle_collision: false },
      { rt_ms: null, avoidance_success: false, valid: false, collision: true, distance_m: 16, other_vehicle_collision: true },
      { rt_ms: null, avoidance_success: null, valid: false, collision: false, distance_m: 20, other_vehicle_collision: false },
    ] }]);
  assert.equal(score.gameId, 'driving-rehab');
  assert.deepEqual(Object.keys(score.summary), legacy.score.summary.map(field => field.key));
  assert.deepEqual(Object.keys(score.rounds[0]), legacy.score.columns.map(field => field.key));
  assert.deepEqual(score.rounds, [
    { rt: 0, avoided: 1, responded: 1, collision: 0, distance: 12, otherCollision: 0 },
    { rt: null, avoided: 0, responded: 0, collision: 1, distance: 16, otherCollision: 1 },
    { rt: null, avoided: null, responded: 0, collision: 0, distance: 20, otherCollision: 0 },
  ]);
  assert.equal(score.summary.meanRt, 0);
  assert.ok(Object.values(BuildGameScore([]).summary).every(value => value === null));
  const { AcceptGameMessage } = await import('../packages/ui/src/selfContainedGame.js');
  assert.equal(AcceptGameMessage({ schema: 'trainerhub.game/v1', gameId: 'driving-rehab', version: '2.0.0', sessionNonce: 'a'.repeat(64), sequence: 0, type: 'result', payload: { config: { difficulty: 'medium' }, score } },
    { gameId: 'driving-rehab', version: '2.0.0', sessionNonce: 'a'.repeat(64), sequence: -1, complete: false }), true);
});

test('original driving physics, input calibration, timing, map and model bytes remain intact', async () => {
  for (const [file, digest] of Object.entries(legacy.hashes)) {
    assert.equal(createHash('sha256').update(await readFile(resolve(gameRoot, file))).digest('hex'), digest, file);
  }
});

test('the model script preserves exact GLB bytes under 8 MiB and runs before the classic game entry', async () => {
  const bytes = await readFile(resolve(gameRoot, 'models/car.glb'));
  const { default: config } = await LoadModule('vite.config.ts', {
    vite: { defineConfig: value => value }, '@vitejs/plugin-react': { default: () => ({}) },
    'node:fs': { readFileSync: () => bytes },
  });
  const plugin = config.plugins[1];
  let asset;
  plugin.generateBundle.call({ emitFile: file => { asset = file; } });
  assert.equal(asset.fileName, 'vehicle-data.js');
  assert.ok(Buffer.byteLength(asset.source) <= 8 * 1024 * 1024);
  const sandbox = {};
  new Function('window', asset.source)(sandbox);
  assert.deepEqual(Buffer.from(sandbox.DrivingRehabVehicleData, 'base64'), bytes);
  const html = plugin.transformIndexHtml.handler('<script type="module" crossorigin src="./game.js"></script>');
  assert.equal(html, '<script defer src="./vehicle-data.js"></script><script defer src="./game.js"></script>');
  assert.equal(config.build.rollupOptions.output.format, 'iife');
});

test('embedded GLB textures use image elements allowed by img-src, avoiding ImageBitmapLoader fetch', async () => {
  const source = await readFile(resolve(gameRoot, 'three-driving-rehab.ts'), 'utf8');
  const ast = ts.createSourceFile('driving.ts', source, ts.ScriptTarget.Latest, true);
  const method = ast.statements.find(ts.isClassDeclaration).members.find(node => node.name?.getText(ast) === 'loadReferenceVehicleModel').getText(ast);
  const compiled = ts.transpileModule(`class RuntimeHarness { ${method} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const parser = { textureLoader: 'fetch-based', options: { manager: {} } };
  class TextureLoader {}
  class GLTFLoader {
    register(callback) { callback(parser); return this; }
    parse() {}
  }
  const runtimeClass = new Function('GLTFLoader', 'TextureLoader', 'window', `${compiled};return RuntimeHarness;`)(GLTFLoader, TextureLoader, { DrivingRehabVehicleData: 'AAAA' });
  const runtime = new runtimeClass();
  Object.assign(runtime, { renderQuality: { useReferenceVehicleModel: true }, vehicleRoot: {} });
  void runtime.loadReferenceVehicleModel();
  assert.ok(parser.textureLoader instanceof TextureLoader);
});

test('driving owns its UI and resources and is excluded from the Hub bundle', async () => {
  for (const file of (await readdir(gameRoot, { recursive: true })).filter(file => /\.(tsx?|css|js)$/.test(file) && !/^(dist|node_modules)[\\/]/.test(file))) {
    assert.doesNotMatch(await readFile(resolve(gameRoot, file), 'utf8'), /@rehab-trainer\/|packages\/ui|localStorage|SaveTrainingRecord|GetHostedGameSetting/, file);
  }
  for (const file of ['settings.json', 'score.json']) await assert.rejects(access(resolve(gameRoot, file)));
  const pkg = JSON.parse(await readFile(resolve(gameRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '2.0.0');
  for (const name of ['react', 'react-dom', 'three', 'jspsych', 'tone']) assert.ok(pkg.dependencies[name], name);
  assert.ok(pkg.rehabTrainer.capabilities.includes('gamepad'));
  assert.ok(pkg.rehabTrainer.capabilities.includes('settings-storage'));
  const hub = JSON.parse(await readFile(resolve(root, 'apps/rehabtrainerhub/package.json'), 'utf8'));
  assert.equal(hub.dependencies[pkg.name], undefined);
  const registry = JSON.parse(await readFile(resolve(root, 'packages/ui/src/officialGameReleases.json'), 'utf8'));
  assert.equal(registry['driving-rehab'].origin, 'https://trainerhub-user-games.pages.dev');
  const metadata = JSON.parse(await readFile(resolve(gameRoot, 'public/game.json'), 'utf8'));
  assert.equal(metadata.gameId, 'driving-rehab');
  assert.equal(metadata.trainer, 'vision');
  assert.equal(metadata.category, 'vision');
  assert.deepEqual(await readFile(resolve(gameRoot, 'public', metadata.preview)), await readFile(resolve(root, 'apps/rehabtrainerhub/public/assets/training-modules/driving-rehab.webp')));
  const runtime = await readFile(resolve(gameRoot, 'three-driving-rehab.ts'), 'utf8');
  assert.doesNotMatch(runtime, /fetch\(|loader\.load\(|VITE_AI_ASSET/);
  assert.match(runtime, /loader\.parse\(/);
  const wheel = await readFile(resolve(gameRoot, 'input/drivingInputCapabilities.ts'), 'utf8');
  assert.match(wheel, /IsDrivingWheelCalibrationUsable/);
  const component = await readFile(resolve(gameRoot, 'DrivingRehabGame.tsx'), 'utf8');
  assert.match(component, /SendGameResult/);
  assert.match(component, /SaveGameSettings/);
  assert.match(component, /response === 'aborted'/);
  assert.match(component, /response === 'load-error'/);
});

test('reviewed gamepad capability is delegated in Hub and standalone without changing sandbox or network policy', async () => {
  const overlay = await readFile(resolve(root, 'apps/rehabtrainerhub/app/train/R2GameOverlay.tsx'), 'utf8');
  assert.match(overlay, /capabilities\?\.includes\('gamepad'\)/);
  assert.match(overlay, /gamepad \*/);
  const { RenderHandTrackingLauncher } = await import('../apps/usergamerunner/functions/_lib/handTrackingLauncher.js');
  const release = { gameId: 'driving-rehab', version: '2.0.0', capabilities: ['gamepad', 'settings-storage'] };
  assert.match(RenderHandTrackingLauncher(release, '/games/driving-rehab/2.0.0/', 'test'), /allow="fullscreen; autoplay; gamepad \*"/);
  assert.doesNotMatch(RenderHandTrackingLauncher({ ...release, capabilities: [] }, '/game/', 'test'), /gamepad \*/);
  assert.match(overlay, /sandbox="allow-scripts"/);
});

test('cancelling during refresh measurement aborts startup and never restarts a disposed scene', async () => {
  const source = await readFile(resolve(gameRoot, 'three-driving-rehab.ts'), 'utf8');
  const ast = ts.createSourceFile('driving.ts', source, ts.ScriptTarget.Latest, true);
  const trial = ast.statements.find(ts.isClassDeclaration).members.find(node => node.name?.getText(ast) === 'trial').getText(ast);
  const compiled = ts.transpileModule(`class RuntimeHarness { ${trial} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  let dispose, signal, measureFinished = false, started = 0;
  const root = { style: {}, dataset: {}, setAttribute() {}, focus() {} };
  const runtimeClass = new Function('document', 'RegisterDrivingRuntimeDisposer', 'soundManager', 'MeasureDisplayRefreshRate', 'requestAnimationFrame', `const typography = {fontFamily:'system-ui'}; ${compiled}; return RuntimeHarness;`)(
    { createElement: () => root }, callback => { dispose = callback; }, { prepare() {} },
    options => { signal = options.signal; return new Promise(resolve => {
      if (!signal) { resolve({}); return; }
      signal.addEventListener('abort', () => { measureFinished = true; resolve({}); }, { once: true });
    }); }, () => { started++; });
  const runtime = new runtimeClass();
  Object.assign(runtime, { resetTrialState() { this.startupAbort = new AbortController(); },
    createLoadingOverlay: () => ({ remove() {} }), initScene() { this.renderer = {}; }, initHud() {}, initTouchControls() {}, initInputPauseOverlay() {},
    renderQuality: { useReferenceVehicleModel: false }, updateVehicleVisual() {}, updateTrafficLights() {}, renderFirstFrameBeforeReveal() {},
    detachGlobalListeners() {}, cleanupRenderResources() {}, finishTrial() {}, readInput: () => ({ brake: 0 }), updateVehicleFree() {},
    attachVisibilityPauseListener() {}, attachKeyboardListeners() {}, attachGamepadListeners() {},
  });
  runtime.trial({ replaceChildren() {}, appendChild() {}, isConnected: true }, {});
  assert.ok(signal instanceof AbortSignal, 'Startup owns an abortable display measurement.');
  dispose();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(signal.aborted, true);
  assert.equal(measureFinished, true);
  assert.equal(started, 0);
});

test('driving-rehab bridge binds once to the parent private port and ignores forged initialization and acknowledgements', async () => {
  const source = await readFile(resolve(gameRoot, 'runtime/hubBridge.ts'), 'utf8');
  const listeners = new Map();
  const events = [];
  const parent = {};
  const window = { parent, addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: type => listeners.delete(type), dispatchEvent: event => events.push(event) };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'window', 'document', ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(name => name.endsWith('package.json') ? { version: '2.0.0' } : { DisposeAudioFeedback() {} }, module, module.exports, window, { referrer: 'https://trainerhub.cc/' });
  module.exports.InstallHubBridge();
  const sent = [];
  const port = { postMessage: message => sent.push(message), start: () => {}, onmessage: null };
  const event = { source: parent, origin: 'https://trainerhub.cc', ports: [port], data: {
    schema: 'trainerhub.game/v1', type: 'init', gameId: 'driving-rehab', version: '2.0.0', sessionNonce: 'a'.repeat(64), language: 'en' } };
  for (const changes of [{ source: {} }, { origin: 'https://evil.example' }, { ports: [] },
    { data: { ...event.data, gameId: 'gabor-patching' } }, { data: { ...event.data, version: '1.0.0' } }, { data: { ...event.data, sessionNonce: 'invalid' } }]) {
    listeners.get('message')({ ...event, ...changes });
    assert.equal(module.exports.IsHubGame(), false);
  }
  listeners.get('message')(event);
  assert.equal(module.exports.IsHubGame(), true);
  assert.equal(module.exports.GetGameLanguage(), 'en');
  assert.equal(sent[0].type, 'ready');
  assert.equal(sent[0].gameId, 'driving-rehab');
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
