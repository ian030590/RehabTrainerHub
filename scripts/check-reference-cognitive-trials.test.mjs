import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const gamesRoot = 'apps/rehabtrainerhub/games';
const cognitiveRoot = `${gamesRoot}/simon-says/runtime/cognitive`;
const trialRecordsPath = `${cognitiveRoot}/trialRecords.ts`;
const referenceGamePath = `${cognitiveRoot}/ReferenceCognitiveGame.tsx`;
const reactionPath = `${gamesRoot}/reaction-time/ReactionTimeGame.ts`;
const targetPath = `${gamesRoot}/whack-a-mole/TargetClickGame.ts`;

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

test('Hart Chart honors the configured alternation count', async () => {
  const { CreateHartChart, CreateHartDecoder } = await ImportStandaloneTypeScriptModule(`${gamesRoot}/hart-chart/logic/hartChart.ts`);
  for (const seed of [0, 1, 12345]) {
    for (const rounds of [5, 10, 30]) {
      const chart = CreateHartChart(seed);
      const result = CreateHartDecoder(chart, seed, rounds);
      assert.equal(result.tokens.filter(token => token.coordinate).length, rounds);
      for (const token of result.tokens.filter(token => token.coordinate)) {
        assert.equal(chart.find(cell => cell.row === token.coordinate.row && cell.col === token.coordinate.col)?.char, token.char);
      }
    }
  }
});

test('trial record helpers produce deterministic millisecond records', async () => {
  const {
    CreateSimonTrialRecord,
    GetElapsedMilliseconds,
  } = await ImportStandaloneTypeScriptModule(`${cognitiveRoot}/trialRecords.ts`);

  assert.equal(GetElapsedMilliseconds(100.2, 248.7), 149);
  assert.equal(GetElapsedMilliseconds(250, 200), 0);
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
  const [reference, reaction, target, trialLogic] = await Promise.all([
    readFile(`${gamesRoot}/maze/runtime/cognitive/ReferenceCognitiveGame.tsx`, 'utf8'),
    readFile(reactionPath, 'utf8'),
    readFile(targetPath, 'utf8'),
    readFile(trialRecordsPath, 'utf8'),
  ]);

  assert.match(reference, /trialJsPsychHostRef/);
  assert.match(reference, /cognitiveTrialLifecycleRef/);
  assert.match(reference, /lifecycle\.start\(\{/);
  assert.match(reference, /lifecycle\.finish\(data\)/);
  assert.doesNotMatch(reference, /\.data\.write/);
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
  assert.match(target, /if \(state\.activeIndex === null\)\s*return null/);
  assert.match(target, /state\.trials\.push\(trial\)/);

  const settings = JSON.parse(await readFile(`${gamesRoot}/reaction-time/settings.json`, 'utf8'));
  assert.ok(settings.sections.some(section => section.fields.some(field => field.type === 'slider')));
  assert.match(trialLogic, /CreateSimonState/);
  assert.match(trialLogic, /HandleSimonTap/);
  assert.match(trialLogic, /ResolveSimonAttempt\(state\.lives, false\)/);
  assert.match(trialLogic, /replaySequence:\s*true/);
  assert.doesNotMatch(trialLogic, /Math\.sin\(elapsed\s*\*\s*24\)/);
  assert.doesNotMatch(trialLogic, /state\.errors \+= 1;\s*finishGame\('Defeat'\)/);
});

test('number grids stay silent until completion and board games preserve draws', async () => {
  const numberRuntime = await readFile(`${gamesRoot}/sudoku/runtime/cognitive/ReferenceCognitiveGame.tsx`, 'utf8');
  const numberTap = SourceBetween(numberRuntime, 'function HandleCellClick', 'useEffect(');
  assert.match(numberTap, /HandleNumberGridTap\(current, index, FinishGame\)/);
  assert.match(numberTap, /current\.errors > errorsBefore\) PlayFailureSound\(\)/);
  assert.doesNotMatch(numberTap, /PlaySuccessSound/,
    'number-grid edits must not trigger per-cell success audio');

  const { CreateConnect4State, FindConnect4Line, HandleConnect4Tap, UpdateConnect4TimedState } =
    await ImportStandaloneTypeScriptModule(`${gamesRoot}/connect4/runtime/cognitive/connect4Logic.ts`);
  const fullBoard = ['PAPAPAP', 'APAPAPA', 'PAPAPAP', 'PAPAPAP', 'PAPAPAP', 'APAPAPA'].join('').split('');
  assert.equal(FindConnect4Line(fullBoard, 'P'), null);
  assert.equal(FindConnect4Line(fullBoard, 'A'), null);
  const playerDraw = CreateConnect4State();
  playerDraw.board = [...fullBoard];
  playerDraw.board[0] = null;
  const playerEndings = [];
  HandleConnect4Tap(playerDraw, 0, 1, result => playerEndings.push(result));
  assert.deepEqual([playerDraw.board[0], playerDraw.moves, playerEndings], ['P', 1, ['Draw']]);

  const aiDraw = CreateConnect4State();
  aiDraw.board = fullBoard.map(mark => mark === 'P' ? 'A' : 'P');
  aiDraw.board[0] = null;
  aiDraw.aiMoveAt = 2;
  const aiEndings = [];
  UpdateConnect4TimedState(aiDraw, 2, 'easy', result => aiEndings.push(result), () => 0);
  assert.deepEqual([aiDraw.board[0], aiDraw.aiMoves, aiEndings], ['A', 1, ['Draw']]);

  const { CreateDotsAndBoxesState, HandleDotsAndBoxesTap } =
    await ImportStandaloneTypeScriptModule(`${gamesRoot}/dots-and-boxes/runtime/cognitive/dotsAndBoxesLogic.ts`);
  const dots = CreateDotsAndBoxesState('medium');
  dots.hLines.fill('P');
  dots.vLines.fill('A');
  dots.hLines[0] = null;
  dots.boxes.fill('A');
  dots.boxes[0] = null;
  for (let index = 1; index <= 7; index += 1) dots.boxes[index] = 'P';
  dots.playerScore = 7;
  dots.aiScore = 8;
  const dotsEndings = [];
  HandleDotsAndBoxesTap(dots, 0, 1, result => dotsEndings.push(result));
  assert.deepEqual([dots.playerScore, dots.aiScore, dotsEndings], [8, 8, ['Draw']]);
});
