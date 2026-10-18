import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const gameRoot = resolve(root, 'apps/rehabtrainerhub/games/reading-training');
const legacy = JSON.parse(await readFile(resolve(root, 'scripts/fixtures/reading-training-legacy.json'), 'utf8'));

async function LoadModule(file, dependencies = {}, globals = {}) {
  const module = { exports: {} };
  const source = await readFile(resolve(gameRoot, file), 'utf8');
  new Function('require', 'module', 'exports', ...Object.keys(globals), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(name => { assert.ok(name in dependencies, name); return dependencies[name]; }, module, module.exports, ...Object.values(globals));
  return module.exports;
}

const story = { story_id: 'en_story_02', language: 'en', title: 'Story', passageIndex: 2,
  content_array: ['one', 'two', 'three', 'four', 'five'],
  questions: Array.from({ length: 12 }, (_, index) => ({ q_id: index + 1, question: `Question ${index + 1}?`,
    options: ['A', 'B', 'C', 'D'], correct_index: index % 4 })) };

test('reading keeps every original setting, default and boundary', async () => {
  const { defaultSettings, numericSettings, ValidateSettings } = await LoadModule('settings.ts');
  const fields = legacy.settings.sections.flatMap(section => section.fields);
  assert.deepEqual(Object.keys(defaultSettings), fields.map(field => field.key));
  for (const field of fields) {
    assert.equal(defaultSettings[field.key], field.default, field.key);
    const local = numericSettings.find(item => item.key === field.key);
    assert.deepEqual([local.min, local.max, local.step], [field.min, field.max, field.step], field.key);
    for (const value of [field.min, field.default, field.max]) assert.equal(ValidateSettings({ ...defaultSettings, [field.key]: value }), true);
    for (const value of [field.min - field.step, field.max + field.step, field.min + field.step / 2, NaN, String(field.default)]) {
      assert.equal(ValidateSettings({ ...defaultSettings, [field.key]: value }), false, `${field.key}=${value}`);
    }
  }
});

test('passage material is chosen from a dropdown of random and the three fixed passages, not a slider', async () => {
  const { passageOptions, ValidateSettings, defaultSettings } = await LoadModule('settings.ts');
  assert.deepEqual(passageOptions, [0, 1, 2, 3]);
  for (const passage of passageOptions) assert.equal(ValidateSettings({ ...defaultSettings, passage }), true);
  const source = await readFile(resolve(gameRoot, 'ReadingTrainingGame.tsx'), 'utf8');
  const tree = ts.createSourceFile('game.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const elements = [];
  const visit = node => { if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) elements.push(node); ts.forEachChild(node, visit); };
  visit(tree);
  const attribute = (node, name) => node.attributes.properties.find(item => item.name?.getText(tree) === name)?.initializer?.getText(tree);
  const select = elements.find(node => node.tagName.getText(tree) === 'select' && attribute(node, 'name') === '"passage"');
  assert.ok(select, 'Passage uses a native select.');
  assert.match(select.parent.getText(tree), /passageOptions\.map/);
  const ranges = elements.filter(node => node.tagName.getText(tree) === 'input' && attribute(node, 'type') === '"range"' && attribute(node, 'name') !== '"crowding"');
  assert.equal(ranges.length, 1);
  const { segmentsPerDisplay, crowdingFromSegments } = await LoadModule('settings.ts');
  assert.deepEqual([1, 2, 3, 4, 5].map(crowdingFromSegments), [100, 200, 300, 400, 500], 'Saved values keep the original percent scale.');
  assert.deepEqual([100, 300, 500].map(segmentsPerDisplay), [1, 3, 5]);
  const crowding = elements.find(node => node.tagName.getText(tree) === 'input' && attribute(node, 'name') === '"crowding"');
  assert.ok(crowding, 'Batch size is its own control.');
  assert.equal(attribute(crowding, 'type'), '"range"');
  assert.deepEqual(['min', 'max', 'step'].map(name => attribute(crowding, name)), ['{1}', '{5}', '{1}'], 'Players choose 1–5 segments, not 100–500%.');
  assert.match(attribute(crowding, 'value'), /segmentsPerDisplay\(settings\.crowding\)/);
  assert.match(ranges[0].parent.getText(tree) + source, /rangeSettings\.map/);
  assert.doesNotMatch(source, /name="passage"[^>]*type="range"/);
});

test('reading selects the configured passage per language and random passage 0 among all three', async () => {
  const stories = Object.fromEntries(['en', 'zh'].flatMap(language => [1, 2, 3].map(index => [
    `../data/reading-stories/${language}-story/${language}_story_0${index}.json`, { default: { language, title: `${language}${index}` } }])));
  const { GetStory } = await LoadModule('reading/stories.ts', stories);
  assert.deepEqual(GetStory('en', 2), { language: 'en', title: 'en2', passageIndex: 2 });
  assert.deepEqual(GetStory('zh', 3), { language: 'zh', title: 'zh3', passageIndex: 3 });
  assert.equal(GetStory('zh', 0, () => .99).passageIndex, 3);
  assert.equal(GetStory('en', 0, () => 0).passageIndex, 1);
  assert.throws(() => GetStory('en', 4), RangeError);
  for (const [language, count, questions] of [['en', [565, 519, 605], 100], ['zh', [74, 74, 79], 30]]) {
    for (const index of [1, 2, 3]) {
      const data = JSON.parse(await readFile(resolve(gameRoot, `data/reading-stories/${language}-story/${language}_story_0${index}.json`), 'utf8'));
      assert.equal(data.content_array.length, count[index - 1]);
      assert.equal(data.questions.length, questions);
    }
  }
});

test('reading timeline converts settings exactly as before and scores up to ten questions', async () => {
  const { ValidateSettings, defaultSettings } = await LoadModule('settings.ts');
  class Button {}
  class Reading {}
  const { BuildReadingTimeline } = await LoadModule('timeline/readingTimeline.ts', {
    '../settings': { ValidateSettings }, '../pixi-reading-training': { default: Reading },
    '@jspsych/plugin-html-button-response': { default: Button },
  });
  const timeline = BuildReadingTimeline({ ...defaultSettings, passage: 2, wordsPerMinute: 600, crowding: 300, contrast: 50 }, story, () => 0);
  assert.equal(timeline[0].type, Reading);
  assert.deepEqual(timeline[0].content_array, story.content_array);
  assert.equal(timeline[0].wps, 10);
  assert.equal(timeline[0].crowding, 3);
  assert.equal(timeline[0].contrast, -Math.log10(.5));
  assert.deepEqual(timeline[0].data, { passage_index: 2, language_code: 1 });
  const questions = timeline.slice(1);
  assert.equal(questions.length, 10);
  assert.ok(questions.every(question => question.type === Button));
  assert.equal(new Set(questions.map(question => question.data.question_index)).size, 10);
  const question = questions[0];
  assert.deepEqual(question.choices, ['A', 'B', 'C', 'D']);
  const correct = { ...question.data, response: question.data.correct_index, rt: 321 };
  question.on_finish(correct);
  assert.equal(correct.correct, true);
  assert.equal(correct.response_text, question.choices[question.data.correct_index]);
  const wrong = { ...question.data, response: (question.data.correct_index + 1) % 4 };
  question.on_finish(wrong);
  assert.equal(wrong.correct, false);
  assert.equal(BuildReadingTimeline(defaultSettings, { ...story, language: 'zh', questions: story.questions.slice(0, 3) }).length, 4);
  assert.throws(() => BuildReadingTimeline({ ...defaultSettings, crowding: 150 }, story));
  assert.throws(() => BuildReadingTimeline(defaultSettings, null));
});

test('reading saves the original numeric score fields without inventing values', async () => {
  const { BuildGameScore } = await LoadModule('score.ts');
  const { defaultSettings } = await LoadModule('settings.ts');
  const rows = [
    { trial_type: 'pixi-reading-training', reading_time: 6321, total_words: 74, presented_segments: 74,
      presentation_completed: true, passage_index: 3, language_code: 0 },
    { trial_type: 'html-button-response', question_index: 7, option_count: 4, correct_index: 2, response: 2, rt: 812, correct: true },
    { trial_type: 'html-button-response', question_index: 1, option_count: 4, correct_index: 0, response: 3, rt: 0, correct: false },
  ];
  const score = BuildGameScore(rows, { ...defaultSettings, wordsPerMinute: 300 });
  assert.equal(score.schema, 'rehab-trainer.game-score/v1');
  assert.equal(score.gameId, 'reading-training');
  assert.deepEqual(Object.keys(score.summary), legacy.score.summary.map(field => field.key));
  assert.deepEqual(score.summary, { questions: 2, correct: 1, presentationMs: 6321, wordCount: 74, configuredWpm: 300,
    presented: 74, finished: 1, passage: 3, language: 0 });
  assert.deepEqual(score.rounds.map(Object.keys), [legacy.score.columns.map(field => field.key), legacy.score.columns.map(field => field.key)]);
  assert.deepEqual(score.rounds, [
    { question: 7, correct: 1, responseMs: 812, choice: 2, expectedChoice: 2, options: 4 },
    { question: 1, correct: 0, responseMs: 0, choice: 3, expectedChoice: 0, options: 4 },
  ]);
  const empty = BuildGameScore([], defaultSettings);
  assert.deepEqual(empty.summary, { questions: 0, correct: 0, presentationMs: null, wordCount: null, configuredWpm: 240,
    presented: null, finished: null, passage: null, language: null });
  assert.deepEqual(empty.rounds, []);
  const { CalculateScoreStatistics } = await LoadModule('scoreStatistics.ts');
  assert.equal(CalculateScoreStatistics([0, null, 4]).mean, 2);
  assert.equal(CalculateScoreStatistics([0]).sampleSd, null);
  const { AcceptGameMessage } = await import('../packages/ui/src/selfContainedGame.js');
  assert.equal(AcceptGameMessage({ schema: 'trainerhub.game/v1', gameId: 'reading-training', version: '2.0.0',
    sessionNonce: 'a'.repeat(64), sequence: 0, type: 'result', payload: { config: { ...defaultSettings }, score } },
  { gameId: 'reading-training', version: '2.0.0', sessionNonce: 'a'.repeat(64), sequence: -1, complete: false }), true);
});

test('reading owns UI, dependencies, metadata and the exact original preview; the Hub excludes its bundle', async () => {
  for (const file of (await readdir(gameRoot, { recursive: true })).filter(file => /\.(tsx?|css|js)$/.test(file) && !/^(dist|node_modules)[\\/]/.test(file))) {
    assert.doesNotMatch(await readFile(resolve(gameRoot, file), 'utf8'), /@rehab-trainer\/|packages\/ui|SaveTrainingRecord|GetHostedGameSetting|import\.meta\.glob/, file);
  }
  for (const file of ['settings.json', 'score.json', 'results/ReadingResults.tsx', 'exportCsv.ts']) await assert.rejects(access(resolve(gameRoot, file)), file);
  const pkg = JSON.parse(await readFile(resolve(gameRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '2.0.2');
  for (const name of ['react', 'react-dom', 'pixi.js', 'jspsych', '@jspsych/plugin-html-button-response', 'tone']) assert.ok(pkg.dependencies[name], name);
  assert.deepEqual(pkg.rehabTrainer.capabilities, ['audio', 'fullscreen', 'keyboard', 'pointer', 'settings-storage', 'touch']);
  const hub = JSON.parse(await readFile(resolve(root, 'apps/rehabtrainerhub/package.json'), 'utf8'));
  assert.equal(hub.dependencies[pkg.name], undefined);
  const registry = JSON.parse(await readFile(resolve(root, 'packages/ui/src/officialGameReleases.json'), 'utf8'));
  assert.deepEqual(registry['reading-training'], { origin: 'https://trainerhub-user-games.pages.dev', name: '閱讀訓練（RSVP）' });
  const metadata = JSON.parse(await readFile(resolve(gameRoot, 'public/game.json'), 'utf8'));
  assert.equal(metadata.gameId, 'reading-training');
  assert.equal(metadata.trainer, 'vision'); assert.equal(metadata.category, 'vision');
  assert.equal(metadata.author, '居家訓練網');
  assert.deepEqual(metadata.copy, {
    'zh-TW': { title: '閱讀訓練（RSVP）', description: '使用快速連續視覺呈現練習閱讀速度與文章理解。' },
    en: { title: 'Reading Training (RSVP)', description: 'Use rapid serial visual presentation to practise reading speed and comprehension.' },
  });
  assert.equal(createHash('sha256').update(await readFile(resolve(gameRoot, 'public', metadata.preview))).digest('hex'),
    'a4e3de855637556467ae4c7c1b5a1d2f5479c2fc09e3f9cce0c23d534ed38cb4');
});

async function LoadPlugin({ deferred = false } = {}) {
  const timers = new Map(), listeners = new Map(), finished = [];
  let now = 0, nextId = 1, initialize;
  class Text { text = ''; anchor = { set() {} }; style = {}; get width() { return this.text.length * 10; } }
  class Graphics { clear() { return this; } rect() { return this; } fill() { return this; } }
  const app = { screen: { width: 390, height: 844 }, stage: { children: [], addChild(...items) { this.children.push(...items); } },
    renderer: { on: (name, fn) => listeners.set(`renderer:${name}`, fn), off: name => listeners.delete(`renderer:${name}`) } };
  const display = { isConnected: true };
  const pool = { pixiRuntimeScopes: { reading: 'reading-training' }, CreatePixiTrialContainer: () => ({}),
    RunPixiTrial: (_scope, _display, callback) => { initialize = () => callback(app); if (!deferred) initialize(); },
    AttachPixiTrialCanvas() {}, CleanupPixiTrial() { pool.cleaned = (pool.cleaned ?? 0) + 1; } };
  const module = await LoadModule('pixi-reading-training.ts', {
    jspsych: { ParameterType: {} }, 'pixi.js': { Text, Graphics }, './runtime/pixiPool': pool,
    './runtime/theme': { typography: { fontFamily: 'sans-serif' }, pixiColors: { white: 0xffffff } },
  }, { window: { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name), visualViewport: null },
    performance: { now: () => now },
    setTimeout: (fn, delay) => { const id = nextId++; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id) });
  const plugin = new module.default({ finishTrial: row => finished.push(row) });
  const text = () => app.stage.children.find(child => child instanceof Text);
  return { plugin, app, display, listeners, timers, finished, pool, text, initialize: () => initialize(),
    start: (trial) => plugin.trial(display, { content_array: story.content_array, wps: 2, crowding: 2, contrast: 0, ...trial }),
    advance: until => {
      for (;;) {
        const [id, timer] = [...timers].sort((left, right) => left[1].at - right[1].at)[0] ?? [];
        if (!timer || timer.at > until) { now = until; return; }
        timers.delete(id); now = timer.at; timer.fn();
      }
    } };
}

test('real RSVP timing keeps the 3-2-1 countdown, batch size, display time and completion data', async () => {
  const game = await LoadPlugin();
  game.start();
  assert.equal(game.text().text, '3');
  assert.equal(game.text().style.fill, '#000000', 'logCS 0 keeps black text.');
  game.advance(1000); assert.equal(game.text().text, '2');
  game.advance(2000); assert.equal(game.text().text, '1');
  game.advance(3000); assert.equal(game.text().text, 'one two');
  game.advance(3999); assert.equal(game.text().text, 'one two');
  game.advance(4000); assert.equal(game.text().text, 'three four');
  game.advance(5000); assert.equal(game.text().text, 'five', 'The last batch keeps its remaining token only.');
  assert.equal(game.finished.length, 0);
  game.advance(5500);
  assert.deepEqual(game.finished, [{ reading_time: 5500, total_words: 5, presented_segments: 5, presentation_completed: true }]);
  assert.equal(game.timers.size, 0); assert.equal(game.listeners.size, 0); assert.equal(game.pool.cleaned, 1);
  const faint = await LoadPlugin();
  faint.start({ contrast: -Math.log10(.2) });
  assert.equal(faint.text().style.fill, '#a0a0a0', 'Contrast 20% keeps the original gray level.');
});

test('stopping reading cancels timers and input without producing a result, even before the renderer arrives', async () => {
  for (const deferred of [false, true]) {
    const game = await LoadPlugin({ deferred });
    game.start();
    assert.ok(game.listeners.has('game:abort'));
    game.listeners.get('game:abort')();
    if (deferred) game.initialize();
    game.advance(60000);
    assert.equal(game.finished.length, 0); assert.equal(game.timers.size, 0); assert.equal(game.listeners.size, 0);
  }
  const late = await LoadPlugin({ deferred: true });
  late.start();
  late.display.isConnected = false;
  late.initialize();
  assert.equal(late.timers.size, 0); assert.equal(late.listeners.size, 0); assert.equal(late.finished.length, 0);
});

test('reading-training bridge binds once to the parent private port and ignores forged initialization and acknowledgements', async () => {
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
    schema: 'trainerhub.game/v1', type: 'init', gameId: 'reading-training', version: '2.0.0', sessionNonce: 'a'.repeat(64), language: 'en' } };
  for (const changes of [{ source: {} }, { origin: 'https://evil.example' }, { ports: [] },
    { data: { ...event.data, gameId: 'gabor-patching' } }, { data: { ...event.data, version: '1.0.0' } }, { data: { ...event.data, sessionNonce: 'invalid' } }]) {
    listeners.get('message')({ ...event, ...changes });
    assert.equal(module.exports.IsHubGame(), false);
  }
  listeners.get('message')(event);
  assert.equal(module.exports.IsHubGame(), true);
  assert.equal(module.exports.GetGameLanguage(), 'en');
  assert.equal(sent[0].type, 'ready');
  assert.equal(sent[0].gameId, 'reading-training');
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
