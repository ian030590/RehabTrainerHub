import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const root = new URL('../apps/rehabtrainerhub/games/simon-says/', import.meta.url);

test('Simon rules describe the playable cues and optional sound', async () => {
  const source = await readFile(new URL('runtime/components/rules/BrainTrainingRulesPanel.tsx', root), 'utf8');
  assert.doesNotMatch(source, /neon bounce|hover and click|shakes the board/i);
  assert.match(source, /replays the same sequence/i);
  assert.match(source, /sound if enabled/i);
});

async function LoadSimonCore() {
  const source = await readFile(new URL('runtime/cognitive/trialRecords.ts', root), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

test('Simon keeps the configured sequence goal and replays a failed sequence', async () => {
  const { CreateSimonState, HandleSimonTap } = await LoadSimonCore();
  for (const [difficulty, targetRounds] of [['Beginner', 5], ['Intermediate', 7], ['Advanced', 9]]) {
    const state = CreateSimonState(difficulty, 3, () => 0);
    assert.equal(state.targetRounds, targetRounds);
    assert.equal(state.lives, 3);
    assert.equal(state.sequence.length, 1);
    assert.equal(HandleSimonTap(state, 0, 0.5).accepted, false, 'Playback does not accept taps');
  }

  const state = CreateSimonState('Beginner', 3, () => 0);
  state.status = 'input';
  state.attemptStartedAt = 1;
  const failed = HandleSimonTap(state, 1, 1.25, () => 0);
  assert.equal(failed.replaySequence, true);
  assert.equal(failed.gameResult, null);
  assert.equal(failed.trial?.durationMs, 250);
  assert.deepEqual(state.sequence, [0], 'A failure replays the same sequence');
  assert.equal(state.lives, 2);
  assert.equal(state.trials.length, 1);
});

test('Simon ends only after the final allowed failure or the target length', async () => {
  const { CreateSimonState, HandleSimonTap } = await LoadSimonCore();
  const defeated = CreateSimonState('Beginner', 1, () => 0);
  defeated.status = 'input';
  defeated.attemptStartedAt = 1;
  assert.equal(HandleSimonTap(defeated, 1, 1.5).gameResult, 'Defeat');
  assert.equal(defeated.lives, 0);
  assert.equal(HandleSimonTap(defeated, 0, 2).accepted, false);

  const won = CreateSimonState('Beginner', 3, () => 0);
  for (let length = 1; length <= 5; length += 1) {
    won.status = 'input';
    won.inputIndex = 0;
    won.attemptStartedAt = length;
    for (let index = 0; index < length; index += 1) {
      const response = HandleSimonTap(won, 0, length + (index + 1) / 10, () => 0);
      if (index === length - 1) assert.equal(response.gameResult, length === 5 ? 'Victory' : null);
    }
  }
  assert.equal(won.trials.length, 5);
  assert.equal(won.trials.every(trial => trial.correct), true);
});

test('Simon score keeps each sequence attempt and whole-sequence duration', async () => {
  const { BuildSimonResultData, CreateSimonState, HandleSimonTap } = await LoadSimonCore();
  const score = JSON.parse(await readFile(new URL('score.json', root), 'utf8'));
  const state = CreateSimonState('Beginner', 3, () => 0);
  state.status = 'input';
  state.attemptStartedAt = 1;
  HandleSimonTap(state, 1, 1.25, () => 0);
  state.status = 'input';
  state.attemptStartedAt = 2;
  HandleSimonTap(state, 0, 2.4, () => 0);

  const result = BuildSimonResultData(state, 4.2, 'Defeat');
  const rows = result.detailRows.map(row => Object.fromEntries(score.columns.map(field => [field.key, row[field.sources[0]]])));
  const summary = Object.fromEntries(score.summary.map(field => [field.key, result.details[field.sources[0]]]));
  assert.deepEqual(rows, [
    { trial: 1, correct: 0, length: 1, recallMs: 250 },
    { trial: 2, correct: 1, length: 1, recallMs: 400 },
  ]);
  assert.deepEqual(summary, { duration: 4.2, trials: 2, correctTrials: 1, remainingLives: 2 });
});
