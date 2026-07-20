import { Application, Container, Graphics, Text } from 'pixi.js';
import type { TFunction } from '../types';
import type {
  BullsAndCowsState,
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
  SetCard,
  SetGameState,
  SimonState,
  SokobanState,
  TicTacToeState,
} from './types';
import {
  addText,
  getGridLayout,
  getResponsiveBoardBounds,
  getResponsiveBoardMaxSize,
  isMobileCognitiveViewport,
  shuffle,
} from './utils';

type ReferenceLanguageNeutralGameKind = Exclude<
  ReferenceGameId,
  'memory-match' | 'lights-out' | 'reaction-time' | 'whack-a-mole' | 'sliding-puzzle'
>;
type LanguageNeutralGameKind = ReferenceLanguageNeutralGameKind | NumberGridState['kind'];
type LanguageNeutralGameState = Extract<CognitiveGameState, { kind: LanguageNeutralGameKind }>;

const LANGUAGE_NEUTRAL_KINDS: readonly LanguageNeutralGameKind[] = [
  'sudoku',
  'latin-square',
  'magic-square',
  'bulls-and-cows',
  'simon-says',
  'tic-tac-toe',
  'connect4',
  'dots-and-boxes',
  'hex',
  'set-game',
  'sokoban',
  'maze',
];

const NUMBER_GRID_BORDER = 0x000000;
const NUMBER_GRID_CELL_FILL = 0xffffff;
const NUMBER_GRID_ENTRY_TEXT = '#005EB8';
const NUMBER_GRID_GIVEN_TEXT = '#000000';

const ORIGINAL_BLUE = 0x3498db;
const ORIGINAL_BLUE_DARK = 0x2980b9;
const ORIGINAL_BLUE_EDGE = 0x2471a3;
const ORIGINAL_GREEN = 0x2ecc71;
const ORIGINAL_GREEN_DARK = 0x27ae60;
const ORIGINAL_RED = 0xe74c3c;
const ORIGINAL_RED_DARK = 0xc0392b;
const ORIGINAL_RED_EDGE = 0xa93226;
const ORIGINAL_YELLOW = 0xf1c40f;
const ORIGINAL_CONNECT4_YELLOW = 0xfacc15;
const ORIGINAL_CONNECT4_RED = 0xdc143c;
const ORIGINAL_PURPLE = 0x9b59b6;
const ORIGINAL_BOARD_DARK = 0x34495e;
const ORIGINAL_TEXT = 0x2c3e50;
const ORIGINAL_LIGHT = 0xecf0f1;
const ORIGINAL_LIGHT_MUTED = 0xf5f5f5;
const ORIGINAL_BORDER = 0xbdc3c7;
const ORIGINAL_GRAY_BORDER = 0xdee2e6;
const PLAYER_COLOR = ORIGINAL_BLUE;
const AI_COLOR = ORIGINAL_RED;
const SET_COLORS = [ORIGINAL_RED, ORIGINAL_GREEN_DARK, ORIGINAL_PURPLE];
const EMPTY = 0;
const DIGIT_OFFSET = 1100;
const SUBMIT_INDEX = 1200;
const DOTS_VERTICAL_OFFSET = 1300;
const DIRECTION_BY_KEY: Partial<Record<string, GridDirection>> = {
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
};

type GridDirection = { dx: number; dy: number };

const SOKOBAN_LEVELS = [
  ['WWWWWW', 'W....W', 'W.B..W', 'W.T..W', 'W..P.W', 'WWWWWW'],
  ['WWWWWWWW', 'W......W', 'W.B..B.W', 'W..TT..W', 'W...P..W', 'W......W', 'WWWWWWWW'],
  ['WWWWWWWW', 'WT....TW', 'W.WBBW.W', 'W..P...W', 'W......W', 'WWWWWWWW'],
  ['WWWWWWWWW', 'W.......W', 'W..BBB..W', 'W..TTT..W', 'W...P...W', 'W.......W', 'WWWWWWWWW'],
  ['WWWWWWWW', 'W......W', 'W.T.B..W', 'W.TWBP.W', 'W......W', 'WWWWWWWW'],
  ['WWWWWWWWW', 'W...W...W', 'W.B.W.T.W', 'W.B...T.W', 'W.P.W...W', 'WWWWWWWWW'],
  ['WWWWWWWW', 'WTT....W', 'WB.B...W', 'W......W', 'W...P..W', 'WWWWWWWW'],
  ['WWWWWWWWW', 'W...T...W', 'W..T.T..W', 'W.B.B.B.W', 'W...P...W', 'W.......W', 'WWWWWWWWW'],
  ['WWWWWWWWWW', 'W........W', 'W.BWWWB..W', 'W.TW.WT..W', 'W..W.W...W', 'W...P....W', 'WWWWWWWWWW'],
] as const;

const SOKOBAN_LEVEL_CHOICES: Record<Difficulty, number[]> = {
  Beginner: [0, 1, 4],
  Intermediate: [2, 3, 5, 6],
  Advanced: [5, 7, 8],
};

const lastSokobanLevelByDifficulty: Partial<Record<Difficulty, number>> = {};
const lastMazeSignatureByDifficulty: Partial<Record<Difficulty, string>> = {};

export function isLanguageNeutralGameState(state: CognitiveGameState): state is LanguageNeutralGameState {
  return LANGUAGE_NEUTRAL_KINDS.includes(state.kind as LanguageNeutralGameKind);
}

export function createLanguageNeutralGameState(
  gameId: ReferenceGameId,
  difficulty: Difficulty,
): LanguageNeutralGameState | null {
  switch (gameId) {
    case 'sudoku':
      return createMergedSudokuState(difficulty);
    case 'bulls-and-cows':
      return createBullsAndCowsState(difficulty);
    case 'simon-says':
      return createSimonState(difficulty);
    case 'tic-tac-toe':
      return createTicTacToeState(difficulty);
    case 'connect4':
      return createConnect4State();
    case 'dots-and-boxes':
      return createDotsAndBoxesState(difficulty);
    case 'hex':
      return createHexState(difficulty);
    case 'set-game':
      return createSetGameState(difficulty);
    case 'sokoban':
      return createSokobanState(difficulty);
    case 'maze':
      return createMazeState(difficulty);
    default:
      return null;
  }
}

export function handleLanguageNeutralGameTap(
  state: LanguageNeutralGameState,
  index: number,
  elapsed: number,
  finishGame: (result: GameResult) => void,
) {
  switch (state.kind) {
    case 'sudoku':
    case 'latin-square':
    case 'magic-square':
      handleNumberGridTap(state, index, finishGame);
      break;
    case 'bulls-and-cows':
      handleBullsAndCowsTap(state, index, finishGame);
      break;
    case 'simon-says':
      handleSimonTap(state, index, elapsed, finishGame);
      break;
    case 'tic-tac-toe':
      handleTicTacToeTap(state, index, finishGame);
      break;
    case 'connect4':
      handleConnect4Tap(state, index, finishGame);
      break;
    case 'dots-and-boxes':
      handleDotsAndBoxesTap(state, index, finishGame);
      break;
    case 'hex':
      handleHexTap(state, index, finishGame);
      break;
    case 'set-game':
      handleSetTap(state, index, finishGame);
      break;
    case 'sokoban':
      handleSokobanTap(state, index, finishGame);
      break;
    case 'maze':
      handleMazeTap(state, index, finishGame);
      break;
    default:
      break;
  }
}

export function handleLanguageNeutralGameKey(
  state: LanguageNeutralGameState,
  key: string,
  finishGame: (result: GameResult) => void,
) {
  const direction = DIRECTION_BY_KEY[key];
  if (!direction) return false;
  if (state.kind === 'sokoban') {
    moveSokoban(state, direction, finishGame);
    return true;
  }
  if (state.kind === 'maze') {
    moveMaze(state, direction, finishGame);
    return true;
  }
  return false;
}

export function updateLanguageNeutralTimedState(
  state: LanguageNeutralGameState,
  elapsed: number,
  render: () => void,
) {
  if (state.kind !== 'simon-says' || state.status !== 'showing' || elapsed < state.nextStepAt) return;
  if (state.litIndex !== null) {
    state.litIndex = null;
    state.nextStepAt = elapsed + 0.2;
    render();
    return;
  }
  if (state.showIndex < state.sequence.length) {
    state.litIndex = state.sequence[state.showIndex];
    state.showIndex += 1;
    state.nextStepAt = elapsed + 0.55;
    render();
    return;
  }
  state.status = 'input';
  state.inputIndex = 0;
  render();
}

export function isLanguageNeutralAutoSuccess(state: LanguageNeutralGameState) {
  switch (state.kind) {
    case 'sudoku':
    case 'latin-square':
    case 'magic-square':
      return isNumberGridSolved(state);
    case 'bulls-and-cows':
      return state.attempts.some((attempt) => attempt.bulls === state.secret.length);
    case 'simon-says':
      return state.sequence.length >= state.targetRounds && state.status === 'input';
    case 'tic-tac-toe':
      return checkMarkWin(state.board, state.size, state.winLength, 'X');
    case 'connect4':
      return checkConnect4Win(state.board, state.rows, state.cols, 'P');
    case 'dots-and-boxes':
      return isDotsBoardFull(state) && state.playerScore > state.aiScore;
    case 'hex':
      return hasHexPath(state, 1);
    case 'set-game':
      return state.found >= state.targetSets;
    case 'sokoban':
      return isSokobanSolved(state);
    case 'maze':
      return state.current === state.end;
    default:
      return false;
  }
}

export function buildLanguageNeutralResultStats(state: LanguageNeutralGameState): ResultStats {
  switch (state.kind) {
    case 'sudoku':
    case 'latin-square':
    case 'magic-square':
      return buildNumberGridStats(state);
    case 'bulls-and-cows': {
      const best = Math.max(0, ...state.attempts.map((attempt) => attempt.bulls));
      return {
        score: Math.max(0, best * 180 + state.attempts.length * 20 - state.errors * 25),
        accuracy: state.attempts.length > 0 ? Math.round((best / state.secret.length) * 100) : 0,
        moves: state.moves,
        attempts: state.attempts.length,
        success: best,
        errors: state.errors,
        details: { guesses: state.attempts, maxAttempts: state.maxAttempts },
      };
    }
    case 'simon-says':
      return {
        score: Math.max(0, (state.sequence.length - 1) * 120 + state.moves * 5 - state.errors * 40),
        accuracy: state.moves + state.errors > 0 ? Math.round((state.moves / (state.moves + state.errors)) * 100) : 0,
        moves: state.moves,
        attempts: state.moves + state.errors,
        success: Math.max(0, state.sequence.length - 1),
        errors: state.errors,
        details: { targetRounds: state.targetRounds, currentRound: state.sequence.length },
      };
    case 'tic-tac-toe':
      return buildBoardAiStats(state.moves, state.aiMoves, state.errors, checkMarkWin(state.board, state.size, state.winLength, 'X'), { size: state.size, winLength: state.winLength });
    case 'connect4':
      return buildBoardAiStats(state.moves, state.aiMoves, state.errors, checkConnect4Win(state.board, state.rows, state.cols, 'P'), { rows: state.rows, cols: state.cols });
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
      return buildBoardAiStats(state.moves, state.aiMoves, state.errors, hasHexPath(state, 1), { size: state.size });
    case 'set-game':
      return {
        score: Math.max(0, state.found * 160 - state.errors * 35),
        accuracy: state.moves > 0 ? Math.round((state.found / state.moves) * 100) : 0,
        moves: state.moves,
        attempts: state.moves,
        success: state.found,
        errors: state.errors,
        details: { targetSets: state.targetSets, cardsRemaining: state.deck.length },
      };
    case 'sokoban':
      return {
        score: Math.max(0, countSolvedBoxes(state) * 150 - state.pushes * 4 - state.errors * 25),
        accuracy: state.moves + state.errors > 0 ? Math.round((state.moves / (state.moves + state.errors)) * 100) : 0,
        moves: state.moves,
        attempts: state.moves + state.errors,
        success: countSolvedBoxes(state),
        errors: state.errors,
        details: { pushes: state.pushes, boxes: state.boxes.length },
      };
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

export function getLanguageNeutralFeedbackCounts(state: LanguageNeutralGameState): { success: number; errors: number } {
  switch (state.kind) {
    case 'sudoku':
    case 'latin-square':
    case 'magic-square':
      return { success: countCorrectEditableCells(state), errors: state.errors };
    case 'bulls-and-cows':
      return { success: state.attempts.reduce((sum, attempt) => sum + attempt.bulls, 0), errors: state.errors };
    case 'simon-says':
      return { success: state.moves, errors: state.errors };
    case 'tic-tac-toe':
    case 'connect4':
    case 'hex':
      return { success: state.moves, errors: state.errors };
    case 'dots-and-boxes':
      return { success: state.playerScore, errors: state.errors + state.aiScore };
    case 'set-game':
      return { success: state.found, errors: state.errors };
    case 'sokoban':
      return { success: countSolvedBoxes(state), errors: state.errors };
    case 'maze':
      return { success: state.moves, errors: state.errors };
    default:
      return { success: 0, errors: 0 };
  }
}

export function drawLanguageNeutralGame(
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
      drawNumberGrid(app, state, onTap, t);
      break;
    case 'bulls-and-cows':
      drawBullsAndCows(app, state, onTap, t);
      break;
    case 'simon-says':
      drawSimon(app, state, onTap, t);
      break;
    case 'tic-tac-toe':
      drawTicTacToe(app, state, onTap, t);
      break;
    case 'connect4':
      drawConnect4(app, state, onTap, t);
      break;
    case 'dots-and-boxes':
      drawDotsAndBoxes(app, state, onTap, t);
      break;
    case 'hex':
      drawHex(app, state, onTap, t);
      break;
    case 'set-game':
      drawSetGame(app, state, onTap, t);
      break;
    case 'sokoban':
      drawSokoban(app, state, onTap, t);
      break;
    case 'maze':
      drawMaze(app, state, onTap, t, elapsed);
      break;
    default:
      break;
  }
}

function createNumberGridState(kind: NumberGridState['kind'], difficulty: Difficulty): NumberGridState {
  const diff = difficultyIndex(difficulty);
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
    return maskNumberGrid('sudoku', 9, solution, [34, 42, 50][diff], 3);
  }
  if (kind === 'latin-square') {
    const size = [4, 5, 6][diff];
    const solution = Array.from({ length: size * size }, (_, index) => ((Math.floor(index / size) + index) % size) + 1);
    return maskNumberGrid('latin-square', size, solution, [6, 11, 18][diff]);
  }
  if (kind === 'magic-square') {
    return maskNumberGrid('magic-square', 3, [8, 1, 6, 3, 5, 7, 4, 9, 2], [4, 6, 7][diff]);
  }
  throw new Error(`Unsupported number grid kind: ${kind}`);
}

function createMergedSudokuState(difficulty: Difficulty): NumberGridState {
  if (difficulty === 'Beginner') return createNumberGridState('latin-square', difficulty);
  if (difficulty === 'Intermediate') return createNumberGridState('magic-square', difficulty);
  return createNumberGridState('sudoku', difficulty);
}

function maskNumberGrid(kind: NumberGridState['kind'], size: number, solution: number[], blanks: number, boxSize?: number): NumberGridState {
  const values = [...solution];
  const givens = Array.from({ length: solution.length }, () => true);
  shuffle(Array.from({ length: solution.length }, (_, index) => index)).slice(0, blanks).forEach((index) => {
    values[index] = EMPTY;
    givens[index] = false;
  });
  return { kind, size, boxSize, solution, values, givens, moves: 0, errors: 0 };
}

function handleNumberGridTap(state: NumberGridState, index: number, finishGame: (result: GameResult) => void) {
  if (state.givens[index]) return;
  const emptyValue = EMPTY;
  const maxValue = state.kind === 'magic-square' ? state.size * state.size : state.size;
  const current = state.values[index];
  state.values[index] = current >= maxValue ? emptyValue : current + 1;
  state.moves += 1;
  if (isNumberGridSolved(state)) {
    finishGame('Victory');
    return;
  }
  if (state.values.every((value) => value !== emptyValue)) state.errors += 1;
}

function isNumberGridSolved(state: NumberGridState) {
  return state.values.every((value, index) => value === state.solution[index]);
}

function countCorrectEditableCells(state: NumberGridState) {
  return state.values.reduce((total, value, index) => total + (!state.givens[index] && value === state.solution[index] ? 1 : 0), 0);
}

function buildNumberGridStats(state: NumberGridState): ResultStats {
  const editable = state.givens.filter((given) => !given).length;
  const correct = countCorrectEditableCells(state);
  return {
    score: Math.max(0, correct * 60 - state.errors * 30 - state.moves),
    accuracy: editable > 0 ? Math.round((correct / editable) * 100) : 0,
    moves: state.moves,
    attempts: state.moves,
    success: correct,
    errors: state.errors + (editable - correct),
    details: { variant: state.kind, size: state.size, solved: isNumberGridSolved(state) },
  };
}

function drawNumberGrid(app: Application, state: NumberGridState, onTap: (index: number) => void, _t: TFunction) {
  const emptyValue = EMPTY;
  const preferred = state.kind === 'sudoku' ? 50 : state.size >= 8 ? 46 : 74;
  const { cell, gap, startX, startY } = getGridLayout(app, state.size, state.size, preferred, 0);
  state.values.forEach((value, index) => {
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    const node = interactiveNode(onTap, index);
    node.x = startX + col * (cell + gap);
    node.y = startY + row * (cell + gap);
    const given = state.givens[index];
    const g = new Graphics();
    g.rect(0, 0, cell, cell).fill(NUMBER_GRID_CELL_FILL);
    node.addChild(g);
    if (value !== emptyValue) {
      addText(node, String(value), cell / 2, cell / 2, {
        fontSize: Math.max(18, cell * 0.42),
        fontWeight: given ? '900' : '700',
        fill: given ? NUMBER_GRID_GIVEN_TEXT : NUMBER_GRID_ENTRY_TEXT,
      });
    }
    app.stage.addChild(node);
  });
  drawNumberGridLines(app, startX, startY, cell, state.size, state.kind === 'sudoku' ? (state.boxSize ?? 3) : state.size);
}

function drawNumberGridLines(app: Application, startX: number, startY: number, cell: number, size: number, majorEvery: number) {
  const boardSize = cell * size;
  const minor = new Graphics();
  const major = new Graphics();

  for (let index = 0; index <= size; index += 1) {
    const position = index * cell;
    const target = index % majorEvery === 0 ? major : minor;
    target.moveTo(startX + position, startY).lineTo(startX + position, startY + boardSize);
    target.moveTo(startX, startY + position).lineTo(startX + boardSize, startY + position);
  }

  minor.stroke({ color: NUMBER_GRID_BORDER, width: 1 });
  major.stroke({ color: NUMBER_GRID_BORDER, width: 4 });
  app.stage.addChild(minor);
  app.stage.addChild(major);
}

function createBullsAndCowsState(difficulty: Difficulty): BullsAndCowsState {
  const maxAttempts = [10, 9, 8][difficultyIndex(difficulty)];
  const digits = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  if (digits[0] === 0) [digits[0], digits[1]] = [digits[1], digits[0]];
  return {
    kind: 'bulls-and-cows',
    secret: digits.slice(0, 4),
    guess: [-1, -1, -1, -1],
    selectedSlot: 0,
    attempts: [],
    maxAttempts,
    moves: 0,
    errors: 0,
  };
}

function handleBullsAndCowsTap(state: BullsAndCowsState, index: number, finishGame: (result: GameResult) => void) {
  if (index >= 0 && index < state.guess.length) {
    state.selectedSlot = index;
    return;
  }
  if (index >= DIGIT_OFFSET && index < DIGIT_OFFSET + 10) {
    state.guess[state.selectedSlot] = index - DIGIT_OFFSET;
    state.selectedSlot = (state.selectedSlot + 1) % state.guess.length;
    state.moves += 1;
    return;
  }
  if (index !== SUBMIT_INDEX) return;
  const unique = new Set(state.guess);
  if (state.guess.some((value) => value < 0) || state.guess[0] === 0 || unique.size !== state.guess.length) {
    state.errors += 1;
    return;
  }
  const result = scoreBullsGuess(state.secret, state.guess);
  state.attempts.push({ guess: [...state.guess], ...result });
  state.moves += 1;
  if (result.bulls === state.secret.length) {
    finishGame('Victory');
    return;
  }
  state.guess = [-1, -1, -1, -1];
  state.selectedSlot = 0;
  if (state.attempts.length >= state.maxAttempts) finishGame('Defeat');
}

function drawBullsAndCows(app: Application, state: BullsAndCowsState, onTap: (index: number) => void, t: TFunction) {
  const boardBounds = getResponsiveBoardBounds(app);
  drawGuessHistory(app, state.attempts.map((attempt) => ({
    label: `${attempt.bulls}/${attempt.cows}`,
    values: attempt.guess,
  })));
  drawDigitInput(app, state.guess, state.selectedSlot, onTap);
  drawDigitPalette(app, onTap);
  drawButton(app, SUBMIT_INDEX, t('cognitive.play.submit'), app.renderer.width / 2, boardBounds.bottom - 24, Math.min(180, boardBounds.width), 48, onTap);
}

function createSimonState(difficulty: Difficulty): SimonState {
  return {
    kind: 'simon-says',
    sequence: [Math.floor(Math.random() * 4)],
    inputIndex: 0,
    litIndex: null,
    showIndex: 0,
    nextStepAt: 0.45,
    targetRounds: [5, 7, 9][difficultyIndex(difficulty)],
    status: 'showing',
    moves: 0,
    errors: 0,
  };
}

function handleSimonTap(state: SimonState, index: number, elapsed: number, finishGame: (result: GameResult) => void) {
  if (state.status !== 'input' || index < 0 || index > 3) return;
  if (state.sequence[state.inputIndex] !== index) {
    state.errors += 1;
    finishGame('Defeat');
    return;
  }
  state.moves += 1;
  state.inputIndex += 1;
  if (state.inputIndex < state.sequence.length) return;
  if (state.sequence.length >= state.targetRounds) {
    finishGame('Victory');
    return;
  }
  state.sequence.push(Math.floor(Math.random() * 4));
  state.status = 'showing';
  state.showIndex = 0;
  state.litIndex = null;
  state.nextStepAt = elapsed + 0.55;
}

function drawSimon(app: Application, state: SimonState, onTap: (index: number) => void, _t: TFunction) {
  const boardMax = getResponsiveBoardMaxSize(app);
  const boardSize = Math.floor(Math.min(isMobileCognitiveViewport(app) ? Number.POSITIVE_INFINITY : 320, boardMax.width, boardMax.height));
  const buttonSize = boardSize * (150 / 320);
  const gap = boardSize - buttonSize * 2;
  const startX = (app.renderer.width - boardSize) / 2;
  const startY = (app.renderer.height - boardSize) / 2;
  const buttons = [
    { color: ORIGINAL_GREEN, activeColor: 0x58d68d, corner: 'top-left' as const },
    { color: ORIGINAL_RED, activeColor: 0xec7063, corner: 'top-right' as const },
    { color: ORIGINAL_YELLOW, activeColor: 0xf4d03f, corner: 'bottom-left' as const },
    { color: ORIGINAL_BLUE, activeColor: 0x5dade2, corner: 'bottom-right' as const },
  ];

  buttons.forEach((button, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    drawSimonButton(
      app,
      startX + col * (buttonSize + gap),
      startY + row * (buttonSize + gap),
      buttonSize,
      button.corner,
      state.litIndex === index ? button.activeColor : button.color,
      state.litIndex === index,
      index,
      onTap,
    );
  });

  const center = new Graphics();
  center.circle(app.renderer.width / 2, app.renderer.height / 2, boardSize * (50 / 320)).fill(ORIGINAL_TEXT);
  app.stage.addChild(center);
}

function createTicTacToeState(difficulty: Difficulty): TicTacToeState {
  const diff = difficultyIndex(difficulty);
  const size = [3, 4, 5][diff];
  return {
    kind: 'tic-tac-toe',
    size,
    winLength: diff === 2 ? 4 : 3,
    board: Array.from({ length: size * size }, () => null),
    moves: 0,
    aiMoves: 0,
    errors: 0,
  };
}

function handleTicTacToeTap(state: TicTacToeState, index: number, finishGame: (result: GameResult) => void) {
  if (state.board[index]) {
    state.errors += 1;
    return;
  }
  state.board[index] = 'X';
  state.moves += 1;
  if (checkMarkWin(state.board, state.size, state.winLength, 'X')) {
    finishGame('Victory');
    return;
  }
  if (state.board.every(Boolean)) {
    finishGame('Draw');
    return;
  }
  const aiMove = chooseTicTacToeMove(state);
  if (aiMove !== null) {
    state.board[aiMove] = 'O';
    state.aiMoves += 1;
  }
  if (checkMarkWin(state.board, state.size, state.winLength, 'O')) finishGame('Defeat');
  if (state.board.every(Boolean)) finishGame('Draw');
}

function drawTicTacToe(app: Application, state: TicTacToeState, onTap: (index: number) => void, _t: TFunction) {
  const padding = 10;
  const { cell, gap, startX, startY } = getGridLayout(app, state.size, state.size, 60, 5, padding);
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
    const node = interactiveNode(onTap, index);
    node.x = startX + col * (cell + gap);
    node.y = startY + row * (cell + gap);
    const g = new Graphics();
    g.rect(0, 0, cell, cell).fill(0xffffff).stroke({ color: 0x333333, width: 2 });
    node.addChild(g);
    if (mark) {
      addText(node, mark, cell / 2, cell / 2, {
        fontSize: Math.max(24, cell * 0.4),
        fontWeight: '400',
        fill: '#2c3e50',
      });
    }
    app.stage.addChild(node);
  });
}

function createConnect4State(): Connect4State {
  return {
    kind: 'connect4',
    rows: 6,
    cols: 7,
    board: Array.from({ length: 42 }, () => null),
    moves: 0,
    aiMoves: 0,
    errors: 0,
  };
}

function handleConnect4Tap(state: Connect4State, index: number, finishGame: (result: GameResult) => void) {
  const col = index % state.cols;
  const playerRow = dropConnect4Disc(state, col, 'P');
  if (playerRow === null) {
    state.errors += 1;
    return;
  }
  state.moves += 1;
  if (checkConnect4Win(state.board, state.rows, state.cols, 'P')) {
    finishGame('Victory');
    return;
  }
  const aiCol = chooseConnect4Move(state);
  if (aiCol !== null) {
    dropConnect4Disc(state, aiCol, 'A');
    state.aiMoves += 1;
  }
  if (checkConnect4Win(state.board, state.rows, state.cols, 'A') || state.board.every(Boolean)) finishGame('Defeat');
}

function drawConnect4(app: Application, state: Connect4State, onTap: (index: number) => void, _t: TFunction) {
  const { cell, gap, startX, startY } = getGridLayout(app, state.cols, state.rows, 50, 10);
  state.board.forEach((disc, index) => {
    const row = Math.floor(index / state.cols);
    const col = index % state.cols;
    const node = interactiveNode(onTap, col);
    node.x = startX + col * (cell + gap);
    node.y = startY + row * (cell + gap);
    const g = new Graphics();
    g.circle(cell / 2, cell / 2, cell / 2).fill(disc === 'P' ? ORIGINAL_CONNECT4_YELLOW : disc === 'A' ? ORIGINAL_CONNECT4_RED : 0xffffff);
    node.addChild(g);
    app.stage.addChild(node);
  });
}

function createDotsAndBoxesState(difficulty: Difficulty): DotsAndBoxesState {
  const size = [4, 5, 6][difficultyIndex(difficulty)];
  return {
    kind: 'dots-and-boxes',
    size,
    hLines: Array.from({ length: size * (size - 1) }, () => false),
    vLines: Array.from({ length: (size - 1) * size }, () => false),
    boxes: Array.from({ length: (size - 1) * (size - 1) }, () => null),
    moves: 0,
    aiMoves: 0,
    errors: 0,
    playerScore: 0,
    aiScore: 0,
  };
}

function handleDotsAndBoxesTap(state: DotsAndBoxesState, index: number, finishGame: (result: GameResult) => void) {
  const move = parseDotsLineIndex(state, index);
  if (!move || isDotsLineDrawn(state, move.horizontal, move.index)) {
    state.errors += 1;
    return;
  }
  setDotsLine(state, move.horizontal, move.index, true);
  const completed = claimDotsBoxes(state, move.horizontal, move.index, 'P');
  state.playerScore += completed;
  state.moves += 1;
  if (finishDotsIfFull(state, finishGame)) return;
  if (completed > 0) return;
  for (let turn = 0; turn < 12 && !isDotsBoardFull(state); turn += 1) {
    const aiMove = chooseDotsMove(state);
    if (!aiMove) break;
    setDotsLine(state, aiMove.horizontal, aiMove.index, true);
    const aiCompleted = claimDotsBoxes(state, aiMove.horizontal, aiMove.index, 'A');
    state.aiScore += aiCompleted;
    state.aiMoves += 1;
    if (finishDotsIfFull(state, finishGame) || aiCompleted === 0) break;
  }
}

function drawDotsAndBoxes(app: Application, state: DotsAndBoxesState, onTap: (index: number) => void, _t: TFunction) {
  const padding = 16;
  const { cell, startX, startY } = getGridLayout(app, state.size, state.size, 72, 0, padding);
  const board = new Graphics();
  board.rect(
    startX - padding,
    startY - padding,
    (state.size - 1) * cell + padding * 2,
    (state.size - 1) * cell + padding * 2,
  ).fill(ORIGINAL_LIGHT_MUTED).stroke({ color: ORIGINAL_GRAY_BORDER, width: 2 });
  app.stage.addChild(board);

  for (let row = 0; row < state.size - 1; row += 1) {
    for (let col = 0; col < state.size - 1; col += 1) {
      const owner = state.boxes[row * (state.size - 1) + col];
      if (!owner) continue;
      const g = new Graphics();
      g.rect(startX + col * cell + 8, startY + row * cell + 8, cell - 16, cell - 16)
        .fill({ color: owner === 'P' ? ORIGINAL_BLUE : ORIGINAL_RED, alpha: 0.4 });
      app.stage.addChild(g);
    }
  }
  state.hLines.forEach((drawn, index) => {
    const row = Math.floor(index / (state.size - 1));
    const col = index % (state.size - 1);
    drawDotsLine(app, startX + col * cell, startY + row * cell, startX + (col + 1) * cell, startY + row * cell, drawn, index, onTap);
  });
  state.vLines.forEach((drawn, index) => {
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    drawDotsLine(app, startX + col * cell, startY + row * cell, startX + col * cell, startY + (row + 1) * cell, drawn, DOTS_VERTICAL_OFFSET + index, onTap);
  });
  for (let row = 0; row < state.size; row += 1) {
    for (let col = 0; col < state.size; col += 1) {
      const dot = new Graphics();
      dot.circle(startX + col * cell, startY + row * cell, 5).fill(ORIGINAL_TEXT);
      app.stage.addChild(dot);
    }
  }
}

function createHexState(difficulty: Difficulty): HexState {
  const size = [5, 7, 9][difficultyIndex(difficulty)];
  return { kind: 'hex', size, board: Array.from({ length: size * size }, () => 0), moves: 0, aiMoves: 0, errors: 0 };
}

function handleHexTap(state: HexState, index: number, finishGame: (result: GameResult) => void) {
  if (state.board[index] !== 0) {
    state.errors += 1;
    return;
  }
  state.board[index] = 1;
  state.moves += 1;
  if (hasHexPath(state, 1)) {
    finishGame('Victory');
    return;
  }
  const aiMove = chooseHexMove(state);
  if (aiMove !== null) {
    state.board[aiMove] = 2;
    state.aiMoves += 1;
  }
  if (hasHexPath(state, 2) || state.board.every(Boolean)) finishGame('Defeat');
}

function drawHex(app: Application, state: HexState, onTap: (index: number) => void, _t: TFunction) {
  const boardMax = getResponsiveBoardMaxSize(app);
  const preferredRadius = isMobileCognitiveViewport(app) ? Number.POSITIVE_INFINITY : 31;
  const horizontalFactor = (state.size * 1.5 - 0.5) * Math.sqrt(3);
  const verticalFactor = state.size * 1.5 + 0.5;
  const edgePadding = 24;
  const radius = Math.floor(Math.max(8, Math.min(
    preferredRadius,
    (boardMax.width - edgePadding) / horizontalFactor,
    (boardMax.height - edgePadding) / verticalFactor,
  )));
  const width = radius * Math.sqrt(3);
  const boardWidth = horizontalFactor * radius;
  const boardHeight = verticalFactor * radius;
  const startX = (app.renderer.width - boardWidth) / 2 + width / 2;
  const startY = (app.renderer.height - boardHeight) / 2 + radius;
  const edge = new Graphics();
  edge.rect(startX - width / 2, startY - radius - 12, boardWidth, 6).fill(ORIGINAL_BLUE);
  edge.rect(startX - width / 2, startY + boardHeight - radius + 6, boardWidth, 6).fill(ORIGINAL_BLUE_DARK);
  edge.rect(startX - width / 2 - 12, startY - radius, 6, boardHeight).fill(ORIGINAL_RED);
  edge.rect(startX + boardWidth - width / 2 + 6, startY - radius, 6, boardHeight).fill(ORIGINAL_RED_DARK);
  app.stage.addChild(edge);

  state.board.forEach((value, index) => {
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    const cx = startX + col * width + row * (width / 2);
    const cy = startY + row * (radius * 1.5);
    const node = interactiveNode(onTap, index);
    node.x = cx;
    node.y = cy;
    const g = new Graphics();
    drawHexagon(g, 0, 0, radius)
      .fill(value === 1 ? PLAYER_COLOR : value === 2 ? AI_COLOR : ORIGINAL_LIGHT)
      .stroke({ color: value === 1 ? ORIGINAL_BLUE_EDGE : value === 2 ? ORIGINAL_RED_EDGE : ORIGINAL_BORDER, width: 2 });
    node.addChild(g);
    app.stage.addChild(node);
  });
}

function createSetGameState(difficulty: Difficulty): SetGameState {
  const deck = shuffle(createSetDeck());
  const board = deck.splice(0, 12);
  const state: SetGameState = {
    kind: 'set-game',
    deck,
    board,
    selected: [],
    found: 0,
    targetSets: [4, 6, 8][difficultyIndex(difficulty)],
    moves: 0,
    errors: 0,
  };
  ensureSetAvailable(state);
  return state;
}

function handleSetTap(state: SetGameState, index: number, finishGame: (result: GameResult) => void) {
  if (!state.board[index]) return;
  state.selected = state.selected.includes(index)
    ? state.selected.filter((selected) => selected !== index)
    : [...state.selected, index];
  if (state.selected.length !== 3) return;
  state.moves += 1;
  const cards = state.selected.map((selected) => state.board[selected]);
  if (isValidSet(cards[0], cards[1], cards[2])) {
    state.found += 1;
    [...state.selected].sort((a, b) => b - a).forEach((selected) => {
      const next = state.deck.shift();
      if (next) state.board[selected] = next;
      else state.board.splice(selected, 1);
    });
    state.selected = [];
    ensureSetAvailable(state);
    if (state.found >= state.targetSets) finishGame('Victory');
    return;
  }
  state.errors += 1;
  state.selected = [];
}

function drawSetGame(app: Application, state: SetGameState, onTap: (index: number) => void, _t: TFunction) {
  const cols = 4;
  const rows = Math.ceil(state.board.length / cols);
  const gap = 10;
  const padding = 15;
  const boardMax = getResponsiveBoardMaxSize(app);
  const preferredCardWidth = isMobileCognitiveViewport(app) ? Number.POSITIVE_INFINITY : 120;
  const availableWidth = boardMax.width - padding * 2 - gap * (cols - 1);
  const availableHeight = boardMax.height - padding * 2 - gap * (rows - 1);
  const cardWidth = Math.floor(Math.min(preferredCardWidth, availableWidth / cols, (availableHeight / rows) * 1.5));
  const cardHeight = Math.floor(cardWidth * (80 / 120));
  const boardWidth = cols * cardWidth + (cols - 1) * gap + padding * 2;
  const boardHeight = rows * cardHeight + (rows - 1) * gap + padding * 2;
  const startX = (app.renderer.width - boardWidth) / 2 + padding;
  const startY = (app.renderer.height - boardHeight) / 2 + padding;
  const board = new Graphics();
  board.rect(startX - padding, startY - padding, boardWidth, boardHeight).fill(ORIGINAL_BOARD_DARK);
  app.stage.addChild(board);

  state.board.forEach((card, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const selected = state.selected.includes(index);
    const node = interactiveNode(onTap, index);
    node.x = startX + col * (cardWidth + gap);
    node.y = startY + row * (cardHeight + gap);
    const g = new Graphics();
    g.rect(0, 0, cardWidth, cardHeight)
      .fill(0xffffff)
      .stroke({ color: selected ? ORIGINAL_BLUE : ORIGINAL_BORDER, width: 3 });
    node.addChild(g);
    if (selected) {
      const selectedGlow = new Graphics();
      selectedGlow.rect(-3, -3, cardWidth + 6, cardHeight + 6).stroke({ color: ORIGINAL_BLUE, width: 3, alpha: 0.4 });
      node.addChild(selectedGlow);
    }
    drawSetCard(node, card, cardWidth, cardHeight);
    app.stage.addChild(node);
  });
}

function createSokobanState(difficulty: Difficulty): SokobanState {
  const levelIndex = chooseSokobanLevelIndex(difficulty);
  const layout = SOKOBAN_LEVELS[levelIndex];
  const walls: number[] = [];
  const boxes: number[] = [];
  const targets: number[] = [];
  let player = 0;
  layout.forEach((line, row) => {
    [...line].forEach((char, col) => {
      const index = row * line.length + col;
      if (char === '#' || char === 'W') walls.push(index);
      if (char === '$' || char === '*' || char === 'B' || char === 'O') boxes.push(index);
      if (char === 'T' || char === '*' || char === 'O' || char === '+') targets.push(index);
      if (char === '@' || char === '+' || char === 'P') player = index;
    });
  });
  return { kind: 'sokoban', rows: layout.length, cols: layout[0].length, walls, boxes, targets, player, moves: 0, pushes: 0, errors: 0 };
}

function chooseSokobanLevelIndex(difficulty: Difficulty) {
  const choices = SOKOBAN_LEVEL_CHOICES[difficulty];
  const previous = lastSokobanLevelByDifficulty[difficulty];
  const available = choices.filter((index) => index !== previous);
  const picked = available[Math.floor(Math.random() * available.length)] ?? choices[0];
  lastSokobanLevelByDifficulty[difficulty] = picked;
  return picked;
}

function handleSokobanTap(state: SokobanState, index: number, finishGame: (result: GameResult) => void) {
  const playerRow = Math.floor(state.player / state.cols);
  const playerCol = state.player % state.cols;
  const targetRow = Math.floor(index / state.cols);
  const targetCol = index % state.cols;
  moveSokoban(state, { dx: targetCol - playerCol, dy: targetRow - playerRow }, finishGame);
}

function moveSokoban(state: SokobanState, direction: GridDirection, finishGame: (result: GameResult) => void) {
  if (Math.abs(direction.dx) + Math.abs(direction.dy) !== 1) {
    state.errors += 1;
    return;
  }
  const row = Math.floor(state.player / state.cols);
  const col = state.player % state.cols;
  const nextRow = row + direction.dy;
  const nextCol = col + direction.dx;
  const next = nextRow * state.cols + nextCol;
  const boxAt = state.boxes.indexOf(next);
  if (isSokobanBlocked(state, nextRow, nextCol)) {
    state.errors += 1;
    return;
  }
  if (boxAt >= 0) {
    const boxNextRow = nextRow + direction.dy;
    const boxNextCol = nextCol + direction.dx;
    const boxNext = boxNextRow * state.cols + boxNextCol;
    if (isSokobanBlocked(state, boxNextRow, boxNextCol) || state.boxes.includes(boxNext)) {
      state.errors += 1;
      return;
    }
    state.boxes[boxAt] = boxNext;
    state.pushes += 1;
  }
  state.player = next;
  state.moves += 1;
  if (isSokobanSolved(state)) finishGame('Victory');
}

function isSokobanBlocked(state: SokobanState, row: number, col: number) {
  return row < 0 || row >= state.rows || col < 0 || col >= state.cols || state.walls.includes(row * state.cols + col);
}

function drawSokoban(app: Application, state: SokobanState, onTap: (index: number) => void, _t: TFunction) {
  const { cell, gap, startX, startY } = getGridLayout(app, state.cols, state.rows, 50, 0);
  const board = new Graphics();
  board.rect(startX, startY, state.cols * cell, state.rows * cell).fill(0xf5f5dc).stroke({ color: 0x333333, width: 3 });
  app.stage.addChild(board);

  for (let index = 0; index < state.rows * state.cols; index += 1) {
    const row = Math.floor(index / state.cols);
    const col = index % state.cols;
    const node = interactiveNode(onTap, index);
    node.x = startX + col * (cell + gap);
    node.y = startY + row * (cell + gap);
    const wall = state.walls.includes(index);
    const target = state.targets.includes(index);
    const box = state.boxes.includes(index);
    const g = new Graphics();
    if (wall) {
      g.rect(0, 0, cell, cell).fill(0x654321).stroke({ color: 0x4a3520, width: 2 });
      g.moveTo(0, cell / 2).lineTo(cell, cell / 2).stroke({ color: 0x4a3520, width: 2 });
    }
    if (target) {
      g.circle(cell / 2, cell / 2, cell / 4).fill(0xff6b6b).stroke({ color: 0xcc5555, width: 2 });
    }
    if (box) {
      const onTarget = state.targets.includes(index);
      const boxFill = onTarget ? 0x4caf50 : 0xd4a574;
      const boxStroke = onTarget ? 0x2e7d32 : 0x8b6914;
      const crossStroke = onTarget ? 0x1b5e20 : 0x6d4c41;
      g.rect(4, 4, cell - 8, cell - 8).fill(boxFill).stroke({ color: boxStroke, width: 2 });
      g.moveTo(12, 12).lineTo(cell - 12, cell - 12);
      g.moveTo(cell - 12, 12).lineTo(12, cell - 12);
      g.stroke({ color: crossStroke, width: 2 });
    }
    if (state.player === index) {
      const r = cell / 2 - 6;
      g.circle(cell / 2, cell / 2, r).fill(0x2196f3).stroke({ color: 0x1565c0, width: 3 });
      g.circle(cell / 2 - r * 0.35, cell / 2 - r * 0.22, r * 0.18).fill(0xffffff);
      g.circle(cell / 2 + r * 0.35, cell / 2 - r * 0.22, r * 0.18).fill(0xffffff);
      g.circle(cell / 2 - r * 0.35, cell / 2 - r * 0.22, r * 0.08).fill(0x333333);
      g.circle(cell / 2 + r * 0.35, cell / 2 - r * 0.22, r * 0.08).fill(0x333333);
      g.arc(cell / 2, cell / 2 + r * 0.1, r * 0.45, 0.15 * Math.PI, 0.85 * Math.PI).stroke({ color: 0x333333, width: 2 });
    }
    node.addChild(g);
    app.stage.addChild(node);
  }
}

function createMazeState(difficulty: Difficulty): MazeState {
  const size = [8, 10, 12][difficultyIndex(difficulty)];
  let state = createRandomMazeState(size);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const signature = getMazeSignature(state);
    if (signature !== lastMazeSignatureByDifficulty[difficulty]) {
      lastMazeSignatureByDifficulty[difficulty] = signature;
      return state;
    }
    state = createRandomMazeState(size);
  }
  lastMazeSignatureByDifficulty[difficulty] = getMazeSignature(state);
  return state;
}

function createRandomMazeState(size: number): MazeState {
  const start = Math.floor(Math.random() * size * size);
  const cells = generateMaze(size, start);
  return {
    kind: 'maze',
    size,
    cells,
    current: start,
    end: findFarthestMazeIndex(cells, size, start),
    moves: 0,
    errors: 0,
  };
}

function getMazeSignature(state: MazeState) {
  return `${state.current}:${state.end}:${state.cells.map((cell) => (
    `${cell.top ? 1 : 0}${cell.right ? 1 : 0}${cell.bottom ? 1 : 0}${cell.left ? 1 : 0}`
  )).join('')}`;
}

function handleMazeTap(state: MazeState, index: number, finishGame: (result: GameResult) => void) {
  const currentRow = Math.floor(state.current / state.size);
  const currentCol = state.current % state.size;
  const targetRow = Math.floor(index / state.size);
  const targetCol = index % state.size;
  moveMaze(state, { dx: targetCol - currentCol, dy: targetRow - currentRow }, finishGame);
}

function moveMaze(state: MazeState, direction: GridDirection, finishGame: (result: GameResult) => void) {
  const row = Math.floor(state.current / state.size);
  const col = state.current % state.size;
  const nextRow = row + direction.dy;
  const nextCol = col + direction.dx;
  const next = nextRow * state.size + nextCol;
  if (nextRow < 0 || nextRow >= state.size || nextCol < 0 || nextCol >= state.size || !canMoveMaze(state, state.current, next)) {
    state.errors += 1;
    return;
  }
  state.current = next;
  state.moves += 1;
  if (state.current === state.end) finishGame('Victory');
}

function drawMaze(app: Application, state: MazeState, onTap: (index: number) => void, _t: TFunction, _elapsed: number) {
  const { cell, startX, startY } = getGridLayout(app, state.size, state.size, 42, 0);
  const board = new Graphics();
  board.rect(startX, startY, state.size * cell, state.size * cell).fill(0xffffff).stroke({ color: 0x333333, width: 2 });
  app.stage.addChild(board);

  state.cells.forEach((mazeCell, index) => {
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    const node = interactiveNode(onTap, index);
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

function buildBoardAiStats(moves: number, aiMoves: number, errors: number, won: boolean, details: Record<string, unknown>): ResultStats {
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

function difficultyIndex(difficulty: Difficulty) {
  if (difficulty === 'Beginner') return 0;
  if (difficulty === 'Intermediate') return 1;
  return 2;
}

function interactiveNode(onTap: (index: number) => void, index: number) {
  const node = new Container();
  node.eventMode = 'static';
  node.cursor = 'pointer';
  node.on('pointertap', () => onTap(index));
  return node;
}

function drawSimonButton(
  app: Application,
  x: number,
  y: number,
  size: number,
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
  color: number,
  active: boolean,
  index: number,
  onTap: (index: number) => void,
) {
  const node = interactiveNode(onTap, index);
  const g = new Graphics();
  const r = size;

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

  g.fill({ color, alpha: active ? 1 : 0.7 }).stroke({ color: 0x333333, width: 4 });
  node.addChild(g);
  app.stage.addChild(node);
}

function drawButton(app: Application, index: number, label: string, cx: number, cy: number, width: number, height: number, onTap: (index: number) => void) {
  const node = interactiveNode(onTap, index);
  node.x = cx - width / 2;
  node.y = cy - height / 2;
  const g = new Graphics();
  g.rect(0, 0, width, height).fill(ORIGINAL_GREEN);
  node.addChild(g);
  addText(node, label, width / 2, height / 2, {
    fontSize: 18,
    fontWeight: '400',
    fill: '#FFFFFF',
  });
  app.stage.addChild(node);
}

function drawGuessHistory(app: Application, rows: Array<{ values: number[]; label: string }>) {
  const boardBounds = getResponsiveBoardBounds(app);
  const rowWidth = Math.min(340, boardBounds.width);
  const startX = boardBounds.left + (boardBounds.width - rowWidth) / 2;
  const startY = boardBounds.top;
  const rowHeight = 30;
  rows.slice(-8).forEach((row, rowIndex) => {
    const y = startY + rowIndex * rowHeight;
    const g = new Graphics();
    g.rect(startX, y, rowWidth, rowHeight).fill(ORIGINAL_LIGHT).stroke({ color: ORIGINAL_BORDER, width: 1 });
    app.stage.addChild(g);
    const guess = new Text({ text: row.values.join(''), style: { fontSize: 18, fontFamily: 'monospace', fontWeight: '700', fill: '#2c3e50' } });
    guess.anchor.set(0, 0.5);
    guess.x = startX + 16;
    guess.y = y + rowHeight / 2;
    app.stage.addChild(guess);
    const result = new Text({ text: row.label, style: { fontSize: 16, fontWeight: '700', fill: '#e74c3c' } });
    result.anchor.set(1, 0.5);
    result.x = startX + rowWidth - 16;
    result.y = y + rowHeight / 2;
    app.stage.addChild(result);
  });
}

function drawDigitInput(app: Application, guess: number[], selectedSlot: number, onTap: (index: number) => void) {
  const boardBounds = getResponsiveBoardBounds(app);
  const gap = 12;
  const preferredCell = isMobileCognitiveViewport(app) ? Number.POSITIVE_INFINITY : 54;
  const cell = Math.floor(Math.min(preferredCell, (boardBounds.width - gap * (guess.length - 1)) / guess.length, boardBounds.height * 0.12));
  const startX = boardBounds.left + (boardBounds.width - guess.length * cell - gap * (guess.length - 1)) / 2;
  const y = boardBounds.top + boardBounds.height * 0.46;
  guess.forEach((value, index) => {
    const node = interactiveNode(onTap, index);
    node.x = startX + index * (cell + gap);
    node.y = y;
    const g = new Graphics();
    g.rect(0, 0, cell, cell)
      .fill(0xffffff)
      .stroke({ color: selectedSlot === index ? ORIGINAL_BLUE_DARK : ORIGINAL_BLUE, width: selectedSlot === index ? 4 : 2 });
    node.addChild(g);
    if (value >= 0) addText(node, String(value), cell / 2, cell / 2, { fontSize: 28, fontWeight: '400', fill: '#2c3e50' });
    app.stage.addChild(node);
  });
}

function drawDigitPalette(app: Application, onTap: (index: number) => void) {
  const boardBounds = getResponsiveBoardBounds(app);
  const preferredCell = isMobileCognitiveViewport(app) ? Number.POSITIVE_INFINITY : 38;
  const cols = 5;
  const gap = 8;
  const cell = Math.floor(Math.min(preferredCell, (boardBounds.width - gap * (cols - 1)) / cols, boardBounds.height * 0.1));
  const startX = boardBounds.left + (boardBounds.width - cols * cell - gap * (cols - 1)) / 2;
  const y = boardBounds.top + boardBounds.height * 0.62;
  for (let digit = 0; digit < 10; digit += 1) {
    const node = interactiveNode(onTap, DIGIT_OFFSET + digit);
    node.x = startX + (digit % cols) * (cell + gap);
    node.y = y + Math.floor(digit / cols) * (cell + gap);
    const g = new Graphics();
    g.rect(0, 0, cell, cell).fill(ORIGINAL_BLUE);
    node.addChild(g);
    addText(node, String(digit), cell / 2, cell / 2, { fontSize: 20, fontWeight: '400', fill: '#FFFFFF' });
    app.stage.addChild(node);
  }
}

function scoreBullsGuess(secret: number[], guess: number[]) {
  const bulls = guess.reduce((sum, value, index) => sum + (value === secret[index] ? 1 : 0), 0);
  const cows = guess.filter((value, index) => value !== secret[index] && secret.includes(value)).length;
  return { bulls, cows };
}

function checkMarkWin(board: Array<string | null>, size: number, winLength: number, mark: string) {
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

function chooseTicTacToeMove(state: TicTacToeState) {
  const empty = state.board.map((mark, index) => (mark ? null : index)).filter((index): index is number => index !== null);
  return findWinningTicTacToeMove(state, 'O', empty)
    ?? findWinningTicTacToeMove(state, 'X', empty)
    ?? empty.find((index) => index === Math.floor(state.board.length / 2))
    ?? empty[Math.floor(Math.random() * empty.length)]
    ?? null;
}

function findWinningTicTacToeMove(state: TicTacToeState, mark: 'X' | 'O', empty: number[]) {
  return empty.find((index) => {
    state.board[index] = mark;
    const won = checkMarkWin(state.board, state.size, state.winLength, mark);
    state.board[index] = null;
    return won;
  }) ?? null;
}

function dropConnect4Disc(state: Connect4State, col: number, mark: 'P' | 'A') {
  for (let row = state.rows - 1; row >= 0; row -= 1) {
    const index = row * state.cols + col;
    if (!state.board[index]) {
      state.board[index] = mark;
      return row;
    }
  }
  return null;
}

function checkConnect4Win(board: Array<string | null>, rows: number, cols: number, mark: string) {
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]] as const;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (board[row * cols + col] !== mark) continue;
      for (const [dx, dy] of directions) {
        let count = 1;
        for (let step = 1; step < 4; step += 1) {
          const nextRow = row + dy * step;
          const nextCol = col + dx * step;
          if (nextRow < 0 || nextRow >= rows || nextCol < 0 || nextCol >= cols || board[nextRow * cols + nextCol] !== mark) break;
          count += 1;
        }
        if (count >= 4) return true;
      }
    }
  }
  return false;
}

function chooseConnect4Move(state: Connect4State) {
  const available = Array.from({ length: state.cols }, (_, col) => col).filter((col) => !state.board[col]);
  return findConnect4WinningColumn(state, 'A', available)
    ?? findConnect4WinningColumn(state, 'P', available)
    ?? available[Math.floor(Math.random() * available.length)]
    ?? null;
}

function findConnect4WinningColumn(state: Connect4State, mark: 'P' | 'A', available: number[]) {
  return available.find((col) => {
    const clone: Connect4State = { ...state, board: [...state.board] };
    dropConnect4Disc(clone, col, mark);
    return checkConnect4Win(clone.board, clone.rows, clone.cols, mark);
  }) ?? null;
}

function parseDotsLineIndex(state: DotsAndBoxesState, index: number) {
  if (index >= DOTS_VERTICAL_OFFSET) {
    const line = index - DOTS_VERTICAL_OFFSET;
    return line >= 0 && line < state.vLines.length ? { horizontal: false, index: line } : null;
  }
  return index >= 0 && index < state.hLines.length ? { horizontal: true, index } : null;
}

function isDotsLineDrawn(state: DotsAndBoxesState, horizontal: boolean, index: number) {
  return horizontal ? state.hLines[index] : state.vLines[index];
}

function setDotsLine(state: DotsAndBoxesState, horizontal: boolean, index: number, value: boolean) {
  if (horizontal) state.hLines[index] = value;
  else state.vLines[index] = value;
}

function claimDotsBoxes(state: DotsAndBoxesState, horizontal: boolean, lineIndex: number, owner: 'P' | 'A') {
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
    if (state.boxes[boxIndex] || !isDotsBoxComplete(state, row, col)) return;
    state.boxes[boxIndex] = owner;
    completed += 1;
  });
  return completed;
}

function isDotsBoxComplete(state: DotsAndBoxesState, row: number, col: number) {
  return state.hLines[row * (state.size - 1) + col]
    && state.hLines[(row + 1) * (state.size - 1) + col]
    && state.vLines[row * state.size + col]
    && state.vLines[row * state.size + col + 1];
}

function chooseDotsMove(state: DotsAndBoxesState) {
  const moves = [
    ...state.hLines.map((drawn, index) => ({ drawn, horizontal: true, index })),
    ...state.vLines.map((drawn, index) => ({ drawn, horizontal: false, index })),
  ].filter((move) => !move.drawn);
  return moves.find((move) => wouldCompleteDotsBox(state, move.horizontal, move.index))
    ?? moves[Math.floor(Math.random() * moves.length)]
    ?? null;
}

function wouldCompleteDotsBox(state: DotsAndBoxesState, horizontal: boolean, index: number) {
  setDotsLine(state, horizontal, index, true);
  const completes = horizontal
    ? [
        [Math.floor(index / (state.size - 1)) - 1, index % (state.size - 1)],
        [Math.floor(index / (state.size - 1)), index % (state.size - 1)],
      ].some(([row, col]) => row >= 0 && col >= 0 && row < state.size - 1 && col < state.size - 1 && !state.boxes[row * (state.size - 1) + col] && isDotsBoxComplete(state, row, col))
    : [
        [Math.floor(index / state.size), (index % state.size) - 1],
        [Math.floor(index / state.size), index % state.size],
      ].some(([row, col]) => row >= 0 && col >= 0 && row < state.size - 1 && col < state.size - 1 && !state.boxes[row * (state.size - 1) + col] && isDotsBoxComplete(state, row, col));
  setDotsLine(state, horizontal, index, false);
  return completes;
}

function isDotsBoardFull(state: DotsAndBoxesState) {
  return state.hLines.every(Boolean) && state.vLines.every(Boolean);
}

function finishDotsIfFull(state: DotsAndBoxesState, finishGame: (result: GameResult) => void) {
  if (!isDotsBoardFull(state)) return false;
  finishGame(state.playerScore > state.aiScore ? 'Victory' : 'Defeat');
  return true;
}

function drawDotsLine(app: Application, x1: number, y1: number, x2: number, y2: number, drawn: boolean, index: number, onTap: (index: number) => void) {
  const node = interactiveNode(onTap, index);
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  node.x = minX;
  node.y = minY;
  const w = Math.abs(x2 - x1) || 18;
  const h = Math.abs(y2 - y1) || 18;
  const hit = new Graphics();
  hit.rect(-9, -9, w + 18, h + 18).fill({ color: 0xffffff, alpha: 0.001 });
  hit.moveTo(x1 - minX, y1 - minY).lineTo(x2 - minX, y2 - minY)
    .stroke({ color: drawn ? ORIGINAL_BLUE : 0xdddddd, width: drawn ? 5 : 4 });
  node.addChild(hit);
  app.stage.addChild(node);
}

function drawHexagon(g: Graphics, cx: number, cy: number, radius: number) {
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

function chooseHexMove(state: HexState) {
  const empty = state.board.map((value, index) => (value === 0 ? index : null)).filter((index): index is number => index !== null);
  return empty.find((index) => {
    state.board[index] = 2;
    const won = hasHexPath(state, 2);
    state.board[index] = 0;
    return won;
  }) ?? empty.find((index) => {
    state.board[index] = 1;
    const blocked = hasHexPath(state, 1);
    state.board[index] = 0;
    return blocked;
  }) ?? empty.sort((a, b) => distanceToCenter(a, state.size) - distanceToCenter(b, state.size))[0] ?? null;
}

function distanceToCenter(index: number, size: number) {
  const row = Math.floor(index / size);
  const col = index % size;
  const center = (size - 1) / 2;
  return Math.abs(row - center) + Math.abs(col - center);
}

function hasHexPath(state: HexState, player: 1 | 2) {
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
    getHexNeighbors(index, state.size).forEach((next) => {
      if (state.board[next] !== player || seen.has(next)) return;
      seen.add(next);
      queue.push(next);
    });
  }
  return false;
}

function getHexNeighbors(index: number, size: number) {
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

function createSetDeck(): SetCard[] {
  const deck: SetCard[] = [];
  for (let color = 0; color < 3; color += 1) {
    for (let shape = 0; shape < 3; shape += 1) {
      for (let fill = 0; fill < 3; fill += 1) {
        for (let count = 1; count <= 3; count += 1) {
          deck.push({ id: `${color}${shape}${fill}${count}`, color, shape, fill, count });
        }
      }
    }
  }
  return deck;
}

function isValidSet(first: SetCard, second: SetCard, third: SetCard) {
  return (['color', 'shape', 'fill', 'count'] as const).every((key) => {
    const values = [first[key], second[key], third[key]];
    return new Set(values).size !== 2;
  });
}

function ensureSetAvailable(state: SetGameState) {
  while (!findSet(state.board) && state.deck.length > 0 && state.board.length < 18) {
    state.board.push(...state.deck.splice(0, 3));
  }
}

function findSet(cards: SetCard[]) {
  for (let a = 0; a < cards.length - 2; a += 1) {
    for (let b = a + 1; b < cards.length - 1; b += 1) {
      for (let c = b + 1; c < cards.length; c += 1) {
        if (isValidSet(cards[a], cards[b], cards[c])) return [a, b, c];
      }
    }
  }
  return null;
}

function drawSetCard(container: Container, card: SetCard, width: number, height: number) {
  const shapeGap = height / (card.count + 1);
  const shapeRadius = Math.min(width, height) * 0.22;
  for (let i = 0; i < card.count; i += 1) {
    drawSetShape(container, card, width / 2, shapeGap * (i + 1), shapeRadius);
  }
}

function drawSetShape(container: Container, card: SetCard, cx: number, cy: number, radius: number) {
  const g = new Graphics();
  const color = SET_COLORS[card.color];
  if (card.shape === 0) {
    g.moveTo(cx, cy - radius).lineTo(cx + radius, cy).lineTo(cx, cy + radius).lineTo(cx - radius, cy).closePath();
  } else if (card.shape === 1) {
    g.ellipse(cx, cy, radius, radius * 0.62);
  } else {
    g.roundRect(cx - radius, cy - radius * 0.55, radius * 2, radius * 1.1, radius * 0.45);
  }
  if (card.fill === 0) g.fill(color);
  if (card.fill === 1) g.fill({ color, alpha: 0.22 });
  g.stroke({ color, width: 3 });
  if (card.fill === 1) {
    for (let x = cx - radius * 0.7; x <= cx + radius * 0.7; x += 8) {
      g.moveTo(x, cy - radius * 0.5).lineTo(x + 8, cy + radius * 0.5).stroke({ color, width: 1 });
    }
  }
  container.addChild(g);
}

function isSokobanSolved(state: SokobanState) {
  return state.boxes.length === state.targets.length && state.boxes.every((box) => state.targets.includes(box));
}

function countSolvedBoxes(state: SokobanState) {
  return state.boxes.filter((box) => state.targets.includes(box)).length;
}

function generateMaze(size: number, startIndex: number): MazeCell[] {
  const cells: MazeCell[] = Array.from({ length: size * size }, () => ({ top: true, right: true, bottom: true, left: true }));
  const visited = new Set<number>([startIndex]);
  const stack = [startIndex];
  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = getMazeNeighbors(current, size).filter((neighbor) => !visited.has(neighbor.index));
    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }
    const next = neighbors[Math.floor(Math.random() * neighbors.length)];
    removeMazeWall(cells[current], cells[next.index], next.direction);
    visited.add(next.index);
    stack.push(next.index);
  }
  return cells;
}

function findFarthestMazeIndex(cells: MazeCell[], size: number, start: number) {
  const queue = [{ index: start, distance: 0 }];
  const seen = new Set<number>([start]);
  let farthest = queue[0];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current.distance > farthest.distance) farthest = current;
    getOpenMazeNeighbors(cells, size, current.index).forEach((next) => {
      if (seen.has(next)) return;
      seen.add(next);
      queue.push({ index: next, distance: current.distance + 1 });
    });
  }

  return farthest.index;
}

function getOpenMazeNeighbors(cells: MazeCell[], size: number, index: number) {
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

function getMazeNeighbors(index: number, size: number) {
  const row = Math.floor(index / size);
  const col = index % size;
  return [
    row > 0 ? { index: index - size, direction: 'top' as const } : null,
    col < size - 1 ? { index: index + 1, direction: 'right' as const } : null,
    row < size - 1 ? { index: index + size, direction: 'bottom' as const } : null,
    col > 0 ? { index: index - 1, direction: 'left' as const } : null,
  ].filter((neighbor): neighbor is { index: number; direction: 'top' | 'right' | 'bottom' | 'left' } => neighbor !== null);
}

function removeMazeWall(current: MazeCell, next: MazeCell, direction: 'top' | 'right' | 'bottom' | 'left') {
  current[direction] = false;
  if (direction === 'top') next.bottom = false;
  if (direction === 'right') next.left = false;
  if (direction === 'bottom') next.top = false;
  if (direction === 'left') next.right = false;
}

function canMoveMaze(state: MazeState, from: number, to: number) {
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
