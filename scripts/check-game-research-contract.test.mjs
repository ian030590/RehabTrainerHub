import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Script } from 'node:vm';
import test from 'node:test';
import migratedGames from '../packages/ui/src/officialGameReleases.json' with { type: 'json' };
import ts from 'typescript';
import { GetGameSettingsDefaults, NormalizeGameSettingsValues, ParseGameSettingsDefinition } from '../packages/game-settings/src/index.js';

const root = new URL('../apps/rehabtrainerhub/games/', import.meta.url);
const read = (id, file) => readFileSync(new URL(`${id}/${file}`, root), 'utf8');
const scoreModule = ts.transpileModule(readFileSync(new URL('../packages/ui/src/gameScore.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { ParseGameScoreDefinition, BuildGameScore } = await import(`data:text/javascript;base64,${Buffer.from(scoreModule).toString('base64')}`);
const runtimeSummaryModule = ts.transpileModule(readFileSync(new URL('../packages/ui/src/expFactoryRuntime.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const {
  GetExpFactoryRoundLimit,
  HasReachedExpFactoryRoundLimit,
  SummarizeExpFactoryTrials,
} = await import(`data:text/javascript;base64,${Buffer.from(runtimeSummaryModule).toString('base64')}`);
// Games written directly as R2 packages: entry component validated by the game's own settings module.
const nativeR2Games = { sart: 'SartGame.tsx', 'schulte-grid': 'SchulteGridGame.tsx', 'hex-schulte': 'HexSchulteGame.tsx', 'continuous-performance': 'ContinuousPerformanceGame.tsx', 'simon-task': 'SimonTaskGame.tsx', 'card-sorting': 'CardSortingGame.tsx', 'attentional-blink': 'AttentionalBlinkGame.tsx', 'time-perception': 'TimePerceptionGame.tsx', 'divided-attention': 'DividedAttentionGame.tsx', 'pattern-memory': 'PatternMemoryGame.tsx', stroop: 'StroopGame.tsx', flanker: 'FlankerGame.tsx', 'go-nogo': 'GoNoGoGame.tsx', 'stop-signal': 'StopSignalGame.tsx', 'attention-network-task': 'AttentionNetworkGame.tsx', 'n-back': 'NBackLetters.tsx', 'number-letter': 'NumberLetterSwitch.tsx', 'digit-span': 'DigitSpanRecall.tsx', 'spatial-span': 'SpatialSpanRecall.tsx', 'tower-of-london': 'TowerPlanning.tsx', 'reaction-time': 'ReactionSignal.tsx' };
const expFactoryGames = ['antisaccade','keep-track','letter-memory','plus-minus'];

function Adapter(id) {
  const window = { setStims() {}, numbers: Array.from({ length: 90 }, (_, i) => String(10 + i)), practice_numbers: Array.from({ length: 15 }, (_, i) => String(20 + i)), post_task_block: {}, add_block: { questions: Array(30).fill('') }, minus_block: { questions: Array(30).fill('') }, alternate_block: { questions: Array(30).fill('') } };
  new Script(read(id, 'public/runtime/research.js')).runInNewContext({ window });
  return window;
}
const sample = (extra = {}) => ({ exp_stage: 'test', trial_id: 'stim', trial_index: 5, rt: 350, correct: true, correct_response: 90, key_press: 90, ...extra });

test('every game exposes bounded grading settings and exact numeric score sources', () => {
  const ids = readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
  assert.equal(ids.length, 50);
  for (const id of ids) {
    if (Object.hasOwn(migratedGames, id)) {
      const entry = { 'hart-chart': 'HartChartPage.tsx', 'driving-rehab': 'DrivingRehabGame.tsx', 'asteroid-shield': 'AsteroidShieldGame.tsx', 'drawing-defense': 'DrawingTowerDefenseGame.tsx',
        'gesture-battler': 'GestureBattlerGame.tsx', 'motor-cortex-rehab': 'MotorCortexRehabGame.tsx', 'moving-card': 'MovingCardGame.tsx', 'oculomotor-training': 'OculomotorTrainingGame.tsx', 'gabor-patching': 'GaborPatchingGame.tsx', 'reading-training': 'ReadingTrainingGame.tsx', ...nativeR2Games }[id];
      assert.ok(entry, `${id}: add game-owned bounds validation before migration`);
      const source = read(id, entry);
      if (Object.hasOwn(nativeR2Games, id)) {
        assert.match(source, /ValidateSettings\(settings\)/);
        assert.match(read(id, 'settings.ts'), /export function ValidateSettings\(/);
        assert.match(read(id, 'score.ts'), /export function BuildGameScore\(/);
      } else if (id === 'hart-chart') {
        assert.match(source, /ValidateSettings\(settings\)/);
        assert.match(read(id, 'settings.ts'), /settings\.rounds >= 5 && settings\.rounds <= 30/);
        assert.match(read(id, 'score.ts'), /durationMs|targets|attempts|accuracy|hints/);
      } else if (id === 'oculomotor-training') {
        const settings = read(id, 'settings.ts');
        assert.match(source, /ValidateSettings\(settings\)/);
        assert.match(settings, /value >= field\.min!/);
        assert.match(settings, /value <= \(field\.max \?\? 1e9\)/);
        assert.match(settings, /value <= 1200/);
        assert.match(source, /BuildGameScore\(completed\)/);
        assert.match(source, /SendGameEvent\('result'/);
      } else if (id === 'driving-rehab') {
        assert.match(read(id, 'settings.ts'), /ValidateSettings/);
        assert.match(source, /ValidateSettings\(settings\)/);
        assert.match(read(id, 'score.ts'), /numeric\(result\?\.average_rt\)/);
      } else if (id === 'reading-training') {
        const settings = read(id, 'settings.ts');
        assert.match(settings, /key: 'passage'.*min: 0, max: 3, step: 1/);
        assert.match(settings, /key: 'wordsPerMinute'.*min: 60, max: 600, step: 20/);
        assert.match(settings, /key: 'crowding'.*min: 100, max: 500, step: 100/);
        assert.match(settings, /key: 'contrast'.*min: 20, max: 100, step: 10/);
        assert.match(source, /ValidateSettings\(settings\)/);
        const score = read(id, 'score.ts');
        for (const key of ['reading_time', 'total_words', 'presented_segments', 'passage_index', 'language_code']) assert.match(score, new RegExp(`presentation\\?\\.${key}`));
      } else if (id === 'gabor-patching') {
        const settings = read(id, 'settings.ts');
        assert.match(settings, /key: 'durationSec'.*min: 30, max: 180, step: 15/);
        assert.match(settings, /key: 'maxSpots'.*min: 3, max: 20, step: 1/);
        assert.match(source, /ValidateSettings\(settings\)/);
        const score = read(id, 'score.ts');
        for (const key of ['score', 'acquired_targets', 'duration_ms']) assert.match(score, new RegExp(`trial\\?\\.${key} \\?\\? null`));
      } else if (id === 'moving-card') {
        const settings = read(id, 'settings.ts');
        assert.match(settings, /key: 'rounds', min: 5, max: 40, step: 5/);
        assert.match(settings, /key: 'optionCount', min: 4, max: 40/);
        assert.match(settings, /key: 'optionMoveIntervalMs', min: 200, max: 5000/);
        assert.match(source, /ValidateSettings\(settings\)/);
        const score = read(id, 'score.ts');
        for (const key of ['rt', 'attempts', 'wrong_attempts']) assert.match(score, new RegExp(`numeric\\(row\\.${key}\\)`));
      } else if (id === 'asteroid-shield') {
        const settings = read(id, 'settings.ts');
        assert.match(settings, /settings\.durationSec < 30/);
        assert.match(settings, /settings\.durationSec > 300/);
        assert.match(settings, /settings\.sensitivity < 1/);
        assert.match(settings, /settings\.sensitivity > 10/);
      } else if (id === 'gesture-battler') {
        const settings = read(id, 'config.ts');
        assert.match(settings, /enemyMaxHp >= 1/);
        assert.match(settings, /enemyMaxHp <= 100/);
        assert.match(settings, /holdDurationSec >= 0\.5/);
        assert.match(settings, /holdDurationSec <= 10/);
        assert.match(settings, /strictnessPercent >= 50/);
        assert.match(settings, /strictnessPercent <= 90/);
      } else if (id === 'motor-cortex-rehab') {
        const settings = read(id, 'config.ts');
        assert.match(settings, /targetSizePercent >= 75/);
        assert.match(settings, /targetSizePercent <= 130/);
        assert.match(settings, /speedPercent >= 70/);
        assert.match(settings, /speedPercent <= 140/);
        assert.match(settings, /\[45, 60, 90\]\.includes\(config.durationSec\)/);
        assert.match(source, /IsMotorConfig\(config\)/);
      } else {
        assert.match(source, /minRecognitionStrictness = 10/);
        assert.match(source, /maxRecognitionStrictness = 90/);
      }
      if (id !== 'oculomotor-training') assert.match(source, /SendGameResult/);
      continue;
    }
    const settings = ParseGameSettingsDefinition(JSON.parse(read(id, 'settings.json')), id);
    const fields = settings.sections.flatMap(section => section.fields);
    assert.ok(fields.length, id);
    NormalizeGameSettingsValues(settings, GetGameSettingsDefaults(settings));
    const score = ParseGameScoreDefinition(JSON.parse(read(id, 'score.json')), id);
    for (const field of [...score.columns, ...score.summary]) assert.equal(field.sources.length, 1, `${id}:${field.key} must not mix unlike measures`);
  }
});

test('ExpFactory grading applies its full allowed range and rejects malformed parameters', () => {
  for (const id of expFactoryGames) {
    const definition = JSON.parse(read(id, 'settings.json'));
    const field = definition.sections[0].fields[0];
    for (const value of [field.min, field.default, field.max]) {
      const window = Adapter(id);
      const target = { data: { trial_id: 'target' }, timing_stim: 150, timing_response: 150 };
      const timed = { timing_stim: field.default, timing_response: field.default };
      const numeric = { data: { trial_id: 'stim', stim_place: 'bottomleft', stim_id: '<p>G9</p>' } };
      window.rehabConfigure({ [field.key]: value }, [target, timed, numeric]);
      if (id === 'antisaccade') assert.equal(target.timing_stim, value);
      else if (id === 'plus-minus') assert.equal(window.add_block.questions.length, value);
      else if (id === 'letter-memory' || id === 'keep-track') assert.equal(timed.timing_stim, value);
      else assert.equal(timed.timing_response, value);
      for (const invalid of [NaN, Infinity, '1000', field.min - field.step, field.max + field.step]) assert.throws(() => window.rehabConfigure({ [field.key]: invalid }, []), id);
    }
  }
});

test('each legacy brain game removes its own post-task questionnaire', () => {
  for (const id of expFactoryGames) {
    const field = JSON.parse(read(id, 'settings.json')).sections[0].fields[0];
    const window = Adapter(id);
    const timeline = [{}, window.post_task_block, {}];
    window.rehabConfigure({ [field.key]: field.default }, timeline);
    assert.equal(timeline.includes(window.post_task_block), false, id);
  }
});

test('fixed-length brain games expose bounded end settings and stop at the selected round', () => {
  const fixedLengthSettings = {
    ufov: 'trialCount',
    'every-ball-response': 'rounds',
    'plus-minus': 'itemsPerList',
    antisaccade: 'rounds',
    'keep-track': 'rounds',
    'letter-memory': 'rounds',
  };
  for (const [id, key] of Object.entries(fixedLengthSettings)) {
    const fields = JSON.parse(read(id, 'settings.json')).sections.flatMap(section => section.fields);
    const limit = fields.find(field => field.key === key);
    assert.ok(limit, `${id}: ${key} setting is missing`);
    assert.ok(limit.min > 0 && limit.default >= limit.min && limit.default <= limit.max, id);
  }

  const whackFields = JSON.parse(read('whack-a-mole', 'settings.json')).sections.flatMap(section => section.fields);
  assert.ok(whackFields.some(field => field.key === 'durationSec'), 'whack-a-mole: duration setting is missing');
  const simonFields = JSON.parse(read('simon-says', 'settings.json')).sections.flatMap(section => section.fields);
  assert.ok(simonFields.some(field => field.key === 'difficulty'), 'simon-says: success limit is missing');
  assert.ok(simonFields.some(field => field.key === 'lives'), 'simon-says: error limit is missing');

  assert.equal(GetExpFactoryRoundLimit({ rounds: 48 }), 48);
  assert.equal(GetExpFactoryRoundLimit({}), null);
  for (const invalid of [0, -1, 1.5, '48', 10_001]) {
    assert.throws(() => GetExpFactoryRoundLimit({ rounds: invalid }));
  }
  assert.equal(HasReachedExpFactoryRoundLimit(48, 47), false);
  assert.equal(HasReachedExpFactoryRoundLimit(48, 48), true);
  assert.equal(HasReachedExpFactoryRoundLimit(48, 49), true);
  assert.equal(HasReachedExpFactoryRoundLimit(null, 999), false);

  const antisaccade = Adapter('antisaccade');
  const target = sample({ trial_id: 'target' });
  assert.equal(antisaccade.rehabRoundCount([target]), 0);
  assert.equal(antisaccade.rehabRoundCount([target, sample({ trial_id: 'mask' })]), 1);

  const formalTrialIds = {
        'keep-track': 'response', 'letter-memory': 'response',
  };
  for (const [id, trialId] of Object.entries(formalTrialIds)) {
    const window = Adapter(id);
    assert.equal(window.rehabRoundCount([sample({ exp_stage: 'practice', trial_id: trialId }), sample({ trial_id: trialId })]), 1, id);
  }
});

test('ExpFactory projections retain analysis conditions and include real practice items', () => {
  const cases = {
  };
  const practiceGames = new Set([]);
  for (const [id, [row, key, expected]] of Object.entries(cases)) {
    const window = Adapter(id);
    const result = window.rehabResearchRows([sample({ exp_stage: 'practice' }), sample({ trial_id: 'instruction' }), row]);
    const expectedLength = practiceGames.has(id) ? 2 : 1;
    assert.equal(result.length, expectedLength, id);
    assert.equal(result.at(-1)[key], expected, id);
    if (practiceGames.has(id)) assert.equal(result[0].practice, true, id);
    const score = BuildGameScore(ParseGameScoreDefinition(JSON.parse(read(id, 'score.json'))), { detailRows: result });
    assert.equal(score.rounds.length, expectedLength, id);
    assert.equal(SummarizeExpFactoryTrials(result).totalTrials, expectedLength, id);
  }
});

test('antisaccade joins target and mask without counting two trials or measuring eye latency', () => {
  const window = Adapter('antisaccade');
  const target = sample({ trial_id: 'target', rt: -1, key_press: -1, correct_response: 37, arrow_placement: 'left' });
  const mask = sample({ trial_id: 'mask', rt: 200, key_press: 37 });
  const row = window.rehabResearchRows([target, mask])[0];
  assert.equal(row.rt, 350);
  assert.equal(row.correct, true);
  assert.equal(window.rehabResearchRows([target])[0].rt, null);
  assert.equal(window.rehabResearchRows([sample({ ...target, exp_stage: 'practice' }), sample({ ...mask, exp_stage: 'practice' })])[0].practice, true);
});

test('recall and arithmetic derive item results from actual responses', () => {
  const letter = Adapter('letter-memory').rehabResearchRows(['A','B','C','D','E'].map(stimulus => sample({ stimulus })).concat(sample({ trial_id: 'response', responses: '{"Q0":"B C D E"}' })))[0];
  assert.equal(letter.correctItems, 4);
  assert.equal(letter.load, 5);
  assert.equal(letter.correct, true);
  const track = Adapter('keep-track').rehabResearchRows([sample({ category:'animals', stim:'cat' }), sample({ category:'animals', stim:'dog' }), sample({ trial_id:'response', targets:['animals'], load:1, responses:'{"Q0":"dog dog"}' })])[0];
  assert.equal(track.correctItems, 1);
  const practiceLetter = Adapter('letter-memory').rehabResearchRows(['A','B','C','D','E'].map(stimulus => sample({ exp_stage:'practice', stimulus })).concat(sample({ exp_stage:'practice', trial_id:'response', responses:'{"Q0":"B C D E"}' })))[0];
  const practiceTrack = Adapter('keep-track').rehabResearchRows([sample({ exp_stage:'practice', category:'animals', stim:'dog' }), sample({ exp_stage:'practice', trial_id:'response', targets:['animals'], load:1, responses:'{"Q0":"dog"}' })])[0];
  assert.equal(practiceLetter.practice, true);
  assert.equal(practiceTrack.practice, true);
  const arithmetic = Adapter('plus-minus');
  arithmetic.rehabConfigure({ itemsPerList: 6 }, []);
  const answers = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`Q${i}`, String(70 + i + (i % 2 ? -3 : 3))]));
  const responseTimes = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`Q${i}`, 200 + i]));
  const rows = arithmetic.rehabResearchRows([sample({ condition:'alternate', responses:JSON.stringify(answers), response_times:JSON.stringify(responseTimes) })]);
  assert.equal(rows.length, 6);
  assert.ok(rows.every(row => row.correct));
  assert.equal(rows[5].question, 6);
  assert.equal(rows[5].rt, 205);

  const practiceAnswers = Object.fromEntries(arithmetic.practice_numbers.map((value, i) => [`Q${i}`, value]));
  const practiceTimes = Object.fromEntries(arithmetic.practice_numbers.map((_, i) => [`Q${i}`, 100 + i]));
  const practice = arithmetic.rehabResearchRows([sample({ exp_stage:'practice', responses:JSON.stringify(practiceAnswers), response_times:JSON.stringify(practiceTimes) })]);
  assert.equal(practice.length, 15);
  assert.ok(practice.every(row => row.practice && row.correct));
  assert.equal(practice[0].condition, -1);
  assert.equal(practice[14].rt, 114);

  const score = BuildGameScore(ParseGameScoreDefinition(JSON.parse(read('plus-minus', 'score.json'))), { detailRows: practice.concat(rows) });
  assert.equal(score.rounds.length, 21);
  assert.deepEqual(score.rounds[0], { trial: 5, question: 1, practice: 1, setting: 6, condition: -1, correct: 1, responseMs: 100 });
  assert.equal(score.rounds[20].responseMs, 205);

  const summary = SummarizeExpFactoryTrials(practice.concat(rows));
  assert.equal(summary.totalTrials, 21);
  assert.equal(summary.correctTrials, 21);
  assert.equal(summary.meanRtMs, 2820 / 21);
});

test('React runtime retains missing RT as null and full precision in summaries', () => {
  for (const id of expFactoryGames) {
    const rows = [sample({ trial_id:'response', correct:true, rt:100.25 }), sample({ trial_id:'response', correct:false, rt:null }), sample({ trial_id:'response', correct:true, rt:101.5 })];
    const summary = SummarizeExpFactoryTrials(rows);
    assert.equal(summary.meanRtMs, 100.875, id);
    assert.ok(Math.abs(summary.accuracyPercent - (200 / 3)) < 1e-12, id);
  }
});

test('number-grid grading matches the actual rule, board and blank count', () => {
  const compiled = ts.transpileModule(read('sudoku', 'runtime/cognitive/languageNeutralGames.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  new Script(compiled).runInNewContext({ exports, require: () => ({ Shuffle: values => values }) });
  const cases = [['Beginner', 'latin-square', 4, 6], ['Intermediate', 'magic-square', 3, 6], ['Advanced', 'sudoku', 9, 50]];
  for (const [difficulty, kind, size, blanks] of cases) {
    const state = exports.CreateLanguageNeutralGameState('sudoku', difficulty);
    assert.equal(state.kind, kind);
    assert.equal(state.size, size);
    assert.equal(state.givens.filter(given => !given).length, blanks);
  }
});
