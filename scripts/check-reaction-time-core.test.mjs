import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const gamePath = new URL('../apps/rehabtrainerhub/games/reaction-time/ReactionTimeGame.ts', import.meta.url);

test('reaction-time counts false starts separately and preserves score rows', async () => {
  const source = await readFile(gamePath, 'utf8');
  assert.doesNotMatch(source, /from ['"]pixi\.js['"]/, 'One visual target must work without a canvas renderer');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const {
    BuildReactionResultData,
    CreateReactionState,
    HandleReactionTap,
    IsReactionAutoSuccess,
    MarkReactionGoVisible,
    ShowReactionGo,
    StartReactionAttempt,
  } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);

  const state = CreateReactionState(2);
  assert.equal(StartReactionAttempt(state, 'medium', 1000, () => 0), 1800);
  assert.equal(state.status, 'ready');
  assert.deepEqual(HandleReactionTap(state, 1200), {
    trialNumber: 1, outcome: 'false-start', reactionTimeMs: 200,
  });
  assert.equal(IsReactionAutoSuccess(state), false);

  assert.equal(StartReactionAttempt(state, 'medium', 2000, () => 0.5), 3100);
  assert.equal(ShowReactionGo(state), true);
  assert.equal(HandleReactionTap(state, 5100), null, 'A response before the GO cue is visible is not timed');
  assert.equal(MarkReactionGoVisible(state, 5100), true);
  assert.deepEqual(HandleReactionTap(state, 5350), {
    trialNumber: 2, outcome: 'success', reactionTimeMs: 250,
  });
  assert.equal(IsReactionAutoSuccess(state), false);

  assert.equal(StartReactionAttempt(state, 'easy', 6000, () => 1), 3200);
  assert.equal(ShowReactionGo(state), true);
  assert.equal(MarkReactionGoVisible(state, 9200), true);
  assert.deepEqual(HandleReactionTap(state, 9350), {
    trialNumber: 3, outcome: 'success', reactionTimeMs: 150,
  });
  assert.equal(IsReactionAutoSuccess(state), true);

  const { details, detailRows } = BuildReactionResultData(state, 8.4, 'Victory');
  assert.equal(details.Total_Duration_Seconds, 8.4);
  assert.equal(details.Reaction_Attempts, 3);
  assert.equal(details.Reaction_Successes, 2);
  assert.equal(details.False_Starts, 1);
  assert.equal(details.Average_Reaction_Time_ms, 200);
  assert.deepEqual(detailRows.map(({ falseStart, responseMs, earlyMs }) => ({ falseStart, responseMs, earlyMs })), [
    { falseStart: 1, responseMs: null, earlyMs: 200 },
    { falseStart: 0, responseMs: 250, earlyMs: null },
    { falseStart: 0, responseMs: 150, earlyMs: null },
  ]);
});
