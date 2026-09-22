import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Script } from 'node:vm';
import test from 'node:test';
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
const expFactoryGames = ['antisaccade','attention-network-task','digit-span','flanker','go-nogo','keep-track','letter-memory','n-back','number-letter','plus-minus','spatial-span','stop-signal','stroop','tower-of-london'];

function Adapter(id) {
  const window = { setStims() {}, numbers: Array.from({ length: 90 }, (_, i) => String(10 + i)), practice_numbers: Array.from({ length: 15 }, (_, i) => String(20 + i)), post_task_block: {}, add_block: { questions: Array(30).fill('') }, minus_block: { questions: Array(30).fill('') }, alternate_block: { questions: Array(30).fill('') } };
  new Script(read(id, 'public/runtime/research.js')).runInNewContext({ window });
  return window;
}
const sample = (extra = {}) => ({ exp_stage: 'test', trial_id: 'stim', trial_index: 5, rt: 350, correct: true, correct_response: 90, key_press: 90, ...extra });

test('every game exposes bounded grading settings and exact numeric score sources', () => {
  const ids = readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
  assert.equal(ids.length, 40);
  for (const id of ids) {
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
      const timed = { timing_stim: field.default, timing_response: id === 'n-back' ? 2000 : field.default };
      const numeric = { data: { trial_id: 'stim', stim_place: 'bottomleft', stim_id: '<p>G9</p>' } };
      window.rehabConfigure({ [field.key]: value }, [target, timed, numeric]);
      if (id === 'antisaccade') assert.equal(target.timing_stim, value);
      else if (id.includes('span')) assert.equal(window.stim_time, value);
      else if (id === 'tower-of-london') assert.equal(window.time_per_trial, value);
      else if (id === 'plus-minus') assert.equal(window.add_block.questions.length, value);
      else if (id === 'number-letter') { assert.equal(numeric.timing_response, value || -1); assert.equal(numeric.stimulus, '<p>G9</p>'); assert.equal(numeric.data.correct_response, 90); }
      else if (id === 'n-back' || id === 'go-nogo' || id === 'letter-memory' || id === 'keep-track') assert.equal(timed.timing_stim, value);
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
    'reaction-time': 'rounds',
    'plus-minus': 'itemsPerList',
    antisaccade: 'rounds',
    'attention-network-task': 'rounds',
    'digit-span': 'rounds',
    flanker: 'rounds',
    'go-nogo': 'rounds',
    'keep-track': 'rounds',
    'letter-memory': 'rounds',
    'n-back': 'rounds',
    'number-letter': 'rounds',
    'spatial-span': 'rounds',
    'stop-signal': 'rounds',
    stroop: 'rounds',
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
    'attention-network-task': 'stim', flanker: 'stim', 'go-nogo': 'stim', 'n-back': 'stim',
    'stop-signal': 'stim', stroop: 'stim', 'keep-track': 'response', 'letter-memory': 'response',
  };
  for (const [id, trialId] of Object.entries(formalTrialIds)) {
    const window = Adapter(id);
    assert.equal(window.rehabRoundCount([sample({ exp_stage: 'practice', trial_id: trialId }), sample({ trial_id: trialId })]), 1, id);
  }
});

test('ExpFactory projections retain analysis conditions and include real practice items', () => {
  const cases = {
    stroop: [sample({ condition: 'incongruent' }), 'condition', 1],
    flanker: [sample({ condition: 'incompatible' }), 'condition', 1],
    'attention-network-task': [sample({ flanker_type: 'incongruent', cue: 'spatial', flanker_location: 'up' }), 'cue', 3],
    'go-nogo': [sample({ correct_response: -1, key_press: 32, correct: false }), 'commission', true],
    'stop-signal': [sample({ SS_trial_type: 'stop', SS_delay: 250, key_press: -1, rt: -1, condition: 'low' }), 'stopDelayMs', 250],
    'n-back': [sample({ load: 3, stim: 'B', target: 'b' }), 'match', true],
    'digit-span': [sample({ trial_id: 'response', num_digits: 6, condition: 'reverse' }), 'load', 6],
    'spatial-span': [sample({ trial_id: 'response', num_spaces: 4, condition: 'forward' }), 'reverse', false],
    'number-letter': [sample({ condition: 'rotate_switch', stim_place: 'topleft' }), 'top', true],
  };
  const practiceGames = new Set(['stroop', 'flanker', 'attention-network-task', 'go-nogo', 'stop-signal', 'n-back']);
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
    if (id === 'stop-signal') { assert.equal(result.at(-1).correct, true); assert.equal(score.rounds.at(-1).responseMs, null); }
  }

  const stopSignal = Adapter('stop-signal').rehabResearchRows([sample({ exp_stage: 'NoSS_practice' })])[0];
  assert.equal(stopSignal.practice, true);
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

test('Tower of London emits one problem result, not accuracy per move', () => {
  const rows = Adapter('tower-of-london').rehabResearchRows([
    sample({ exp_stage:'practice', trial_id:'to_board', problem_id:'practice', num_moves_made:1, min_moves:1 }),
    sample({ exp_stage:'practice', trial_id:'feedback', correct:true, problem_time:1200 }),
    sample({ trial_id:'to_hand', problem_id:0, num_moves_made:1, min_moves:3 }),
    sample({ trial_id:'to_board', problem_id:0, num_moves_made:4, min_moves:3 }),
    sample({ trial_id:'feedback', correct:true, problem_time:4200 }),
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].practice, true);
  assert.equal(rows[1].problemMs, 4200);
  assert.equal(rows[1].moves, 4);
  assert.equal(rows[1].rt, null);
  assert.equal(SummarizeExpFactoryTrials(rows).totalTrials, 2);
});

test('React runtime retains missing RT as null and full precision in summaries', () => {
  for (const id of expFactoryGames) {
    const rows = [sample({ trial_id:'response', correct:true, rt:100.25 }), sample({ trial_id:'response', correct:false, rt:null }), sample({ trial_id:'response', correct:true, rt:101.5 })];
    const summary = SummarizeExpFactoryTrials(rows);
    assert.equal(summary.meanRtMs, 100.875, id);
    assert.ok(Math.abs(summary.accuracyPercent - (200 / 3)) < 1e-12, id);
  }
});

test('reading timeline preserves material identity and scores question responses separately', () => {
  const compiled = ts.transpileModule(read('reading-training', 'timeline/readingTimeline.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  new Script(compiled).runInNewContext({ exports, require: () => ({ default: class {} }) });
  const story = {
    passageIndex: 2, language: 'en', content_array: ['one', 'two'],
    questions: [{ question: 'Which?', options: ['A', 'B'], correct_index: 1 }],
  };
  const timeline = exports.BuildReadingTimeline({ reading: { story, wps: 4, crowding: 2, contrast: 0.5 } });
  assert.equal(timeline[0].data.passage_index, 2);
  assert.equal(timeline[0].data.language_code, 1);
  assert.equal(timeline[0].contrast, -Math.log10(0.5));
  const question = timeline[1];
  const response = { ...question.data, response: 1, rt: 321 };
  question.on_finish(response);
  const definition = ParseGameScoreDefinition(JSON.parse(read('reading-training', 'score.json')));
  const score = BuildGameScore(definition, { detailRows: [response], details: { questionCount: 1, correctCount: 1, reading_time: 4000 } });
  assert.equal(score.rounds[0].question, 1);
  assert.equal(score.rounds[0].correct, 1);
  assert.equal(score.rounds[0].responseMs, 321);
  assert.equal(score.rounds[0].options, 2);
  assert.equal(score.summary.presentationMs, 4000);
  assert.equal(score.summary.wordCount, null);
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
