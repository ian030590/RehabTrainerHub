import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import migratedGames from '../packages/ui/src/officialGameReleases.json' with { type: 'json' };
import ts from 'typescript';
import { GetGameSettingsDefaults, NormalizeGameSettingsValues, ParseGameSettingsDefinition } from '../packages/game-settings/src/index.js';

const root = new URL('../apps/rehabtrainerhub/games/', import.meta.url);
const read = (id, file) => readFileSync(new URL(`${id}/${file}`, root), 'utf8');
const scoreModule = ts.transpileModule(readFileSync(new URL('../packages/ui/src/gameScore.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { ParseGameScoreDefinition } = await import(`data:text/javascript;base64,${Buffer.from(scoreModule).toString('base64')}`);
// Games written directly as R2 packages: entry component validated by the game's own settings module.
const nativeR2Games = { 'seagull-flight': 'SeagullFlightGame.tsx', sart: 'SartGame.tsx', 'schulte-grid': 'SchulteGridGame.tsx', 'hex-schulte': 'HexSchulteGame.tsx', 'continuous-performance': 'ContinuousPerformanceGame.tsx', 'simon-task': 'SimonTaskGame.tsx', 'card-sorting': 'CardSortingGame.tsx', 'attentional-blink': 'AttentionalBlinkGame.tsx', 'time-perception': 'TimePerceptionGame.tsx', 'divided-attention': 'DividedAttentionGame.tsx', 'pattern-memory': 'PatternMemoryGame.tsx', stroop: 'StroopGame.tsx', flanker: 'FlankerGame.tsx', 'go-nogo': 'GoNoGoGame.tsx', 'stop-signal': 'StopSignalGame.tsx', 'attention-network-task': 'AttentionNetworkGame.tsx', 'n-back': 'NBackLetters.tsx', 'number-letter': 'NumberLetterSwitch.tsx', 'digit-span': 'DigitSpanRecall.tsx', 'spatial-span': 'SpatialSpanRecall.tsx', 'tower-of-london': 'TowerPlanning.tsx', 'reaction-time': 'ReactionSignal.tsx', 'tic-tac-toe': 'TicTacToeGame.tsx', 'connect4': 'Connect4Game.tsx', hex: 'HexGame.tsx', 'dots-and-boxes': 'DotsAndBoxesGame.tsx', 'lights-out': 'LightsOutGame.tsx', 'sliding-puzzle': 'SlidingPuzzleGame.tsx', maze: 'MazeGame.tsx', sudoku: 'SudokuGame.tsx', 'memory-match': 'MemoryMatchGame.tsx', 'simon-says': 'SimonSaysGame.tsx', 'whack-a-mole': 'WhackAMoleGame.tsx', minesweeper: 'MinesweeperGame.tsx', antisaccade: 'AntisaccadeGame.tsx', 'keep-track': 'KeepTrackRecall.tsx', 'letter-memory': 'LetterMemoryRecall.tsx', 'plus-minus': 'PlusMinusSwitch.tsx', ufov: 'UfovGame.tsx', 'every-ball-response': 'EveryBallGame.tsx', 'tongue-catch': 'TongueCatchGame.tsx' };

test('every game exposes bounded grading settings and exact numeric score sources', () => {
  const ids = readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
  assert.equal(ids.length, 51);
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

test('fixed-length brain games expose bounded end settings', async () => {
  // These games validate their own settings now, so the bound comes from each settings module.
  const fixedLengthSettings = {
    'seagull-flight': 'durationSec',
    'every-ball-response': 'rounds',
    'tongue-catch': 'durationSec',
  };
  for (const [id, key] of Object.entries(fixedLengthSettings)) {
    const output = ts.transpileModule(read(id, 'settings.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
    const { defaultSettings, rangeSettings, ValidateSettings } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
    const limit = rangeSettings.find(field => field.key === key);
    assert.ok(limit, `${id}: ${key} setting is missing`);
    assert.ok(limit.min > 0 && defaultSettings[key] >= limit.min && defaultSettings[key] <= limit.max, id);
    assert.equal(ValidateSettings({ ...defaultSettings, [key]: limit.max + limit.step }), false, id);
  }
});

