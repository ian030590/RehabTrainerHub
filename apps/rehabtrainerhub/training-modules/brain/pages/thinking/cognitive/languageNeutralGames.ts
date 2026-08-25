// Hub-owned language-neutral cognitive runtimes.
import { Application, Container, Graphics } from 'pixi.js';
import type { TFunction } from '../types';
import type {
  CognitiveGameState,
  Connect4State,
  Difficulty,
  DotsAndBoxesState,
  GameResult,
  HexState,
  MazeCell,
  MazeState,
  NumberGridState,
  ReferenceGameId,
  ResultStats,
  SimonState,
  SimonTapResult,
  SimonTrialRecord,
  TicTacToeState,
} from './types';
import { CreateSimonState, HandleSimonTap } from './trialRecords';
import {
  AddText,
  GetGridLayout,
  GetResponsiveBoardMaxSize,
  IsMobileCognitiveViewport,
  Shuffle,
} from './utils';

type ReferenceLanguageNeutralGameKind = Exclude<
  ReferenceGameId,
  'memory-match' | 'lights-out' | 'reaction-time' | 'whack-a-mole' | 'sliding-puzzle'
>;
type LanguageNeutralGameKind = ReferenceLanguageNeutralGameKind | NumberGridState['kind'];
type LanguageNeutralGameState = Extract<CognitiveGameState, { kind: LanguageNeutralGameKind }>;

const languageNeutralKinds: readonly LanguageNeutralGameKind[] = [
  'sudoku',
  'latin-square',
  'magic-square',
  'simon-says',
  'tic-tac-toe',
  'connect4',
  'dots-and-boxes',
  'hex',
  'maze',
];

const numberGridBorder = 0x000000;
const numberGridCellFill = 0xffffff;
const numberGridEntryText = '#005EB8';
const numberGridGivenText = '#000000';

const originalBlue = 0x3498db;
const originalBlueDark = 0x2980b9;
const originalBlueEdge = 0x2471a3;
const originalGreen = 0x2ecc71;
const originalRed = 0xe74c3c;
const originalRedDark = 0xc0392b;
const originalRedEdge = 0xa93226;
const originalYellow = 0xf1c40f;
const originalConnect4Yellow = 0xfacc15;
const originalConnect4Red = 0xdc143c;
const originalText = 0x2c3e50;
const originalLight = 0xecf0f1;
const originalLightMuted = 0xf5f5f5;
const originalBorder = 0xbdc3c7;
const originalGrayBorder = 0xdee2e6;
const playerColor = originalBlue;
const aiColor = originalRed;
const empty = 0;
const dotsVerticalOffset = 1300;
const aiTurnDelaySeconds = 1;
const simonLightSeconds = 0.36;
const simonLightGapSeconds = 0.14;
const simonClickAnimationSeconds = 0.18;
const directionByKey: Partial<Record<string, GridDirection>> = {
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
};

type GridDirection = { dx: number; dy: number };
const lastMazeSignatureByDifficulty: Partial<Record<Difficulty, string>> = {};

export function IsLanguageNeutralGameState(state: CognitiveGameState): state is LanguageNeutralGameState {
  return languageNeutralKinds.includes(state.kind as LanguageNeutralGameKind);
}

export function CreateLanguageNeutralGameState(
  gameId: ReferenceGameId,
  difficulty: Difficulty,
  simonLives = 3,
): LanguageNeutralGameState | null {
  switch (gameId) {
    case 'sudoku':
      return CreateMergedSudokuState(difficulty);
    case 'simon-says':
      return CreateSimonState(difficulty, simonLives);
    case 'tic-tac-toe':
      return CreateTicTacToeState(difficulty);
    case 'connect4':
      return CreateConnect4State();
    case 'dots-and-boxes':
      return CreateDotsAndBoxesState(difficulty);
    case 'hex':
      return CreateHexState(difficulty);
    case 'maze':
      return CreateMazeState(difficulty);
    default:
      return null;
  }
}

export function HandleLanguageNeutralGameTap(
  state: LanguageNeutralGameState,
  index: number,
  elapsed: number,
  finishGame: (result: GameResult) => void,
  recordSimonTrial?: (trial: SimonTrialRecord) => void,
): SimonTapResult | null {
  switch (state.kind) {
    case 'sudoku':
    case 'latin-square':
    case 'magic-square':
      HandleNumberGridTap(state, index, finishGame);
      break;
    case 'simon-says':
      {
        const result = HandleSimonTap(state, index, elapsed);
        if (result.trial) recordSimonTrial?.(result.trial);
        return result;
      }
    case 'tic-tac-toe':
      HandleTicTacToeTap(state, index, elapsed, finishGame);
      break;
    case 'connect4':
      HandleConnect4Tap(state, index, elapsed, finishGame);
      break;
    case 'dots-and-boxes':
      HandleDotsAndBoxesTap(state, index, elapsed, finishGame);
      break;
    case 'hex':
      HandleHexTap(state, index, elapsed, finishGame);
      break;
    case 'maze':
      HandleMazeTap(state, index, finishGame);
      break;
    default:
      break;
  }
  return null;
}

export function HandleLanguageNeutralGameKey(
  state: LanguageNeutralGameState,
  key: string,
  finishGame: (result: GameResult) => void,
) {
  const direction = directionByKey[key];
  if (!direction) return false;
  if (state.kind === 'maze') {
    MoveMaze(state, direction, finishGame);
    return true;
  }
  return false;
}

export function UpdateLanguageNeutralTimedState(
  state: LanguageNeutralGameState,
  elapsed: number,
  render: () => void,
  finishGame?: (result: GameResult) => void,
  onSimonInputStart?: () => void,
) {
  if (state.kind === 'tic-tac-toe') {
    if (state.aiMoveAt !== null && elapsed >= state.aiMoveAt) {
      state.aiMoveAt = null;
      TakeTicTacToeAiTurn(state, finishGame);
      render();
    }
    return;
  }
  if (state.kind === 'connect4') {
    const hadDrops = state.drops.length > 0;
    state.drops = state.drops.filter((drop) => elapsed - drop.startedAt < 0.45);
    let tookAiTurn = false;
    if (state.aiMoveAt !== null && elapsed >= state.aiMoveAt) {
      state.aiMoveAt = null;
      TakeConnect4AiTurn(state, elapsed, finishGame);
      tookAiTurn = true;
    }
    if (hadDrops || tookAiTurn || state.pendingResult) render();
    if (state.pendingResult && elapsed >= state.pendingResult.finishAt) finishGame?.(state.pendingResult.result);
    return;
  }
  if (state.kind === 'dots-and-boxes') {
    if (state.aiMoveAt !== null && elapsed >= state.aiMoveAt) {
      state.aiMoveAt = null;
      TakeDotsAndBoxesAiTurn(state, elapsed, finishGame);
      render();
    }
    return;
  }
  if (state.kind === 'hex') {
    if (state.aiMoveAt !== null && elapsed >= state.aiMoveAt) {
      state.aiMoveAt = null;
      TakeHexAiTurn(state, finishGame);
      render();
    }
    return;
  }
  if (state.kind !== 'simon-says') return;
  if (state.pressedStartedAt !== null) {
    if (elapsed - state.pressedStartedAt < simonClickAnimationSeconds) {
      render();
    } else {
      state.pressedIndex = null;
      state.pressedStartedAt = null;
      render();
    }
  }
  if (state.status !== 'showing') return;
  if (state.litIndex !== null && elapsed < state.nextStepAt) {
    render();
    return;
  }
  if (elapsed < state.nextStepAt) return;
  if (state.litIndex !== null) {
    state.litIndex = null;
    state.litStartedAt = null;
    state.nextStepAt = elapsed + simonLightGapSeconds;
    render();
    return;
  }
  if (state.showIndex < state.sequence.length) {
    state.litIndex = state.sequence[state.showIndex];
    state.litStartedAt = elapsed;
    state.showIndex += 1;
    state.nextStepAt = elapsed + simonLightSeconds;
    render();
    return;
  }
  state.status = 'input';
  state.inputIndex = 0;
  state.attemptStartedAt = elapsed;
  onSimonInputStart?.();
  render();
}

export function IsLanguageNeutralAutoSuccess(state: LanguageNeutralGameState) {
  switch (state.kind) {
    case 'sudoku':
    case 'latin-square':
    case 'magic-square':
      return IsNumberGridSolved(state);
    case 'simon-says':
      return state.trials.some((trial) => trial.correct && trial.memoryLength >= state.targetRounds);
    case 'tic-tac-toe':
      return CheckMarkWin(state.board, state.size, state.winLength, 'X');
    case 'connect4':
      return CheckConnect4Win(state.board, state.rows, state.cols, 'P');
    case 'dots-and-boxes':
      return IsDotsBoardFull(state) && state.playerScore > state.aiScore;
    case 'hex':
      return HasHexPath(state, 1);
    case 'maze':
      return state.current === state.end;
    default:
      return false;
  }
}

export function BuildLanguageNeutralResultStats(state: LanguageNeutralGameState): ResultStats {
  switch (state.kind) {
    case 'sudoku':
    case 'latin-square':
    case 'magic-square':
      return BuildNumberGridStats(state);
    case 'simon-says':
      {
        const successfulRounds = state.trials.filter((trial) => trial.correct).length;
        const totalRounds = state.trials.length;
        return {
          score: Math.max(0, successfulRounds * 120 + state.moves * 5 - state.errors * 40),
          accuracy: totalRounds > 0 ? Math.round((successfulRounds / totalRounds) * 100) : 0,
          moves: state.moves,
          attempts: totalRounds,
          success: successfulRounds,
          errors: state.errors,
          details: {
            targetRounds: state.targetRounds,
            currentRound: state.sequence.length,
            maxLives: state.maxLives,
            livesRemaining: state.lives,
          },
        };
      }
    case 'tic-tac-toe':
      return BuildBoardAiStats(state.moves, state.aiMoves, state.errors, CheckMarkWin(state.board, state.size, state.winLength, 'X'), { size: state.size, winLength: state.winLength });
    case 'connect4':
      return BuildBoardAiStats(state.moves, state.aiMoves, state.errors, CheckConnect4Win(state.board, state.rows, state.cols, 'P'), { rows: state.rows, cols: state.cols });
    case 'dots-and-boxes':
      return {
        score: Math.max(0, state.playerScore * 120 - state.aiScore * 90 - state.errors * 25),
        accuracy: state.playerScore + state.aiScore > 0 ? Math.round((state.playerScore / (state.playerScore + state.aiScore)) * 100) : 0,
        moves: state.moves,
        attempts: state.moves + state.errors,
        success: state.playerScore,
        errors: state.errors + state.aiScore,
        details: { size: state.size, playerScore: state.playerScore, aiScore: state.aiScore },
      };
    case 'hex':
      return BuildBoardAiStats(state.moves, state.aiMoves, state.errors, HasHexPath(state, 1), { size: state.size });
    case 'maze':
      return {
        score: Math.max(0, 1000 - state.moves * 8 - state.errors * 25),
        accuracy: state.moves + state.errors > 0 ? Math.round((state.moves / (state.moves + state.errors)) * 100) : 0,
        moves: state.moves,
        attempts: state.moves + state.errors,
        success: state.current === state.end ? 1 : 0,
        errors: state.errors,
        details: { size: state.size },
      };
    default:
      return { score: 0, accuracy: 0, moves: 0, attempts: 0, success: 0, errors: 0, details: {} };
  }
}

export function GetLanguageNeutralFeedbackCounts(state: LanguageNeutralGameState): { success: number; errors: number } {
  switch (state.kind) {
    case 'sudoku':
    case 'latin-square':
    case 'magic-square':
      // Number-grid entries are exploratory until the whole board is solved.
      // Keep per-cell changes silent; the completed board owns the only
      // success sound through finishGame('Victory').
      return { success: 0, errors: state.errors };
    case 'simon-says':
      return { success: state.moves, errors: state.errors };
    case 'tic-tac-toe':
    case 'connect4':
    case 'hex':
      return { success: state.moves, errors: state.errors };
    case 'dots-and-boxes':
      return { success: state.playerScore, errors: state.errors + state.aiScore };
    case 'maze':
      return { success: state.moves, errors: state.errors };
    default:
      return { success: 0, errors: 0 };
  }
}

export function DrawLanguageNeutralGame(
  app: Application,
  state: LanguageNeutralGameState,
  elapsed: number,
  onTap: (index: number) => void,
  t: TFunction,
) {
  switch (state.kind) {
    case 'sudoku':
    case 'latin-square':
    case 'magic-square':
      DrawNumberGrid(app, state, onTap, t);
      break;
    case 'simon-says':
      DrawSimon(app, state, elapsed, onTap, t);
      break;
    case 'tic-tac-toe':
      DrawTicTacToe(app, state, onTap, t);
      break;
    case 'connect4':
      DrawConnect4(app, state, onTap, t, elapsed);
      break;
    case 'dots-and-boxes':
      DrawDotsAndBoxes(app, state, onTap, t);
      break;
    case 'hex':
      DrawHex(app, state, onTap, t);
      break;
    case 'maze':
      DrawMaze(app, state, onTap, t, elapsed);
      break;
    default:
      break;
  }
}

function CreateNumberGridState(kind: NumberGridState['kind'], difficulty: Difficulty): NumberGridState {
  const diff = DifficultyIndex(difficulty);
  if (kind === 'sudoku') {
    const solution = [
      5, 3, 4, 6, 7, 8, 9, 1, 2,
      6, 7, 2, 1, 9, 5, 3, 4, 8,
      1, 9, 8, 3, 4, 2, 5, 6, 7,
      8, 5, 9, 7, 6, 1, 4, 2, 3,
      4, 2, 6, 8, 5, 3, 7, 9, 1,
      7, 1, 3, 9, 2, 4, 8, 5, 6,
      9, 6, 1, 5, 3, 7, 2, 8, 4,
      2, 8, 7, 4, 1, 9, 6, 3, 5,
      3, 4, 5, 2, 8, 6, 1, 7, 9,
    ];
    return MaskNumberGrid('sudoku', 9, solution, [34, 42, 50][diff], 3);
  }
  if (kind === 'latin-square') {
    const size = [4, 5, 6][diff];
    const solution = Array.from({ length: size * size }, (_, index) => ((Math.floor(index / size) + index) % size) + 1);
    return MaskNumberGrid('latin-square', size, solution, [6, 11, 18][diff]);
  }
  if (kind === 'magic-square') {
    return MaskNumberGrid('magic-square', 3, [8, 1, 6, 3, 5, 7, 4, 9, 2], [4, 6, 7][diff]);
  }
  throw new Error(`Unsupported number grid kind: ${kind}`);
}

function CreateMergedSudokuState(difficulty: Difficulty): NumberGridState {
  if (difficulty === 'Beginner') return CreateNumberGridState('latin-square', difficulty);
  if (difficulty === 'Intermediate') return CreateNumberGridState('magic-square', difficulty);
  return CreateNumberGridState('sudoku', difficulty);
}

function MaskNumberGrid(kind: NumberGridState['kind'], size: number, solution: number[], blanks: number, boxSize?: number): NumberGridState {
  const values = [...solution];
  const givens = Array.from({ length: solution.length }, () => true);
  Shuffle(Array.from({ length: solution.length }, (_, index) => index)).slice(0, blanks).forEach((index) => {
    values[index] = empty;
    givens[index] = false;
  });
  return { kind, size, boxSize, solution, values, givens, moves: 0, errors: 0 };
}

function HandleNumberGridTap(state: NumberGridState, index: number, finishGame: (result: GameResult) => void) {
  if (state.givens[index]) return;
  const emptyValue = empty;
  const maxValue = state.kind === 'magic-square' ? state.size * state.size : state.size;
  const current = state.values[index];
  state.values[index] = current >= maxValue ? emptyValue : current + 1;
  state.moves += 1;
  if (IsNumberGridSolved(state)) {
    finishGame('Victory');
    return;
  }
  if (state.values.every((value) => value !== emptyValue)) state.errors += 1;
}

function IsNumberGridSolved(state: NumberGridState) {
  return state.values.every((value, index) => value === state.solution[index]);
}

function CountCorrectEditableCells(state: NumberGridState) {
  return state.values.reduce((total, value, index) => total + (!state.givens[index] && value === state.solution[index] ? 1 : 0), 0);
}

function BuildNumberGridStats(state: NumberGridState): ResultStats {
  const editable = state.givens.filter((given) => !given).length;
  const correct = CountCorrectEditableCells(state);
  return {
    score: Math.max(0, correct * 60 - state.errors * 30 - state.moves),
    accuracy: editable > 0 ? Math.round((correct / editable) * 100) : 0,
    moves: state.moves,
    attempts: state.moves,
    success: correct,
    errors: state.errors + (editable - correct),
    details: { variant: state.kind, size: state.size, solved: IsNumberGridSolved(state) },
  };
}

function DrawNumberGrid(app: Application, state: NumberGridState, onTap: (index: number) => void, _t: TFunction) {
  const emptyValue = empty;
  const preferred = state.kind === 'sudoku' ? 50 : state.size >= 8 ? 46 : 74;
  const { cell, gap, startX, startY } = GetGridLayout(app, state.size, state.size, preferred, 0);
  state.values.forEach((value, index) => {
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    const node = InteractiveNode(onTap, index);
    node.x = startX + col * (cell + gap);
    node.y = startY + row * (cell + gap);
    const given = state.givens[index];
    const g = new Graphics();
    g.rect(0, 0, cell, cell).fill(numberGridCellFill);
    node.addChild(g);
    if (value !== emptyValue) {
      AddText(node, String(value), cell / 2, cell / 2, {
        fontSize: Math.max(18, cell * 0.42),
        fontWeight: given ? '900' : '700',
        fill: given ? numberGridGivenText : numberGridEntryText,
      });
    }
    app.stage.addChild(node);
  });
  DrawNumberGridLines(app, startX, startY, cell, state.size, state.kind === 'sudoku' ? (state.boxSize ?? 3) : state.size);
}

function DrawNumberGridLines(app: Application, startX: number, startY: number, cell: number, size: number, majorEvery: number) {
  const boardSize = cell * size;
  const minor = new Graphics();
  const major = new Graphics();

  for (let index = 0; index <= size; index += 1) {
    const position = index * cell;
    const target = index % majorEvery === 0 ? major : minor;
    target.moveTo(startX + position, startY).lineTo(startX + position, startY + boardSize);
    target.moveTo(startX, startY + position).lineTo(startX + boardSize, startY + position);
  }

  minor.stroke({ color: numberGridBorder, width: 1 });
  major.stroke({ color: numberGridBorder, width: 4 });
  app.stage.addChild(minor);
  app.stage.addChild(major);
}

function DrawSimon(app: Application, state: SimonState, elapsed: number, onTap: (index: number) => void, _t: TFunction) {
  const boardMax = GetResponsiveBoardMaxSize(app);
  const boardSize = Math.floor(Math.min(IsMobileCognitiveViewport(app) ? Number.POSITIVE_INFINITY : 320, boardMax.width, boardMax.height));
  const buttonSize = boardSize * (150 / 320);
  const gap = boardSize - buttonSize * 2;
  const startX = (app.renderer.width - boardSize) / 2;
  const startY = (app.renderer.height - boardSize) / 2;
  const buttons = [
    { color: originalGreen, activeColor: 0x58d68d, corner: 'top-left' as const },
    { color: originalRed, activeColor: 0xec7063, corner: 'top-right' as const },
    { color: originalYellow, activeColor: 0xf4d03f, corner: 'bottom-left' as const },
    { color: originalBlue, activeColor: 0x5dade2, corner: 'bottom-right' as const },
  ];

  buttons.forEach((button, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    DrawSimonButton(
      app,
      startX + col * (buttonSize + gap),
      startY + row * (buttonSize + gap),
      buttonSize,
      button.corner,
      state.litIndex === index ? button.activeColor : button.color,
      state.litIndex === index,
      state.litStartedAt,
      state.pressedIndex === index,
      state.pressedStartedAt,
      state.status === 'input',
      elapsed,
      index,
      onTap,
    );
  });

  const center = new Graphics();
  center.circle(app.renderer.width / 2, app.renderer.height / 2, boardSize * (50 / 320)).fill(originalText);
  app.stage.addChild(center);
}

function CreateTicTacToeState(difficulty: Difficulty): TicTacToeState {
  const diff = DifficultyIndex(difficulty);
  const size = [3, 4, 5][diff];
  return {
    kind: 'tic-tac-toe',
    size,
    winLength: diff === 2 ? 4 : 3,
    board: Array.from({ length: size * size }, () => null),
    aiMoveAt: null,
    moves: 0,
    aiMoves: 0,
    errors: 0,
  };
}

function HandleTicTacToeTap(state: TicTacToeState, index: number, elapsed: number, finishGame: (result: GameResult) => void) {
  if (state.aiMoveAt !== null) return;
  if (state.board[index]) {
    state.errors += 1;
    return;
  }
  state.board[index] = 'X';
  state.moves += 1;
  if (CheckMarkWin(state.board, state.size, state.winLength, 'X')) {
    finishGame('Victory');
    return;
  }
  if (state.board.every(Boolean)) {
    finishGame('Draw');
    return;
  }
  state.aiMoveAt = elapsed + aiTurnDelaySeconds;
}

function TakeTicTacToeAiTurn(state: TicTacToeState, finishGame?: (result: GameResult) => void) {
  const aiMove = ChooseTicTacToeMove(state);
  if (aiMove !== null) {
    state.board[aiMove] = 'O';
    state.aiMoves += 1;
  }
  if (CheckMarkWin(state.board, state.size, state.winLength, 'O')) {
    finishGame?.('Defeat');
    return;
  }
  if (state.board.every(Boolean)) finishGame?.('Draw');
}

function DrawTicTacToe(app: Application, state: TicTacToeState, onTap: (index: number) => void, _t: TFunction) {
  const padding = 10;
  const { cell, gap, startX, startY } = GetGridLayout(app, state.size, state.size, 60, 5, padding);
  const board = new Graphics();
  board.rect(
    startX - padding,
    startY - padding,
    state.size * cell + (state.size - 1) * gap + padding * 2,
    state.size * cell + (state.size - 1) * gap + padding * 2,
  ).fill(0xffffff);
  app.stage.addChild(board);

  state.board.forEach((mark, index) => {
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    const node = InteractiveNode(onTap, index);
    node.x = startX + col * (cell + gap);
    node.y = startY + row * (cell + gap);
    const g = new Graphics();
    g.rect(0, 0, cell, cell).fill(0xffffff).stroke({ color: 0x333333, width: 2 });
    node.addChild(g);
    if (mark) {
      AddText(node, mark, cell / 2, cell / 2, {
        fontSize: Math.max(24, cell * 0.4),
        fontWeight: '400',
        fill: '#2c3e50',
      });
    }
    app.stage.addChild(node);
  });
}

function CreateConnect4State(): Connect4State {
  return {
    kind: 'connect4',
    rows: 6,
    cols: 7,
    board: Array.from({ length: 42 }, () => null),
    drops: [],
    winningLine: [],
    pendingResult: null,
    aiMoveAt: null,
    moves: 0,
    aiMoves: 0,
    errors: 0,
  };
}

function HandleConnect4Tap(state: Connect4State, index: number, elapsed: number, finishGame: (result: GameResult) => void) {
  if (state.drops.length > 0 || state.pendingResult || state.aiMoveAt !== null) return;
  const col = index % state.cols;
  const playerRow = DropConnect4Disc(state, col, 'P');
  if (playerRow === null) {
    state.errors += 1;
    return;
  }
  state.drops.push({ index: playerRow * state.cols + col, mark: 'P', startedAt: elapsed });
  state.moves += 1;
  const playerLine = FindConnect4Line(state.board, state.rows, state.cols, 'P');
  if (playerLine) {
    QueueConnect4Result(state, 'Victory', elapsed, playerLine);
    return;
  }
  if (state.board.every(Boolean)) {
    finishGame('Draw');
    return;
  }
  state.aiMoveAt = elapsed + aiTurnDelaySeconds;
}

function TakeConnect4AiTurn(
  state: Connect4State,
  elapsed: number,
  finishGame?: (result: GameResult) => void,
) {
  const aiCol = ChooseConnect4Move(state);
  if (aiCol !== null) {
    const aiRow = DropConnect4Disc(state, aiCol, 'A');
    if (aiRow !== null) state.drops.push({ index: aiRow * state.cols + aiCol, mark: 'A', startedAt: elapsed });
    state.aiMoves += 1;
  }
  const aiLine = FindConnect4Line(state.board, state.rows, state.cols, 'A');
  if (aiLine) QueueConnect4Result(state, 'Defeat', elapsed, aiLine);
  else if (state.board.every(Boolean)) finishGame?.('Draw');
}

function DrawConnect4(app: Application, state: Connect4State, onTap: (index: number) => void, _t: TFunction, elapsed = 0) {
  const { cell, gap, startX, startY } = GetGridLayout(app, state.cols, state.rows, 50, 10);
  const dropping = new Set(state.drops.map((drop) => drop.index));
  state.board.forEach((disc, index) => {
    const row = Math.floor(index / state.cols);
    const col = index % state.cols;
    const node = InteractiveNode(onTap, col);
    node.x = startX + col * (cell + gap);
    node.y = startY + row * (cell + gap);
    const g = new Graphics();
    g.circle(cell / 2, cell / 2, cell / 2).fill(disc && !dropping.has(index) ? Connect4Color(disc) : 0xffffff);
    if (state.winningLine.includes(index)) {
      g.circle(cell / 2, cell / 2, cell / 2 - 3).stroke({ color: 0x111827, width: Math.max(3, cell * 0.08), alpha: 0.95 });
    }
    node.addChild(g);
    app.stage.addChild(node);
  });
  state.drops.forEach((drop) => {
    const row = Math.floor(drop.index / state.cols);
    const col = drop.index % state.cols;
    const progress = Math.min(1, Math.max(0, (elapsed - drop.startedAt) / 0.45));
    const eased = 1 - (1 - progress) ** 3;
    const disc = new Graphics();
    disc.circle(0, 0, cell / 2).fill(Connect4Color(drop.mark));
    const targetY = startY + row * (cell + gap) + cell / 2;
    disc.x = startX + col * (cell + gap) + cell / 2;
    disc.y = startY - cell / 2 + (targetY - (startY - cell / 2)) * eased;
    app.stage.addChild(disc);
  });
  if (state.winningLine.length >= 4) {
    const first = state.winningLine[0];
    const last = state.winningLine[state.winningLine.length - 1];
    const startRow = Math.floor(first / state.cols);
    const startCol = first % state.cols;
    const endRow = Math.floor(last / state.cols);
    const endCol = last % state.cols;
    const lineProgress = state.pendingResult
      ? Math.min(1, Math.max(0, (elapsed - (state.pendingResult.finishAt - 1.2)) / 0.7))
      : 1;
    const x1 = startX + startCol * (cell + gap) + cell / 2;
    const y1 = startY + startRow * (cell + gap) + cell / 2;
    const x2 = startX + endCol * (cell + gap) + cell / 2;
    const y2 = startY + endRow * (cell + gap) + cell / 2;
    const line = new Graphics();
    line.moveTo(x1, y1)
      .lineTo(x1 + (x2 - x1) * lineProgress, y1 + (y2 - y1) * lineProgress)
      .stroke({ color: 0x111827, width: Math.max(6, cell * 0.12), alpha: 0.9 });
    app.stage.addChild(line);
  }
}

function CreateDotsAndBoxesState(difficulty: Difficulty): DotsAndBoxesState {
  const size = [4, 5, 6][DifficultyIndex(difficulty)];
  return {
    kind: 'dots-and-boxes',
    size,
    hLines: Array.from({ length: size * (size - 1) }, () => null),
    vLines: Array.from({ length: (size - 1) * size }, () => null),
    boxes: Array.from({ length: (size - 1) * (size - 1) }, () => null),
    aiMoveAt: null,
    moves: 0,
    aiMoves: 0,
    errors: 0,
    playerScore: 0,
    aiScore: 0,
  };
}

function HandleDotsAndBoxesTap(state: DotsAndBoxesState, index: number, elapsed: number, finishGame: (result: GameResult) => void) {
  if (state.aiMoveAt !== null) return;
  const move = ParseDotsLineIndex(state, index);
  if (!move || IsDotsLineDrawn(state, move.horizontal, move.index)) {
    state.errors += 1;
    return;
  }
  SetDotsLine(state, move.horizontal, move.index, 'P');
  const completed = ClaimDotsBoxes(state, move.horizontal, move.index, 'P');
  state.playerScore += completed;
  state.moves += 1;
  if (FinishDotsIfFull(state, finishGame)) return;
  if (completed > 0) return;
  state.aiMoveAt = elapsed + aiTurnDelaySeconds;
}

function TakeDotsAndBoxesAiTurn(
  state: DotsAndBoxesState,
  elapsed: number,
  finishGame?: (result: GameResult) => void,
) {
  if (IsDotsBoardFull(state)) return;
  const aiMove = ChooseDotsMove(state);
  if (!aiMove) return;
  SetDotsLine(state, aiMove.horizontal, aiMove.index, 'A');
  const aiCompleted = ClaimDotsBoxes(state, aiMove.horizontal, aiMove.index, 'A');
  state.aiScore += aiCompleted;
  state.aiMoves += 1;
  if (finishGame && FinishDotsIfFull(state, finishGame)) return;
  if (aiCompleted > 0) state.aiMoveAt = elapsed + aiTurnDelaySeconds;
}

function DrawDotsAndBoxes(app: Application, state: DotsAndBoxesState, onTap: (index: number) => void, _t: TFunction) {
  const padding = 16;
  const boardSpan = state.size - 1;
  const { cell, startX, startY } = GetGridLayout(app, boardSpan, boardSpan, 72, 0, padding);
  const board = new Graphics();
  board.rect(
    startX - padding,
    startY - padding,
    (state.size - 1) * cell + padding * 2,
    (state.size - 1) * cell + padding * 2,
  ).fill(originalLightMuted).stroke({ color: originalGrayBorder, width: 2 });
  app.stage.addChild(board);

  for (let row = 0; row < state.size - 1; row += 1) {
    for (let col = 0; col < state.size - 1; col += 1) {
      const owner = state.boxes[row * (state.size - 1) + col];
      if (!owner) continue;
      const g = new Graphics();
      g.rect(startX + col * cell + 8, startY + row * cell + 8, cell - 16, cell - 16)
        .fill({ color: owner === 'P' ? originalBlue : originalRed, alpha: 0.4 });
      app.stage.addChild(g);
    }
  }
  state.hLines.forEach((owner, index) => {
    const row = Math.floor(index / (state.size - 1));
    const col = index % (state.size - 1);
    DrawDotsLine(app, startX + col * cell, startY + row * cell, startX + (col + 1) * cell, startY + row * cell, owner, index, onTap);
  });
  state.vLines.forEach((owner, index) => {
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    DrawDotsLine(app, startX + col * cell, startY + row * cell, startX + col * cell, startY + (row + 1) * cell, owner, dotsVerticalOffset + index, onTap);
  });
  for (let row = 0; row < state.size; row += 1) {
    for (let col = 0; col < state.size; col += 1) {
      const dot = new Graphics();
      dot.circle(startX + col * cell, startY + row * cell, 5).fill(originalText);
      app.stage.addChild(dot);
    }
  }
}

function CreateHexState(difficulty: Difficulty): HexState {
  const size = [5, 7, 9][DifficultyIndex(difficulty)];
  return { kind: 'hex', size, board: Array.from({ length: size * size }, () => 0), aiMoveAt: null, moves: 0, aiMoves: 0, errors: 0 };
}

function HandleHexTap(state: HexState, index: number, elapsed: number, finishGame: (result: GameResult) => void) {
  if (state.aiMoveAt !== null) return;
  if (state.board[index] !== 0) {
    state.errors += 1;
    return;
  }
  state.board[index] = 1;
  state.moves += 1;
  if (HasHexPath(state, 1)) {
    finishGame('Victory');
    return;
  }
  if (state.board.every(Boolean)) {
    finishGame('Draw');
    return;
  }
  state.aiMoveAt = elapsed + aiTurnDelaySeconds;
}

function TakeHexAiTurn(state: HexState, finishGame?: (result: GameResult) => void) {
  const aiMove = ChooseHexMove(state);
  if (aiMove !== null) {
    state.board[aiMove] = 2;
    state.aiMoves += 1;
  }
  if (HasHexPath(state, 2)) finishGame?.('Defeat');
  else if (state.board.every(Boolean)) finishGame?.('Draw');
}

function DrawHex(app: Application, state: HexState, onTap: (index: number) => void, _t: TFunction) {
  const boardMax = GetResponsiveBoardMaxSize(app);
  const horizontalFactor = (state.size * 1.5 - 0.5) * Math.sqrt(3);
  const verticalFactor = state.size * 1.5 + 0.5;
  const edgePadding = 24;
  const radius = Math.floor(Math.max(8, Math.min(
    (boardMax.width - edgePadding) / horizontalFactor,
    (boardMax.height - edgePadding) / verticalFactor,
  )));
  const width = radius * Math.sqrt(3);
  const boardWidth = horizontalFactor * radius;
  const boardHeight = verticalFactor * radius;
  const startX = (app.renderer.width - boardWidth) / 2 + width / 2;
  const startY = (app.renderer.height - boardHeight) / 2 + radius;
  const edge = new Graphics();
  edge.rect(startX - width / 2, startY - radius - 12, boardWidth, 6).fill(originalBlue);
  edge.rect(startX - width / 2, startY + boardHeight - radius + 6, boardWidth, 6).fill(originalBlueDark);
  edge.rect(startX - width / 2 - 12, startY - radius, 6, boardHeight).fill(originalRed);
  edge.rect(startX + boardWidth - width / 2 + 6, startY - radius, 6, boardHeight).fill(originalRedDark);
  app.stage.addChild(edge);

  state.board.forEach((value, index) => {
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    const cx = startX + col * width + row * (width / 2);
    const cy = startY + row * (radius * 1.5);
    const node = InteractiveNode(onTap, index);
    node.x = cx;
    node.y = cy;
    const g = new Graphics();
    DrawHexagon(g, 0, 0, radius)
      .fill(value === 1 ? playerColor : value === 2 ? aiColor : originalLight)
      .stroke({ color: value === 1 ? originalBlueEdge : value === 2 ? originalRedEdge : originalBorder, width: 2 });
    node.addChild(g);
    app.stage.addChild(node);
  });
}

function CreateMazeState(difficulty: Difficulty): MazeState {
  const size = [8, 10, 12][DifficultyIndex(difficulty)];
  let state = CreateRandomMazeState(size);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const signature = GetMazeSignature(state);
    if (signature !== lastMazeSignatureByDifficulty[difficulty]) {
      lastMazeSignatureByDifficulty[difficulty] = signature;
      return state;
    }
    state = CreateRandomMazeState(size);
  }
  lastMazeSignatureByDifficulty[difficulty] = GetMazeSignature(state);
  return state;
}

function CreateRandomMazeState(size: number): MazeState {
  const start = Math.floor(Math.random() * size * size);
  const cells = GenerateMaze(size, start);
  return {
    kind: 'maze',
    size,
    cells,
    current: start,
    end: FindFarthestMazeIndex(cells, size, start),
    moves: 0,
    errors: 0,
  };
}

function GetMazeSignature(state: MazeState) {
  return `${state.current}:${state.end}:${state.cells.map((cell) => (
    `${cell.top ? 1 : 0}${cell.right ? 1 : 0}${cell.bottom ? 1 : 0}${cell.left ? 1 : 0}`
  )).join('')}`;
}

function HandleMazeTap(state: MazeState, index: number, finishGame: (result: GameResult) => void) {
  const currentRow = Math.floor(state.current / state.size);
  const currentCol = state.current % state.size;
  const targetRow = Math.floor(index / state.size);
  const targetCol = index % state.size;
  MoveMaze(state, { dx: targetCol - currentCol, dy: targetRow - currentRow }, finishGame);
}

function MoveMaze(state: MazeState, direction: GridDirection, finishGame: (result: GameResult) => void) {
  const row = Math.floor(state.current / state.size);
  const col = state.current % state.size;
  const nextRow = row + direction.dy;
  const nextCol = col + direction.dx;
  const next = nextRow * state.size + nextCol;
  if (nextRow < 0 || nextRow >= state.size || nextCol < 0 || nextCol >= state.size || !CanMoveMaze(state, state.current, next)) {
    state.errors += 1;
    return;
  }
  state.current = next;
  state.moves += 1;
  if (state.current === state.end) finishGame('Victory');
}

function DrawMaze(app: Application, state: MazeState, onTap: (index: number) => void, _t: TFunction, _elapsed: number) {
  const { cell, startX, startY } = GetGridLayout(app, state.size, state.size, 42, 0);
  const board = new Graphics();
  board.rect(startX, startY, state.size * cell, state.size * cell).fill(0xffffff).stroke({ color: 0x333333, width: 2 });
  app.stage.addChild(board);

  state.cells.forEach((mazeCell, index) => {
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    const node = InteractiveNode(onTap, index);
    node.x = startX + col * cell;
    node.y = startY + row * cell;
    const bg = new Graphics();
    bg.rect(0, 0, cell, cell).fill(index === state.end ? 0x4caf50 : 0xffffff);
    bg.moveTo(0, 0);
    if (mazeCell.top) bg.lineTo(cell, 0);
    else bg.moveTo(cell, 0);
    if (mazeCell.right) bg.lineTo(cell, cell);
    else bg.moveTo(cell, cell);
    if (mazeCell.bottom) bg.lineTo(0, cell);
    else bg.moveTo(0, cell);
    if (mazeCell.left) bg.lineTo(0, 0);
    bg.stroke({ color: 0x333333, width: 2 });
    if (index === state.current) bg.rect(cell * 0.25, cell * 0.25, cell * 0.5, cell * 0.5).fill(0xff0000);
    node.addChild(bg);
    app.stage.addChild(node);
  });
}

function BuildBoardAiStats(moves: number, aiMoves: number, errors: number, won: boolean, details: Record<string, unknown>): ResultStats {
  return {
    score: Math.max(0, (won ? 800 : 250) + moves * 10 - aiMoves * 8 - errors * 25),
    accuracy: moves + errors > 0 ? Math.round((moves / (moves + errors)) * 100) : 0,
    moves,
    attempts: moves + errors,
    success: won ? 1 : 0,
    errors,
    details,
  };
}

function DifficultyIndex(difficulty: Difficulty) {
  if (difficulty === 'Beginner') return 0;
  if (difficulty === 'Intermediate') return 1;
  return 2;
}

function InteractiveNode(onTap: (index: number) => void, index: number) {
  const node = new Container();
  node.eventMode = 'static';
  node.cursor = 'pointer';
  node.on('pointertap', () => onTap(index));
  return node;
}

function DrawSimonButton(
  app: Application,
  x: number,
  y: number,
  size: number,
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
  color: number,
  active: boolean,
  litStartedAt: number | null,
  pressed: boolean,
  pressedStartedAt: number | null,
  interactive: boolean,
  elapsed: number,
  index: number,
  onTap: (index: number) => void,
) {
  const node = new Container();
  const g = new Graphics();
  const r = size;
  const lightProgress = active && litStartedAt !== null
    ? Math.min(1, Math.max(0, (elapsed - litStartedAt) / simonLightSeconds))
    : 1;
  const clickProgress = pressed && pressedStartedAt !== null
    ? Math.min(1, Math.max(0, (elapsed - pressedStartedAt) / simonClickAnimationSeconds))
    : 1;
  const lightBounce = active ? Math.sin(lightProgress * Math.PI) : 0;
  const clickBounce = pressed ? Math.sin(clickProgress * Math.PI) : 0;
  const baseScale = 1 + lightBounce * 0.1 - clickBounce * 0.07;
  const centerX = x + size / 2;
  const centerY = y + size / 2;

  node.pivot.set(centerX, centerY);
  node.position.set(centerX, centerY);
  node.scale.set(baseScale);
  if (interactive) {
    node.eventMode = 'static';
    node.cursor = 'pointer';
    node.on('pointerover', () => node.scale.set(baseScale * 1.04));
    node.on('pointerout', () => node.scale.set(baseScale));
    node.on('pointertap', () => onTap(index));
  }

  if (active) {
    const glow = new Graphics();
    glow.roundRect(x - size * 0.08, y - size * 0.08, size * 1.16, size * 1.16, size * 0.2)
      .fill({ color, alpha: 0.24 })
      .stroke({ color: 0xffffff, width: 5, alpha: 0.88 });
    node.addChild(glow);
  }

  if (corner === 'top-left') {
    g.moveTo(x + r, y).lineTo(x + size, y).lineTo(x + size, y + size).lineTo(x, y + size).lineTo(x, y + r)
      .arc(x + r, y + r, r, Math.PI, Math.PI * 1.5).closePath();
  } else if (corner === 'top-right') {
    g.moveTo(x, y).lineTo(x + size - r, y)
      .arc(x + size - r, y + r, r, Math.PI * 1.5, Math.PI * 2)
      .lineTo(x + size, y + size).lineTo(x, y + size).closePath();
  } else if (corner === 'bottom-left') {
    g.moveTo(x, y).lineTo(x + size, y).lineTo(x + size, y + size).lineTo(x + r, y + size)
      .arc(x + r, y + size - r, r, Math.PI / 2, Math.PI)
      .lineTo(x, y).closePath();
  } else {
    g.moveTo(x, y).lineTo(x + size, y).lineTo(x + size, y + size - r)
      .arc(x + size - r, y + size - r, r, 0, Math.PI / 2)
      .lineTo(x, y + size).closePath();
  }

  g.fill({ color, alpha: active ? 1 : pressed ? 0.82 : 0.55 })
    .stroke({ color: active || pressed ? 0xffffff : 0x333333, width: active ? 7 : pressed ? 6 : 4 });
  node.addChild(g);
  if (pressed) {
    const clickFlash = new Graphics();
    clickFlash.roundRect(x + size * 0.1, y + size * 0.1, size * 0.8, size * 0.8, size * 0.16)
      .stroke({ color: 0xffffff, width: 5, alpha: 1 - clickProgress });
    node.addChild(clickFlash);
  }
  app.stage.addChild(node);
}

function CheckMarkWin(board: Array<string | null>, size: number, winLength: number, mark: string) {
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]] as const;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (board[row * size + col] !== mark) continue;
      for (const [dx, dy] of directions) {
        let count = 1;
        for (let step = 1; step < winLength; step += 1) {
          const nextRow = row + dy * step;
          const nextCol = col + dx * step;
          if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size || board[nextRow * size + nextCol] !== mark) break;
          count += 1;
        }
        if (count >= winLength) return true;
      }
    }
  }
  return false;
}

function ChooseTicTacToeMove(state: TicTacToeState) {
  const empty = state.board.map((mark, index) => (mark ? null : index)).filter((index): index is number => index !== null);
  return FindWinningTicTacToeMove(state, 'O', empty)
    ?? FindWinningTicTacToeMove(state, 'X', empty)
    ?? empty.find((index) => index === Math.floor(state.board.length / 2))
    ?? empty[Math.floor(Math.random() * empty.length)]
    ?? null;
}

function FindWinningTicTacToeMove(state: TicTacToeState, mark: 'X' | 'O', empty: number[]) {
  return empty.find((index) => {
    state.board[index] = mark;
    const won = CheckMarkWin(state.board, state.size, state.winLength, mark);
    state.board[index] = null;
    return won;
  }) ?? null;
}

function DropConnect4Disc(state: Connect4State, col: number, mark: 'P' | 'A') {
  for (let row = state.rows - 1; row >= 0; row -= 1) {
    const index = row * state.cols + col;
    if (!state.board[index]) {
      state.board[index] = mark;
      return row;
    }
  }
  return null;
}

function CheckConnect4Win(board: Array<string | null>, rows: number, cols: number, mark: string) {
  return Boolean(FindConnect4Line(board, rows, cols, mark));
}

function FindConnect4Line(board: Array<string | null>, rows: number, cols: number, mark: string) {
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]] as const;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (board[row * cols + col] !== mark) continue;
      for (const [dx, dy] of directions) {
        const line = [row * cols + col];
        for (let step = 1; step < 4; step += 1) {
          const nextRow = row + dy * step;
          const nextCol = col + dx * step;
          if (nextRow < 0 || nextRow >= rows || nextCol < 0 || nextCol >= cols || board[nextRow * cols + nextCol] !== mark) break;
          line.push(nextRow * cols + nextCol);
        }
        if (line.length >= 4) return line;
      }
    }
  }
  return null;
}

function QueueConnect4Result(state: Connect4State, result: GameResult, elapsed: number, winningLine: number[]) {
  state.winningLine = winningLine;
  state.pendingResult = { result, finishAt: elapsed + 1.8 };
}

function Connect4Color(mark: 'P' | 'A') {
  return mark === 'P' ? originalConnect4Yellow : originalConnect4Red;
}

function ChooseConnect4Move(state: Connect4State) {
  const available = Array.from({ length: state.cols }, (_, col) => col).filter((col) => !state.board[col]);
  return FindConnect4WinningColumn(state, 'A', available)
    ?? FindConnect4WinningColumn(state, 'P', available)
    ?? available[Math.floor(Math.random() * available.length)]
    ?? null;
}

function FindConnect4WinningColumn(state: Connect4State, mark: 'P' | 'A', available: number[]) {
  return available.find((col) => {
    const clone: Connect4State = { ...state, board: [...state.board] };
    DropConnect4Disc(clone, col, mark);
    return CheckConnect4Win(clone.board, clone.rows, clone.cols, mark);
  }) ?? null;
}

function ParseDotsLineIndex(state: DotsAndBoxesState, index: number) {
  if (index >= dotsVerticalOffset) {
    const line = index - dotsVerticalOffset;
    return line >= 0 && line < state.vLines.length ? { horizontal: false, index: line } : null;
  }
  return index >= 0 && index < state.hLines.length ? { horizontal: true, index } : null;
}

function IsDotsLineDrawn(state: DotsAndBoxesState, horizontal: boolean, index: number) {
  return Boolean(horizontal ? state.hLines[index] : state.vLines[index]);
}

function SetDotsLine(state: DotsAndBoxesState, horizontal: boolean, index: number, owner: 'P' | 'A' | null) {
  if (horizontal) state.hLines[index] = owner;
  else state.vLines[index] = owner;
}

function ClaimDotsBoxes(state: DotsAndBoxesState, horizontal: boolean, lineIndex: number, owner: 'P' | 'A') {
  const candidates: Array<[number, number]> = [];
  if (horizontal) {
    const row = Math.floor(lineIndex / (state.size - 1));
    const col = lineIndex % (state.size - 1);
    candidates.push([row - 1, col], [row, col]);
  } else {
    const row = Math.floor(lineIndex / state.size);
    const col = lineIndex % state.size;
    candidates.push([row, col - 1], [row, col]);
  }
  let completed = 0;
  candidates.forEach(([row, col]) => {
    if (row < 0 || col < 0 || row >= state.size - 1 || col >= state.size - 1) return;
    const boxIndex = row * (state.size - 1) + col;
    if (state.boxes[boxIndex] || !IsDotsBoxComplete(state, row, col)) return;
    state.boxes[boxIndex] = owner;
    completed += 1;
  });
  return completed;
}

function IsDotsBoxComplete(state: DotsAndBoxesState, row: number, col: number) {
  return state.hLines[row * (state.size - 1) + col]
    && state.hLines[(row + 1) * (state.size - 1) + col]
    && state.vLines[row * state.size + col]
    && state.vLines[row * state.size + col + 1];
}

function ChooseDotsMove(state: DotsAndBoxesState) {
  const moves = [
    ...state.hLines.map((owner, index) => ({ drawn: Boolean(owner), horizontal: true, index })),
    ...state.vLines.map((owner, index) => ({ drawn: Boolean(owner), horizontal: false, index })),
  ].filter((move) => !move.drawn);
  return moves.find((move) => WouldCompleteDotsBox(state, move.horizontal, move.index))
    ?? moves[Math.floor(Math.random() * moves.length)]
    ?? null;
}

function WouldCompleteDotsBox(state: DotsAndBoxesState, horizontal: boolean, index: number) {
  SetDotsLine(state, horizontal, index, 'P');
  const completes = horizontal
    ? [
        [Math.floor(index / (state.size - 1)) - 1, index % (state.size - 1)],
        [Math.floor(index / (state.size - 1)), index % (state.size - 1)],
      ].some(([row, col]) => row >= 0 && col >= 0 && row < state.size - 1 && col < state.size - 1 && !state.boxes[row * (state.size - 1) + col] && IsDotsBoxComplete(state, row, col))
    : [
        [Math.floor(index / state.size), (index % state.size) - 1],
        [Math.floor(index / state.size), index % state.size],
      ].some(([row, col]) => row >= 0 && col >= 0 && row < state.size - 1 && col < state.size - 1 && !state.boxes[row * (state.size - 1) + col] && IsDotsBoxComplete(state, row, col));
  SetDotsLine(state, horizontal, index, null);
  return completes;
}

function IsDotsBoardFull(state: DotsAndBoxesState) {
  return state.hLines.every(Boolean) && state.vLines.every(Boolean);
}

function FinishDotsIfFull(state: DotsAndBoxesState, finishGame: (result: GameResult) => void) {
  if (!IsDotsBoardFull(state)) return false;
  finishGame(
    state.playerScore > state.aiScore
      ? 'Victory'
      : state.playerScore === state.aiScore
        ? 'Draw'
        : 'Defeat',
  );
  return true;
}

function DrawDotsLine(app: Application, x1: number, y1: number, x2: number, y2: number, owner: 'P' | 'A' | null, index: number, onTap: (index: number) => void) {
  const node = InteractiveNode(onTap, index);
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  node.x = minX;
  node.y = minY;
  const w = Math.abs(x2 - x1) || 18;
  const h = Math.abs(y2 - y1) || 18;
  const hit = new Graphics();
  hit.rect(-9, -9, w + 18, h + 18).fill({ color: 0xffffff, alpha: 0.001 });
  hit.moveTo(x1 - minX, y1 - minY).lineTo(x2 - minX, y2 - minY)
    .stroke({
      color: owner === 'P' ? playerColor : owner === 'A' ? aiColor : 0xdddddd,
      width: owner ? 5 : 4,
    });
  node.addChild(hit);
  app.stage.addChild(node);
}

function DrawHexagon(g: Graphics, cx: number, cy: number, radius: number) {
  for (let point = 0; point < 6; point += 1) {
    const angle = Math.PI / 6 + point * Math.PI / 3;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (point === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  return g;
}

function ChooseHexMove(state: HexState) {
  const empty = state.board.map((value, index) => (value === 0 ? index : null)).filter((index): index is number => index !== null);
  return empty.find((index) => {
    state.board[index] = 2;
    const won = HasHexPath(state, 2);
    state.board[index] = 0;
    return won;
  }) ?? empty.find((index) => {
    state.board[index] = 1;
    const blocked = HasHexPath(state, 1);
    state.board[index] = 0;
    return blocked;
  }) ?? empty.sort((a, b) => DistanceToCenter(a, state.size) - DistanceToCenter(b, state.size))[0] ?? null;
}

function DistanceToCenter(index: number, size: number) {
  const row = Math.floor(index / size);
  const col = index % size;
  const center = (size - 1) / 2;
  return Math.abs(row - center) + Math.abs(col - center);
}

function HasHexPath(state: HexState, player: 1 | 2) {
  const queue: number[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < state.size; i += 1) {
    const index = player === 1 ? i : i * state.size;
    if (state.board[index] === player) {
      queue.push(index);
      seen.add(index);
    }
  }
  while (queue.length > 0) {
    const index = queue.shift();
    if (index === undefined) break;
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    if ((player === 1 && row === state.size - 1) || (player === 2 && col === state.size - 1)) return true;
    GetHexNeighbors(index, state.size).forEach((next) => {
      if (state.board[next] !== player || seen.has(next)) return;
      seen.add(next);
      queue.push(next);
    });
  }
  return false;
}

function GetHexNeighbors(index: number, size: number) {
  const row = Math.floor(index / size);
  const col = index % size;
  return [
    [row - 1, col],
    [row - 1, col + 1],
    [row, col - 1],
    [row, col + 1],
    [row + 1, col - 1],
    [row + 1, col],
  ]
    .filter(([r, c]) => r >= 0 && r < size && c >= 0 && c < size)
    .map(([r, c]) => r * size + c);
}

function GenerateMaze(size: number, startIndex: number): MazeCell[] {
  const cells: MazeCell[] = Array.from({ length: size * size }, () => ({ top: true, right: true, bottom: true, left: true }));
  const visited = new Set<number>([startIndex]);
  const stack = [startIndex];
  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = GetMazeNeighbors(current, size).filter((neighbor) => !visited.has(neighbor.index));
    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }
    const next = neighbors[Math.floor(Math.random() * neighbors.length)];
    RemoveMazeWall(cells[current], cells[next.index], next.direction);
    visited.add(next.index);
    stack.push(next.index);
  }
  return cells;
}

function FindFarthestMazeIndex(cells: MazeCell[], size: number, start: number) {
  const queue = [{ index: start, distance: 0 }];
  const seen = new Set<number>([start]);
  let farthest = queue[0];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current.distance > farthest.distance) farthest = current;
    GetOpenMazeNeighbors(cells, size, current.index).forEach((next) => {
      if (seen.has(next)) return;
      seen.add(next);
      queue.push({ index: next, distance: current.distance + 1 });
    });
  }

  return farthest.index;
}

function GetOpenMazeNeighbors(cells: MazeCell[], size: number, index: number) {
  const cell = cells[index];
  const row = Math.floor(index / size);
  const col = index % size;
  const neighbors: number[] = [];
  if (!cell.top && row > 0) neighbors.push(index - size);
  if (!cell.right && col < size - 1) neighbors.push(index + 1);
  if (!cell.bottom && row < size - 1) neighbors.push(index + size);
  if (!cell.left && col > 0) neighbors.push(index - 1);
  return neighbors;
}

function GetMazeNeighbors(index: number, size: number) {
  const row = Math.floor(index / size);
  const col = index % size;
  return [
    row > 0 ? { index: index - size, direction: 'top' as const } : null,
    col < size - 1 ? { index: index + 1, direction: 'right' as const } : null,
    row < size - 1 ? { index: index + size, direction: 'bottom' as const } : null,
    col > 0 ? { index: index - 1, direction: 'left' as const } : null,
  ].filter((neighbor): neighbor is { index: number; direction: 'top' | 'right' | 'bottom' | 'left' } => neighbor !== null);
}

function RemoveMazeWall(current: MazeCell, next: MazeCell, direction: 'top' | 'right' | 'bottom' | 'left') {
  current[direction] = false;
  if (direction === 'top') next.bottom = false;
  if (direction === 'right') next.left = false;
  if (direction === 'bottom') next.top = false;
  if (direction === 'left') next.right = false;
}

function CanMoveMaze(state: MazeState, from: number, to: number) {
  const row = Math.floor(from / state.size);
  const col = from % state.size;
  const targetRow = Math.floor(to / state.size);
  const targetCol = to % state.size;
  if (Math.abs(row - targetRow) + Math.abs(col - targetCol) !== 1) return false;
  const cell = state.cells[from];
  if (targetRow < row) return !cell.top;
  if (targetCol > col) return !cell.right;
  if (targetRow > row) return !cell.bottom;
  return !cell.left;
}
