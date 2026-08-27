import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const cognitiveRoot = 'apps/rehabtrainerhub/training-modules/brain/pages/thinking';
const trialRecordsPath = `${cognitiveRoot}/cognitive/trialRecords.ts`;
const referenceGamePath = `${cognitiveRoot}/ReferenceCognitiveGame.tsx`;
const reactionPath = `${cognitiveRoot}/cognitive/reactionTime.ts`;
const targetPath = `${cognitiveRoot}/cognitive/targetClick.ts`;
const languageNeutralPath = `${cognitiveRoot}/cognitive/languageNeutralGames.ts`;

async function ImportStandaloneTypeScriptModule(path) {
  const source = await readFile(path, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

function SourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `missing source marker: ${startMarker}`);
  assert.ok(end > start, `missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test('trial record helpers produce deterministic millisecond records', async () => {
  const {
    CreateReactionTrialRecord,
    CreateSimonTrialRecord,
    CreateTargetTrialRecord,
    GetElapsedMilliseconds,
  } = await ImportStandaloneTypeScriptModule(trialRecordsPath);

  assert.equal(GetElapsedMilliseconds(100.2, 248.7), 149);
  assert.equal(GetElapsedMilliseconds(250, 200), 0);
  assert.deepEqual(CreateReactionTrialRecord(2, 'false-start', 1000, 1325.4), {
    trialNumber: 2,
    outcome: 'false-start',
    reactionTimeMs: 325,
  });
  assert.deepEqual(CreateTargetTrialRecord(4, 'wrong-tap', 2000, 2260, 5, 2), {
    trialNumber: 4,
    outcome: 'wrong-tap',
    reactionTimeMs: 260,
    targetIndex: 5,
    tappedIndex: 2,
  });
  assert.deepEqual(CreateSimonTrialRecord(3, 4, true, 1.25, 2.005), {
    trialNumber: 3,
    memoryLength: 4,
    correct: true,
    durationMs: 755,
  });
});

test('Simon life resolution only ends at zero and otherwise replays', async () => {
  const {
    CreateSimonState,
    HandleSimonTap,
    ResolveSimonAttempt,
  } = await ImportStandaloneTypeScriptModule(trialRecordsPath);

  assert.deepEqual(ResolveSimonAttempt(3, false), {
    livesRemaining: 2,
    replaySequence: true,
    gameOver: false,
  });
  assert.deepEqual(ResolveSimonAttempt(1, false), {
    livesRemaining: 0,
    replaySequence: false,
    gameOver: true,
  });
  assert.deepEqual(ResolveSimonAttempt(3, true), {
    livesRemaining: 3,
    replaySequence: false,
    gameOver: false,
  });

  const replayState = CreateSimonState('Beginner', 3, () => 0);
  replayState.sequence = [0, 1];
  replayState.status = 'input';
  replayState.attemptStartedAt = 1;
  const wrong = HandleSimonTap(replayState, 2, 1.42, () => 0.75);
  assert.equal(wrong.replaySequence, true);
  assert.equal(wrong.gameResult, null);
  assert.equal(replayState.lives, 2);
  assert.deepEqual(replayState.sequence, [0, 1]);
  assert.deepEqual(replayState.trials[0], {
    trialNumber: 1,
    memoryLength: 2,
    correct: false,
    durationMs: 420,
  });

  const finalLifeState = CreateSimonState('Beginner', 1, () => 0);
  finalLifeState.status = 'input';
  finalLifeState.attemptStartedAt = 2;
  const finalWrong = HandleSimonTap(finalLifeState, 3, 2.2);
  assert.equal(finalWrong.gameResult, 'Defeat');
  assert.equal(finalLifeState.lives, 0);
  assert.equal(finalLifeState.status, 'ended');
});

test('reference cognitive games persist and render complete per-trial contracts', async () => {
  const [reference, reaction, target, languageNeutral, trialLogic] = await Promise.all([
    readFile(referenceGamePath, 'utf8'),
    readFile(reactionPath, 'utf8'),
    readFile(targetPath, 'utf8'),
    readFile(languageNeutralPath, 'utf8'),
    readFile(trialRecordsPath, 'utf8'),
  ]);

  assert.match(reference, /trialJsPsychHostRef/);
  assert.match(reference, /cognitiveTrialLifecycleRef/);
  assert.match(reference, /lifecycle\.start\(\{/);
  assert.match(reference, /lifecycle\.finish\(data\)/);
  assert.doesNotMatch(reference, /\.data\.write/);
  for (const kind of ['reaction', 'target', 'simon']) {
    assert.match(reference, new RegExp(`StartCognitiveTrial\\('${kind}'\\)`));
    assert.match(reference, new RegExp(`FinishCognitiveTrial\\('${kind}'`));
  }
  assert.match(reference, /memoryLength:\s*trial\.memoryLength/);
  assert.match(reference, /correct:\s*trial\.correct/);
  assert.match(reference, /durationMs:\s*trial\.durationMs/);
  assert.match(reference, /CognitiveTrialResultsTable/);

  assert.match(reaction, /'false-start'/);
  assert.match(reaction, /'success'/);
  assert.match(reaction, /state\.trials\.push\(trial\)/);
  assert.match(target, /'hit'/);
  assert.match(target, /'expired'/);
  assert.match(target, /'wrong-tap'/);
  assert.match(target, /if \(state\.activeIndex === null\) return null/);
  assert.match(target, /state\.trials\.push\(trial\)/);

  assert.match(reference, /type="range"/);
  assert.match(reference, /<svg/);
  assert.match(languageNeutral, /CreateSimonState/);
  assert.match(languageNeutral, /HandleSimonTap/);
  assert.match(trialLogic, /ResolveSimonAttempt\(state\.lives, false\)/);
  assert.match(trialLogic, /replaySequence:\s*true/);
  assert.doesNotMatch(languageNeutral, /Math\.sin\(elapsed\s*\*\s*24\)/);
  assert.doesNotMatch(trialLogic, /state\.errors \+= 1;\s*finishGame\('Defeat'\)/);
});

test('number grids stay silent until completion and board games preserve draws', async () => {
  const source = await readFile(languageNeutralPath, 'utf8');
  const feedback = SourceBetween(
    source,
    'export function GetLanguageNeutralFeedbackCounts',
    'export function DrawLanguageNeutralGame',
  );
  assert.match(
    feedback,
    /case 'sudoku':[\s\S]*?case 'magic-square':[\s\S]*?return \{ success: 0, errors: state\.errors \}/,
    'number-grid edits must not trigger per-cell success audio',
  );

  const connect4Player = SourceBetween(source, 'function HandleConnect4Tap', 'function TakeConnect4AiTurn');
  const connect4Ai = SourceBetween(source, 'function TakeConnect4AiTurn', 'function DrawConnect4');
  assert.match(connect4Player, /state\.board\.every\(Boolean\)[\s\S]*?finishGame\('Draw'\)/);
  assert.match(connect4Ai, /state\.board\.every\(Boolean\)[\s\S]*?finishGame\?\.\('Draw'\)/);

  const hexPlayer = SourceBetween(source, 'function HandleHexTap', 'function TakeHexAiTurn');
  const hexAi = SourceBetween(source, 'function TakeHexAiTurn', 'function DrawHex');
  assert.match(hexPlayer, /state\.board\.every\(Boolean\)[\s\S]*?finishGame\('Draw'\)/);
  assert.match(hexAi, /state\.board\.every\(Boolean\)[\s\S]*?finishGame\?\.\('Draw'\)/);

  const dotsFinish = SourceBetween(source, 'function FinishDotsIfFull', 'function DrawDotsLine');
  assert.match(dotsFinish, /state\.playerScore === state\.aiScore[\s\S]*?\? 'Draw'/);
});
