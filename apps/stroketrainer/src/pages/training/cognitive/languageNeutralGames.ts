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
  KnightsTourState,
  MastermindState,
  MazeCell,
  MazeState,
  NQueensState,
  NimState,
  NumberGridState,
  ReferenceGameId,
  ResultStats,
  SetCard,
  SetGameState,
  SimonState,
  SokobanState,
  TangramPiece,
  TangramState,
  TicTacToeState,
} from './types';
import {
  COGNITIVE_ACCENT,
  COGNITIVE_ACCENT_TINT,
  COGNITIVE_BG,
  COGNITIVE_BORDER,
  COGNITIVE_SURFACE,
  COGNITIVE_TEXT,
  COGNITIVE_TEXT_MUTED,
  addText,
  getGridLayout,
  shuffle,
} from './utils';

type LanguageNeutralGameKind = Exclude<ReferenceGameId, 'memory-match' | 'lights-out' | 'reaction-time' | 'whack-a-mole' | 'sliding-puzzle'>;
type LanguageNeutralGameState = Extract<CognitiveGameState, { kind: LanguageNeutralGameKind }>;

const LANGUAGE_NEUTRAL_KINDS: readonly LanguageNeutralGameKind[] = [
  'sudoku',
  'latin-square',
  'magic-square',
  'n-queens',
  'knights-tour',
  'binary-puzzle',
  'mastermind',
  'bulls-and-cows',
  'simon-says',
  'tic-tac-toe',
  'connect4',
  'nim',
  'dots-and-boxes',
  'hex',
  'set-game',
  'tangram',
  'sokoban',
  'maze',
];

const TITLE_KEYS: Record<LanguageNeutralGameKind, Parameters<TFunction>[0]> = {
  sudoku: 'cognitive.sudoku.title',
  'latin-square': 'cognitive.latin.title',
  'magic-square': 'cognitive.magic.title',
  'n-queens': 'cognitive.queens.title',
  'knights-tour': 'cognitive.knights.title',
  'binary-puzzle': 'cognitive.binary.title',
  mastermind: 'cognitive.mastermind.title',
  'bulls-and-cows': 'cognitive.bulls.title',
  'simon-says': 'cognitive.simon.title',
  'tic-tac-toe': 'cognitive.tictactoe.title',
  connect4: 'cognitive.connect4.title',
  nim: 'cognitive.nim.title',
  'dots-and-boxes': 'cognitive.dots.title',
  hex: 'cognitive.hex.title',
  'set-game': 'cognitive.set.title',
  tangram: 'cognitive.tangram.title',
  sokoban: 'cognitive.sokoban.title',
  maze: 'cognitive.maze.title',
};

const PLAYER_COLOR = COGNITIVE_ACCENT;
const AI_COLOR = 0xb54747;
const SUCCESS_COLOR = 0x16794a;
const WARNING_COLOR = 0xd97706;
const SET_COLORS = [0x005eb8, 0x16794a, 0xb54747];
const MASTERMIND_COLORS = [0x005eb8, 0x16794a, 0xd97706, 0xb54747, 0x6d5bd0, 0x0f766e];
const EMPTY = 0;
const BINARY_EMPTY = -1;
const COLOR_OFFSET = 1000;
const DIGIT_OFFSET = 1100;
const SUBMIT_INDEX = 1200;
const DOTS_VERTICAL_OFFSET = 1300;
const TANGRAM_PIECE_OFFSET = 1400;
const TANGRAM_SLOT_OFFSET = 1500;

export function isLanguageNeutralGameState(state: CognitiveGameState): state is LanguageNeutralGameState {
  return LANGUAGE_NEUTRAL_KINDS.includes(state.kind as LanguageNeutralGameKind);
}

export function createLanguageNeutralGameState(
  gameId: ReferenceGameId,
  difficulty: Difficulty,
): LanguageNeutralGameState | null {
  switch (gameId) {
    case 'sudoku':
    case 'latin-square':
    case 'magic-square':
    case 'binary-puzzle':
      return createNumberGridState(gameId, difficulty);
    case 'n-queens':
      return createNQueensState(difficulty);
    case 'knights-tour':
      return createKnightsTourState(difficulty);
    case 'mastermind':
      return createMastermindState(difficulty);
    case 'bulls-and-cows':
      return createBullsAndCowsState(difficulty);
    case 'simon-says':
      return createSimonState(difficulty);
    case 'tic-tac-toe':
      return createTicTacToeState(difficulty);
    case 'connect4':
      return createConnect4State();
    case 'nim':
      return createNimState(difficulty);
    case 'dots-and-boxes':
      return createDotsAndBoxesState(difficulty);
    case 'hex':
      return createHexState(difficulty);
    case 'set-game':
      return createSetGameState(difficulty);
    case 'tangram':
      return createTangramState();
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
    case 'binary-puzzle':
      handleNumberGridTap(state, index, finishGame);
      break;
    case 'n-queens':
      handleNQueensTap(state, index, finishGame);
      break;
    case 'knights-tour':
      handleKnightsTourTap(state, index, finishGame);
      break;
    case 'mastermind':
      handleMastermindTap(state, index, finishGame);
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
    case 'nim':
      handleNimTap(state, index, finishGame);
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
    case 'tangram':
      handleTangramTap(state, index, finishGame);
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
    case 'binary-puzzle':
      return isNumberGridSolved(state);
    case 'n-queens':
      return countQueens(state) === state.size && countQueenConflicts(state) === 0;
    case 'knights-tour':
      return state.visited.length === state.size * state.size;
    case 'mastermind':
      return state.attempts.some((attempt) => attempt.exact === state.secret.length);
    case 'bulls-and-cows':
      return state.attempts.some((attempt) => attempt.bulls === state.secret.length);
    case 'simon-says':
      return state.sequence.length >= state.targetRounds && state.status === 'input';
    case 'tic-tac-toe':
      return checkMarkWin(state.board, state.size, state.winLength, 'X');
    case 'connect4':
      return checkConnect4Win(state.board, state.rows, state.cols, 'P');
    case 'nim':
      return totalNimObjects(state.piles) === 0;
    case 'dots-and-boxes':
      return isDotsBoardFull(state) && state.playerScore > state.aiScore;
    case 'hex':
      return hasHexPath(state, 1);
    case 'set-game':
      return state.found >= state.targetSets;
    case 'tangram':
      return state.pieces.every((piece) => piece.placed);
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
    case 'binary-puzzle':
      return buildNumberGridStats(state);
    case 'n-queens': {
      const queens = countQueens(state);
      const conflicts = countQueenConflicts(state);
      return {
        score: Math.max(0, queens * 100 - conflicts * 40 - state.errors * 20),
        accuracy: queens > 0 ? Math.max(0, Math.round(((queens - conflicts) / queens) * 100)) : 0,
        moves: state.moves,
        attempts: state.moves,
        success: Math.max(0, queens - conflicts),
        errors: state.errors + conflicts,
        details: { size: state.size, queens, conflicts },
      };
    }
    case 'knights-tour':
      return {
        score: Math.max(0, state.visited.length * 35 - state.errors * 25),
        accuracy: state.moves + state.errors > 0 ? Math.round((state.moves / (state.moves + state.errors)) * 100) : 0,
        moves: state.moves,
        attempts: state.moves + state.errors,
        success: state.visited.length,
        errors: state.errors,
        details: { size: state.size, visited: state.visited.length },
      };
    case 'mastermind': {
      const best = Math.max(0, ...state.attempts.map((attempt) => attempt.exact));
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
    case 'nim':
      return buildBoardAiStats(state.moves, state.aiMoves, state.errors, totalNimObjects(state.piles) === 0, { piles: state.piles });
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
    case 'tangram': {
      const placed = state.pieces.filter((piece) => piece.placed).length;
      return {
        score: Math.max(0, placed * 120 - state.errors * 30 - state.moves * 2),
        accuracy: state.moves > 0 ? Math.round((placed / state.moves) * 100) : 0,
        moves: state.moves,
        attempts: state.moves,
        success: placed,
        errors: state.errors,
        details: { placed, totalPieces: state.pieces.length },
      };
    }
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
    case 'binary-puzzle':
      return { success: countCorrectEditableCells(state), errors: state.errors };
    case 'n-queens':
      return { success: countQueens(state) - countQueenConflicts(state), errors: state.errors + countQueenConflicts(state) };
    case 'knights-tour':
      return { success: state.visited.length, errors: state.errors };
    case 'mastermind':
      return { success: state.attempts.reduce((sum, attempt) => sum + attempt.exact, 0), errors: state.errors };
    case 'bulls-and-cows':
      return { success: state.attempts.reduce((sum, attempt) => sum + attempt.bulls, 0), errors: state.errors };
    case 'simon-says':
      return { success: state.moves, errors: state.errors };
    case 'tic-tac-toe':
    case 'connect4':
    case 'nim':
    case 'hex':
      return { success: state.moves, errors: state.errors };
    case 'dots-and-boxes':
      return { success: state.playerScore, errors: state.errors + state.aiScore };
    case 'set-game':
      return { success: state.found, errors: state.errors };
    case 'tangram':
      return { success: state.pieces.filter((piece) => piece.placed).length, errors: state.errors };
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
    case 'binary-puzzle':
      drawNumberGrid(app, state, onTap, t);
      break;
    case 'n-queens':
      drawNQueens(app, state, onTap, t);
      break;
    case 'knights-tour':
      drawKnightsTour(app, state, onTap, t);
      break;
    case 'mastermind':
      drawMastermind(app, state, onTap, t);
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
    case 'nim':
      drawNim(app, state, onTap, t);
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
    case 'tangram':
      drawTangram(app, state, onTap, t);
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
  const size = [6, 8, 10][diff];
  return maskNumberGrid('binary-puzzle', size, createBinarySolution(size), Math.round(size * size * [0.45, 0.58, 0.68][diff]));
}

function maskNumberGrid(kind: NumberGridState['kind'], size: number, solution: number[], blanks: number, boxSize?: number): NumberGridState {
  const values = [...solution];
  const givens = Array.from({ length: solution.length }, () => true);
  shuffle(Array.from({ length: solution.length }, (_, index) => index)).slice(0, blanks).forEach((index) => {
    values[index] = kind === 'binary-puzzle' ? BINARY_EMPTY : EMPTY;
    givens[index] = false;
  });
  return { kind, size, boxSize, solution, values, givens, moves: 0, errors: 0 };
}

function handleNumberGridTap(state: NumberGridState, index: number, finishGame: (result: GameResult) => void) {
  if (state.givens[index]) return;
  const emptyValue = state.kind === 'binary-puzzle' ? BINARY_EMPTY : EMPTY;
  const maxValue = state.kind === 'binary-puzzle' ? 1 : state.size * (state.kind === 'magic-square' ? state.size : 1);
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
    details: { size: state.size, solved: isNumberGridSolved(state) },
  };
}

function drawNumberGrid(app: Application, state: NumberGridState, onTap: (index: number) => void, t: TFunction) {
  const emptyValue = state.kind === 'binary-puzzle' ? BINARY_EMPTY : EMPTY;
  drawHeader(app, t(TITLE_KEYS[state.kind]), t('cognitive.play.tapCycle'));
  const preferred = state.kind === 'sudoku' ? 50 : state.size >= 8 ? 46 : 74;
  const { cell, gap, startX, startY } = getGridLayout(app, state.size, state.size, preferred, state.kind === 'sudoku' ? 3 : 6);
  state.values.forEach((value, index) => {
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    const node = interactiveNode(onTap, index);
    node.x = startX + col * (cell + gap);
    node.y = startY + row * (cell + gap);
    const given = state.givens[index];
    const g = new Graphics();
    g.roundRect(0, 0, cell, cell, 6)
      .fill(given ? COGNITIVE_ACCENT_TINT : COGNITIVE_SURFACE)
      .stroke({ color: given ? COGNITIVE_ACCENT : COGNITIVE_BORDER, width: given ? 2 : 1 });
    node.addChild(g);
    if (value !== emptyValue) {
      addText(node, String(value), cell / 2, cell / 2, {
        fontSize: Math.max(18, cell * 0.42),
        fontWeight: given ? '900' : '700',
        fill: given ? '#005EB8' : '#1A1C1E',
      });
    }
    app.stage.addChild(node);
  });
}

function createNQueensState(difficulty: Difficulty): NQueensState {
  const size = [4, 6, 8][difficultyIndex(difficulty)];
  return { kind: 'n-queens', size, queens: Array.from({ length: size * size }, () => false), moves: 0, errors: 0 };
}

function handleNQueensTap(state: NQueensState, index: number, finishGame: (result: GameResult) => void) {
  state.queens[index] = !state.queens[index];
  state.moves += 1;
  if (state.queens[index] && countQueenConflicts(state) > 0) state.errors += 1;
  if (countQueens(state) === state.size && countQueenConflicts(state) === 0) finishGame('Victory');
}

function drawNQueens(app: Application, state: NQueensState, onTap: (index: number) => void, t: TFunction) {
  drawHeader(app, t('cognitive.queens.title'), t('cognitive.play.placeQueens', { value: state.size }));
  const conflicts = getQueenConflictIndexes(state);
  const { cell, gap, startX, startY } = getGridLayout(app, state.size, state.size, 72, 2);
  state.queens.forEach((queen, index) => {
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    const node = interactiveNode(onTap, index);
    node.x = startX + col * (cell + gap);
    node.y = startY + row * (cell + gap);
    const g = new Graphics();
    g.rect(0, 0, cell, cell)
      .fill((row + col) % 2 === 0 ? COGNITIVE_SURFACE : COGNITIVE_ACCENT_TINT)
      .stroke({ color: conflicts.has(index) ? AI_COLOR : COGNITIVE_BORDER, width: conflicts.has(index) ? 3 : 1 });
    node.addChild(g);
    if (queen) {
      addText(node, 'Q', cell / 2, cell / 2, {
        fontSize: Math.max(24, cell * 0.48),
        fontWeight: '900',
        fill: conflicts.has(index) ? '#B54747' : '#005EB8',
      });
    }
    app.stage.addChild(node);
  });
}

function createKnightsTourState(difficulty: Difficulty): KnightsTourState {
  const size = [5, 6, 7][difficultyIndex(difficulty)];
  return { kind: 'knights-tour', size, visited: [], currentIndex: null, moves: 0, errors: 0 };
}

function handleKnightsTourTap(state: KnightsTourState, index: number, finishGame: (result: GameResult) => void) {
  if (state.visited.includes(index)) {
    state.errors += 1;
    return;
  }
  if (state.currentIndex !== null && !isKnightMove(state.currentIndex, index, state.size)) {
    state.errors += 1;
    return;
  }
  state.currentIndex = index;
  state.visited.push(index);
  state.moves += 1;
  if (state.visited.length === state.size * state.size) finishGame('Victory');
}

function drawKnightsTour(app: Application, state: KnightsTourState, onTap: (index: number) => void, t: TFunction) {
  drawHeader(app, t('cognitive.knights.title'), t('cognitive.play.visited', { value: state.visited.length }));
  const { cell, gap, startX, startY } = getGridLayout(app, state.size, state.size, 70, 3);
  Array.from({ length: state.size * state.size }).forEach((_, index) => {
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    const step = state.visited.indexOf(index);
    const isCurrent = index === state.currentIndex;
    const node = interactiveNode(onTap, index);
    node.x = startX + col * (cell + gap);
    node.y = startY + row * (cell + gap);
    const g = new Graphics();
    g.roundRect(0, 0, cell, cell, 6)
      .fill(step >= 0 ? (isCurrent ? COGNITIVE_ACCENT : COGNITIVE_ACCENT_TINT) : COGNITIVE_SURFACE)
      .stroke({ color: COGNITIVE_BORDER, width: 1 });
    node.addChild(g);
    if (step >= 0) {
      addText(node, String(step + 1), cell / 2, cell / 2, {
        fontSize: Math.max(15, cell * 0.28),
        fontWeight: '900',
        fill: isCurrent ? '#FFFFFF' : '#005EB8',
      });
    }
    app.stage.addChild(node);
  });
}

function createMastermindState(difficulty: Difficulty): MastermindState {
  const diff = difficultyIndex(difficulty);
  const colorCount = [4, 5, 6][diff];
  const secret = shuffle(Array.from({ length: colorCount }, (_, index) => index)).slice(0, 4);
  return {
    kind: 'mastermind',
    secret,
    guess: Array.from({ length: 4 }, () => -1),
    selectedSlot: 0,
    attempts: [],
    maxAttempts: [10, 9, 8][diff],
    colorCount,
    moves: 0,
    errors: 0,
  };
}

function handleMastermindTap(state: MastermindState, index: number, finishGame: (result: GameResult) => void) {
  if (index >= 0 && index < state.guess.length) {
    state.selectedSlot = index;
    return;
  }
  if (index >= COLOR_OFFSET && index < COLOR_OFFSET + state.colorCount) {
    state.guess[state.selectedSlot] = index - COLOR_OFFSET;
    state.selectedSlot = (state.selectedSlot + 1) % state.guess.length;
    state.moves += 1;
    return;
  }
  if (index !== SUBMIT_INDEX) return;
  if (state.guess.some((value) => value < 0)) {
    state.errors += 1;
    return;
  }
  const result = scoreMastermindGuess(state.secret, state.guess);
  state.attempts.push({ guess: [...state.guess], ...result });
  state.moves += 1;
  if (result.exact === state.secret.length) {
    finishGame('Victory');
    return;
  }
  state.guess = Array.from({ length: state.guess.length }, () => -1);
  state.selectedSlot = 0;
  if (state.attempts.length >= state.maxAttempts) finishGame('Defeat');
}

function drawMastermind(app: Application, state: MastermindState, onTap: (index: number) => void, t: TFunction) {
  drawHeader(app, t('cognitive.mastermind.title'), t('cognitive.play.mastermind', { value: state.maxAttempts - state.attempts.length }));
  drawGuessHistory(app, state.attempts.map((attempt) => ({
    label: `${attempt.exact}/${attempt.colorOnly}`,
    values: attempt.guess,
  })), 4);
  drawCodeInput(app, state.guess, state.selectedSlot, onTap);
  drawColorPalette(app, state.colorCount, onTap);
  drawButton(app, SUBMIT_INDEX, t('cognitive.play.submit'), app.renderer.width / 2, app.renderer.height - 72, 180, 48, onTap);
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
  drawHeader(app, t('cognitive.bulls.title'), t('cognitive.play.bulls', { value: state.maxAttempts - state.attempts.length }));
  drawGuessHistory(app, state.attempts.map((attempt) => ({
    label: `${attempt.bulls}/${attempt.cows}`,
    values: attempt.guess,
  })), 10);
  drawDigitInput(app, state.guess, state.selectedSlot, onTap);
  drawDigitPalette(app, onTap);
  drawButton(app, SUBMIT_INDEX, t('cognitive.play.submit'), app.renderer.width / 2, app.renderer.height - 72, 180, 48, onTap);
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

function drawSimon(app: Application, state: SimonState, onTap: (index: number) => void, t: TFunction) {
  drawHeader(app, t('cognitive.simon.title'), state.status === 'showing' ? t('cognitive.simon.watch') : t('cognitive.simon.repeat'));
  const size = Math.min(360, app.renderer.width - 64, app.renderer.height - 180);
  const startX = (app.renderer.width - size) / 2;
  const startY = (app.renderer.height - size) / 2 + 40;
  const colors = [0x005eb8, 0x16794a, 0xd97706, 0xb54747];
  for (let index = 0; index < 4; index += 1) {
    const node = interactiveNode(onTap, index);
    const col = index % 2;
    const row = Math.floor(index / 2);
    node.x = startX + col * (size / 2 + 8);
    node.y = startY + row * (size / 2 + 8);
    const lit = state.litIndex === index;
    const g = new Graphics();
    g.roundRect(0, 0, size / 2 - 8, size / 2 - 8, 8)
      .fill({ color: colors[index], alpha: lit ? 1 : 0.42 })
      .stroke({ color: lit ? 0xffffff : COGNITIVE_BORDER, width: lit ? 4 : 1 });
    node.addChild(g);
    app.stage.addChild(node);
  }
  addText(app.stage, `${state.sequence.length}/${state.targetRounds}`, app.renderer.width / 2, startY + size + 24, {
    fontSize: 24,
    fontWeight: '900',
    fill: '#1A1C1E',
  });
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
    finishGame('Defeat');
    return;
  }
  const aiMove = chooseTicTacToeMove(state);
  if (aiMove !== null) {
    state.board[aiMove] = 'O';
    state.aiMoves += 1;
  }
  if (checkMarkWin(state.board, state.size, state.winLength, 'O') || state.board.every(Boolean)) finishGame('Defeat');
}

function drawTicTacToe(app: Application, state: TicTacToeState, onTap: (index: number) => void, t: TFunction) {
  drawHeader(app, t('cognitive.tictactoe.title'), t('cognitive.play.youBlue'));
  const { cell, gap, startX, startY } = getGridLayout(app, state.size, state.size, 92, 8);
  state.board.forEach((mark, index) => {
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    const node = interactiveNode(onTap, index);
    node.x = startX + col * (cell + gap);
    node.y = startY + row * (cell + gap);
    const g = new Graphics();
    g.roundRect(0, 0, cell, cell, 8).fill(COGNITIVE_SURFACE).stroke({ color: COGNITIVE_BORDER, width: 2 });
    node.addChild(g);
    if (mark) {
      addText(node, mark, cell / 2, cell / 2, {
        fontSize: Math.max(28, cell * 0.52),
        fontWeight: '900',
        fill: mark === 'X' ? '#005EB8' : '#B54747',
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

function drawConnect4(app: Application, state: Connect4State, onTap: (index: number) => void, t: TFunction) {
  drawHeader(app, t('cognitive.connect4.title'), t('cognitive.play.dropDisc'));
  const { cell, gap, startX, startY } = getGridLayout(app, state.cols, state.rows, 62, 6);
  state.board.forEach((disc, index) => {
    const row = Math.floor(index / state.cols);
    const col = index % state.cols;
    const node = interactiveNode(onTap, col);
    node.x = startX + col * (cell + gap);
    node.y = startY + row * (cell + gap);
    const g = new Graphics();
    g.roundRect(0, 0, cell, cell, 6).fill(COGNITIVE_ACCENT_TINT).stroke({ color: COGNITIVE_BORDER, width: 1 });
    g.circle(cell / 2, cell / 2, cell * 0.35).fill(disc === 'P' ? PLAYER_COLOR : disc === 'A' ? AI_COLOR : COGNITIVE_SURFACE);
    node.addChild(g);
    app.stage.addChild(node);
  });
}

function createNimState(difficulty: Difficulty): NimState {
  const piles = [[3, 4, 5], [4, 5, 6], [5, 7, 9]][difficultyIndex(difficulty)];
  return { kind: 'nim', piles: [...piles], moves: 0, aiMoves: 0, errors: 0 };
}

function handleNimTap(state: NimState, index: number, finishGame: (result: GameResult) => void) {
  const pile = Math.floor(index / 100);
  const take = state.piles[pile] - (index % 100);
  if (!state.piles[pile] || take < 1 || take > state.piles[pile]) {
    state.errors += 1;
    return;
  }
  state.piles[pile] -= take;
  state.moves += 1;
  if (totalNimObjects(state.piles) === 0) {
    finishGame('Defeat');
    return;
  }
  const aiMove = chooseNimMove(state);
  state.piles[aiMove.pile] -= aiMove.take;
  state.aiMoves += 1;
  if (totalNimObjects(state.piles) === 0) finishGame('Victory');
}

function drawNim(app: Application, state: NimState, onTap: (index: number) => void, t: TFunction) {
  drawHeader(app, t('cognitive.nim.title'), t('cognitive.play.nim'));
  const maxPile = Math.max(...state.piles, 1);
  const gap = 12;
  const circle = Math.min(44, (app.renderer.width - 96 - gap * (maxPile - 1)) / maxPile);
  const startY = 150;
  state.piles.forEach((count, pile) => {
    addText(app.stage, String(pile + 1), 48, startY + pile * 82 + circle / 2, {
      fontSize: 20,
      fontWeight: '900',
      fill: '#424752',
    });
    for (let item = 0; item < count; item += 1) {
      const node = interactiveNode(onTap, pile * 100 + item);
      node.x = 86 + item * (circle + gap);
      node.y = startY + pile * 82;
      const g = new Graphics();
      g.circle(circle / 2, circle / 2, circle / 2).fill(COGNITIVE_ACCENT).stroke({ color: COGNITIVE_BORDER, width: 1 });
      node.addChild(g);
      app.stage.addChild(node);
    }
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

function drawDotsAndBoxes(app: Application, state: DotsAndBoxesState, onTap: (index: number) => void, t: TFunction) {
  drawHeader(app, t('cognitive.dots.title'), `${t('cognitive.play.score')}: ${state.playerScore}/${state.aiScore}`);
  const { cell, startX, startY } = getGridLayout(app, state.size, state.size, 72, 0);
  for (let row = 0; row < state.size - 1; row += 1) {
    for (let col = 0; col < state.size - 1; col += 1) {
      const owner = state.boxes[row * (state.size - 1) + col];
      if (!owner) continue;
      const g = new Graphics();
      g.rect(startX + col * cell + 8, startY + row * cell + 8, cell - 16, cell - 16)
        .fill({ color: owner === 'P' ? COGNITIVE_ACCENT : AI_COLOR, alpha: 0.16 });
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
      dot.circle(startX + col * cell, startY + row * cell, 5).fill(COGNITIVE_TEXT);
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

function drawHex(app: Application, state: HexState, onTap: (index: number) => void, t: TFunction) {
  drawHeader(app, t('cognitive.hex.title'), t('cognitive.play.connectSides'));
  const radius = Math.min(31, (app.renderer.width - 96) / (state.size * 1.55), (app.renderer.height - 180) / (state.size * 1.35));
  const width = radius * Math.sqrt(3);
  const startX = (app.renderer.width - (state.size + state.size / 2) * width) / 2 + width;
  const startY = 145;
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
      .fill(value === 1 ? PLAYER_COLOR : value === 2 ? AI_COLOR : COGNITIVE_SURFACE)
      .stroke({ color: COGNITIVE_BORDER, width: 2 });
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

function drawSetGame(app: Application, state: SetGameState, onTap: (index: number) => void, t: TFunction) {
  drawHeader(app, t('cognitive.set.title'), `${state.found}/${state.targetSets}`);
  const cols = 4;
  const rows = Math.ceil(state.board.length / cols);
  const { cell, gap, startX, startY } = getGridLayout(app, cols, rows, 116, 10);
  state.board.forEach((card, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const selected = state.selected.includes(index);
    const node = interactiveNode(onTap, index);
    node.x = startX + col * (cell + gap);
    node.y = startY + row * (cell + gap);
    const g = new Graphics();
    g.roundRect(0, 0, cell, cell, 8)
      .fill(selected ? COGNITIVE_ACCENT_TINT : COGNITIVE_SURFACE)
      .stroke({ color: selected ? COGNITIVE_ACCENT : COGNITIVE_BORDER, width: selected ? 3 : 1 });
    node.addChild(g);
    drawSetCard(node, card, cell);
    app.stage.addChild(node);
  });
}

function createTangramState(): TangramState {
  const pieces: TangramPiece[] = [
    { id: 0, shape: 'large-triangle', placed: false },
    { id: 1, shape: 'large-triangle', placed: false },
    { id: 2, shape: 'medium-triangle', placed: false },
    { id: 3, shape: 'small-triangle', placed: false },
    { id: 4, shape: 'small-triangle', placed: false },
    { id: 5, shape: 'square', placed: false },
    { id: 6, shape: 'parallelogram', placed: false },
  ];
  return { kind: 'tangram', pieces, slots: shuffle(pieces.map((piece) => piece.id)), selectedPieceId: null, moves: 0, errors: 0 };
}

function handleTangramTap(state: TangramState, index: number, finishGame: (result: GameResult) => void) {
  if (index >= TANGRAM_PIECE_OFFSET && index < TANGRAM_SLOT_OFFSET) {
    const pieceId = index - TANGRAM_PIECE_OFFSET;
    const piece = state.pieces.find((candidate) => candidate.id === pieceId);
    if (piece && !piece.placed) state.selectedPieceId = pieceId;
    return;
  }
  if (index < TANGRAM_SLOT_OFFSET) return;
  const slot = index - TANGRAM_SLOT_OFFSET;
  if (state.selectedPieceId === null || state.slots[slot] === undefined) return;
  const piece = state.pieces.find((candidate) => candidate.id === state.selectedPieceId);
  state.moves += 1;
  if (piece && state.slots[slot] === piece.id) {
    piece.placed = true;
    state.selectedPieceId = null;
    if (state.pieces.every((candidate) => candidate.placed)) finishGame('Victory');
    return;
  }
  state.errors += 1;
}

function drawTangram(app: Application, state: TangramState, onTap: (index: number) => void, t: TFunction) {
  drawHeader(app, t('cognitive.tangram.title'), t('cognitive.play.matchSilhouette'));
  const slotSize = Math.min(84, (app.renderer.width - 96) / 7);
  const topY = 150;
  const startX = (app.renderer.width - (slotSize * 7 + 8 * 6)) / 2;
  state.slots.forEach((pieceId, slot) => {
    const piece = state.pieces[pieceId];
    const node = interactiveNode(onTap, TANGRAM_SLOT_OFFSET + slot);
    node.x = startX + slot * (slotSize + 8);
    node.y = topY;
    const g = new Graphics();
    g.roundRect(0, 0, slotSize, slotSize, 8).fill(COGNITIVE_SURFACE).stroke({ color: COGNITIVE_BORDER, width: 2 });
    node.addChild(g);
    if (piece.placed) drawTangramPiece(node, piece.shape, slotSize / 2, slotSize / 2, slotSize * 0.34, COGNITIVE_ACCENT, true);
    else drawTangramPiece(node, piece.shape, slotSize / 2, slotSize / 2, slotSize * 0.34, COGNITIVE_BORDER, false);
    app.stage.addChild(node);
  });
  const pieces = state.pieces.filter((piece) => !piece.placed);
  const bottomY = Math.min(app.renderer.height - slotSize - 96, topY + slotSize + 120);
  const pieceStartX = (app.renderer.width - (slotSize * 7 + 8 * 6)) / 2;
  pieces.forEach((piece, index) => {
    const node = interactiveNode(onTap, TANGRAM_PIECE_OFFSET + piece.id);
    node.x = pieceStartX + index * (slotSize + 8);
    node.y = bottomY;
    const selected = state.selectedPieceId === piece.id;
    const g = new Graphics();
    g.roundRect(0, 0, slotSize, slotSize, 8)
      .fill(selected ? COGNITIVE_ACCENT_TINT : COGNITIVE_SURFACE)
      .stroke({ color: selected ? COGNITIVE_ACCENT : COGNITIVE_BORDER, width: selected ? 3 : 1 });
    node.addChild(g);
    drawTangramPiece(node, piece.shape, slotSize / 2, slotSize / 2, slotSize * 0.34, SET_COLORS[piece.id % SET_COLORS.length], true);
    app.stage.addChild(node);
  });
}

function createSokobanState(difficulty: Difficulty): SokobanState {
  const levels = [
    ['#####', '#@  #', '# $ #', '# . #', '#####'],
    ['######', '#@   #', '# $$ #', '# .. #', '######'],
    ['#######', '#@    #', '# $$  #', '#  #. #', '#   . #', '#######'],
  ];
  const layout = levels[difficultyIndex(difficulty)];
  const walls: number[] = [];
  const boxes: number[] = [];
  const targets: number[] = [];
  let player = 0;
  layout.forEach((line, row) => {
    [...line].forEach((char, col) => {
      const index = row * line.length + col;
      if (char === '#') walls.push(index);
      if (char === '$' || char === '*') boxes.push(index);
      if (char === '.' || char === '*' || char === '+') targets.push(index);
      if (char === '@' || char === '+') player = index;
    });
  });
  return { kind: 'sokoban', rows: layout.length, cols: layout[0].length, walls, boxes, targets, player, moves: 0, pushes: 0, errors: 0 };
}

function handleSokobanTap(state: SokobanState, index: number, finishGame: (result: GameResult) => void) {
  const playerRow = Math.floor(state.player / state.cols);
  const playerCol = state.player % state.cols;
  const targetRow = Math.floor(index / state.cols);
  const targetCol = index % state.cols;
  const dy = targetRow - playerRow;
  const dx = targetCol - playerCol;
  if (Math.abs(dx) + Math.abs(dy) !== 1) {
    state.errors += 1;
    return;
  }
  const next = state.player + dy * state.cols + dx;
  const boxAt = state.boxes.indexOf(next);
  if (state.walls.includes(next)) {
    state.errors += 1;
    return;
  }
  if (boxAt >= 0) {
    const boxNext = next + dy * state.cols + dx;
    if (state.walls.includes(boxNext) || state.boxes.includes(boxNext)) {
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

function drawSokoban(app: Application, state: SokobanState, onTap: (index: number) => void, t: TFunction) {
  drawHeader(app, t('cognitive.sokoban.title'), t('cognitive.play.pushBoxes'));
  const { cell, gap, startX, startY } = getGridLayout(app, state.cols, state.rows, 74, 4);
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
    g.roundRect(0, 0, cell, cell, 6)
      .fill(wall ? COGNITIVE_TEXT_MUTED : COGNITIVE_SURFACE)
      .stroke({ color: COGNITIVE_BORDER, width: 1 });
    if (target) g.circle(cell / 2, cell / 2, cell * 0.14).fill(SUCCESS_COLOR);
    if (box) g.roundRect(cell * 0.2, cell * 0.2, cell * 0.6, cell * 0.6, 6).fill(target ? SUCCESS_COLOR : WARNING_COLOR);
    if (state.player === index) g.circle(cell / 2, cell / 2, cell * 0.24).fill(COGNITIVE_ACCENT);
    node.addChild(g);
    app.stage.addChild(node);
  }
}

function createMazeState(difficulty: Difficulty): MazeState {
  const size = [8, 10, 12][difficultyIndex(difficulty)];
  return {
    kind: 'maze',
    size,
    cells: generateMaze(size),
    current: 0,
    end: size * size - 1,
    moves: 0,
    errors: 0,
  };
}

function handleMazeTap(state: MazeState, index: number, finishGame: (result: GameResult) => void) {
  if (!canMoveMaze(state, state.current, index)) {
    state.errors += 1;
    return;
  }
  state.current = index;
  state.moves += 1;
  if (state.current === state.end) finishGame('Victory');
}

function drawMaze(app: Application, state: MazeState, onTap: (index: number) => void, t: TFunction, elapsed: number) {
  drawHeader(app, t('cognitive.maze.title'), t('cognitive.play.elapsed', { value: Math.floor(elapsed) }));
  const { cell, startX, startY } = getGridLayout(app, state.size, state.size, 42, 0);
  state.cells.forEach((mazeCell, index) => {
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    const node = interactiveNode(onTap, index);
    node.x = startX + col * cell;
    node.y = startY + row * cell;
    const bg = new Graphics();
    bg.rect(0, 0, cell, cell).fill(index === state.end ? COGNITIVE_ACCENT_TINT : COGNITIVE_SURFACE);
    bg.moveTo(0, 0);
    if (mazeCell.top) bg.lineTo(cell, 0);
    else bg.moveTo(cell, 0);
    if (mazeCell.right) bg.lineTo(cell, cell);
    else bg.moveTo(cell, cell);
    if (mazeCell.bottom) bg.lineTo(0, cell);
    else bg.moveTo(0, cell);
    if (mazeCell.left) bg.lineTo(0, 0);
    bg.stroke({ color: COGNITIVE_TEXT_MUTED, width: 2 });
    if (index === state.current) bg.circle(cell / 2, cell / 2, cell * 0.24).fill(COGNITIVE_ACCENT);
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

function drawHeader(app: Application, title: string, subtitle: string) {
  const panel = new Graphics();
  panel.roundRect(24, 20, app.renderer.width - 48, 72, 8)
    .fill({ color: COGNITIVE_SURFACE, alpha: 0.96 })
    .stroke({ color: COGNITIVE_BORDER, width: 1 });
  app.stage.addChild(panel);
  const titleText = new Text({
    text: title,
    style: { fontSize: 22, fontWeight: '900', fill: '#1A1C1E' },
  });
  titleText.anchor.set(0, 0.5);
  titleText.x = 44;
  titleText.y = 44;
  app.stage.addChild(titleText);
  const subtitleText = new Text({
    text: subtitle,
    style: { fontSize: 15, fontWeight: '700', fill: '#424752' },
  });
  subtitleText.anchor.set(0, 0.5);
  subtitleText.x = 44;
  subtitleText.y = 70;
  app.stage.addChild(subtitleText);
}

function drawButton(app: Application, index: number, label: string, cx: number, cy: number, width: number, height: number, onTap: (index: number) => void) {
  const node = interactiveNode(onTap, index);
  node.x = cx - width / 2;
  node.y = cy - height / 2;
  const g = new Graphics();
  g.roundRect(0, 0, width, height, 8).fill(COGNITIVE_ACCENT).stroke({ color: COGNITIVE_ACCENT, width: 2 });
  node.addChild(g);
  addText(node, label, width / 2, height / 2, {
    fontSize: 18,
    fontWeight: '900',
    fill: '#FFFFFF',
  });
  app.stage.addChild(node);
}

function drawGuessHistory(app: Application, rows: Array<{ values: number[]; label: string }>, paletteSize: number) {
  const startX = 40;
  const startY = 122;
  const cell = 26;
  rows.slice(-8).forEach((row, rowIndex) => {
    row.values.forEach((value, col) => {
      const g = new Graphics();
      g.circle(startX + col * 34 + cell / 2, startY + rowIndex * 34 + cell / 2, cell / 2)
        .fill(paletteSize === 10 ? COGNITIVE_ACCENT_TINT : MASTERMIND_COLORS[value] ?? COGNITIVE_BG)
        .stroke({ color: COGNITIVE_BORDER, width: 1 });
      app.stage.addChild(g);
      if (paletteSize === 10) {
        addText(app.stage, String(value), startX + col * 34 + cell / 2, startY + rowIndex * 34 + cell / 2, {
          fontSize: 15,
          fontWeight: '900',
          fill: '#005EB8',
        });
      }
    });
    const text = new Text({ text: row.label, style: { fontSize: 15, fontWeight: '900', fill: '#424752' } });
    text.anchor.set(0, 0.5);
    text.x = startX + 150;
    text.y = startY + rowIndex * 34 + cell / 2;
    app.stage.addChild(text);
  });
}

function drawCodeInput(app: Application, guess: number[], selectedSlot: number, onTap: (index: number) => void) {
  const cell = 54;
  const startX = (app.renderer.width - guess.length * (cell + 12)) / 2;
  const y = app.renderer.height / 2 - 20;
  guess.forEach((value, index) => {
    const node = interactiveNode(onTap, index);
    node.x = startX + index * (cell + 12);
    node.y = y;
    const g = new Graphics();
    g.circle(cell / 2, cell / 2, cell / 2)
      .fill(value >= 0 ? MASTERMIND_COLORS[value] : COGNITIVE_SURFACE)
      .stroke({ color: selectedSlot === index ? COGNITIVE_ACCENT : COGNITIVE_BORDER, width: selectedSlot === index ? 4 : 2 });
    node.addChild(g);
    app.stage.addChild(node);
  });
}

function drawColorPalette(app: Application, colorCount: number, onTap: (index: number) => void) {
  const cell = 44;
  const startX = (app.renderer.width - colorCount * (cell + 10)) / 2;
  const y = app.renderer.height / 2 + 70;
  for (let color = 0; color < colorCount; color += 1) {
    const node = interactiveNode(onTap, COLOR_OFFSET + color);
    node.x = startX + color * (cell + 10);
    node.y = y;
    const g = new Graphics();
    g.circle(cell / 2, cell / 2, cell / 2).fill(MASTERMIND_COLORS[color]).stroke({ color: COGNITIVE_BORDER, width: 1 });
    node.addChild(g);
    app.stage.addChild(node);
  }
}

function drawDigitInput(app: Application, guess: number[], selectedSlot: number, onTap: (index: number) => void) {
  const cell = 54;
  const startX = (app.renderer.width - guess.length * (cell + 12)) / 2;
  const y = app.renderer.height / 2 - 20;
  guess.forEach((value, index) => {
    const node = interactiveNode(onTap, index);
    node.x = startX + index * (cell + 12);
    node.y = y;
    const g = new Graphics();
    g.roundRect(0, 0, cell, cell, 8)
      .fill(COGNITIVE_SURFACE)
      .stroke({ color: selectedSlot === index ? COGNITIVE_ACCENT : COGNITIVE_BORDER, width: selectedSlot === index ? 4 : 2 });
    node.addChild(g);
    if (value >= 0) addText(node, String(value), cell / 2, cell / 2, { fontSize: 28, fontWeight: '900', fill: '#005EB8' });
    app.stage.addChild(node);
  });
}

function drawDigitPalette(app: Application, onTap: (index: number) => void) {
  const cell = 38;
  const cols = 5;
  const startX = (app.renderer.width - cols * (cell + 8)) / 2;
  const y = app.renderer.height / 2 + 66;
  for (let digit = 0; digit < 10; digit += 1) {
    const node = interactiveNode(onTap, DIGIT_OFFSET + digit);
    node.x = startX + (digit % cols) * (cell + 8);
    node.y = y + Math.floor(digit / cols) * (cell + 8);
    const g = new Graphics();
    g.roundRect(0, 0, cell, cell, 8).fill(COGNITIVE_ACCENT_TINT).stroke({ color: COGNITIVE_BORDER, width: 1 });
    node.addChild(g);
    addText(node, String(digit), cell / 2, cell / 2, { fontSize: 20, fontWeight: '900', fill: '#005EB8' });
    app.stage.addChild(node);
  }
}

function scoreMastermindGuess(secret: number[], guess: number[]) {
  const exact = guess.reduce((sum, value, index) => sum + (value === secret[index] ? 1 : 0), 0);
  const colorOnly = guess.filter((value, index) => value !== secret[index] && secret.includes(value)).length;
  return { exact, colorOnly };
}

function scoreBullsGuess(secret: number[], guess: number[]) {
  const bulls = guess.reduce((sum, value, index) => sum + (value === secret[index] ? 1 : 0), 0);
  const cows = guess.filter((value, index) => value !== secret[index] && secret.includes(value)).length;
  return { bulls, cows };
}

function countQueens(state: NQueensState) {
  return state.queens.filter(Boolean).length;
}

function countQueenConflicts(state: NQueensState) {
  return getQueenConflictIndexes(state).size;
}

function getQueenConflictIndexes(state: NQueensState) {
  const conflicts = new Set<number>();
  const queens = state.queens
    .map((queen, index) => ({ queen, index, row: Math.floor(index / state.size), col: index % state.size }))
    .filter((item) => item.queen);
  queens.forEach((first, firstIndex) => {
    queens.slice(firstIndex + 1).forEach((second) => {
      if (first.row === second.row || first.col === second.col || Math.abs(first.row - second.row) === Math.abs(first.col - second.col)) {
        conflicts.add(first.index);
        conflicts.add(second.index);
      }
    });
  });
  return conflicts;
}

function isKnightMove(from: number, to: number, size: number) {
  const dy = Math.abs(Math.floor(from / size) - Math.floor(to / size));
  const dx = Math.abs((from % size) - (to % size));
  return (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
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

function totalNimObjects(piles: number[]) {
  return piles.reduce((sum, pile) => sum + pile, 0);
}

function chooseNimMove(state: NimState) {
  const nonEmpty = state.piles.map((count, pile) => ({ count, pile })).filter((item) => item.count > 0);
  const total = totalNimObjects(state.piles);
  const leaveOne = nonEmpty.find((item) => item.count >= total - 1);
  if (leaveOne && total > 1) return { pile: leaveOne.pile, take: Math.max(1, total - 1) };
  const pile = nonEmpty[Math.floor(Math.random() * nonEmpty.length)];
  return { pile: pile.pile, take: Math.max(1, Math.floor(Math.random() * pile.count) + 1) };
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
  hit.rect(-9, -9, w + 18, h + 18).fill({ color: COGNITIVE_SURFACE, alpha: 0.001 });
  hit.moveTo(x1 - minX, y1 - minY).lineTo(x2 - minX, y2 - minY)
    .stroke({ color: drawn ? COGNITIVE_ACCENT : COGNITIVE_BORDER, width: drawn ? 5 : 2 });
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

function drawSetCard(container: Container, card: SetCard, size: number) {
  const shapeGap = size / (card.count + 1);
  for (let i = 0; i < card.count; i += 1) {
    drawSetShape(container, card, size / 2, shapeGap * (i + 1), size * 0.18);
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

function drawTangramPiece(container: Container, shape: TangramPiece['shape'], cx: number, cy: number, size: number, color: number, filled: boolean) {
  const g = new Graphics();
  if (shape.includes('triangle')) {
    const scale = shape === 'large-triangle' ? 1.15 : shape === 'medium-triangle' ? 0.96 : 0.74;
    g.moveTo(cx, cy - size * scale).lineTo(cx + size * scale, cy + size * scale).lineTo(cx - size * scale, cy + size * scale).closePath();
  } else if (shape === 'square') {
    g.rect(cx - size * 0.8, cy - size * 0.8, size * 1.6, size * 1.6);
  } else {
    g.moveTo(cx - size, cy + size * 0.7).lineTo(cx + size * 0.45, cy + size * 0.7).lineTo(cx + size, cy - size * 0.7).lineTo(cx - size * 0.45, cy - size * 0.7).closePath();
  }
  if (filled) g.fill({ color, alpha: 0.86 });
  g.stroke({ color, width: 3 });
  container.addChild(g);
}

function isSokobanSolved(state: SokobanState) {
  return state.boxes.every((box) => state.targets.includes(box));
}

function countSolvedBoxes(state: SokobanState) {
  return state.boxes.filter((box) => state.targets.includes(box)).length;
}

function generateMaze(size: number): MazeCell[] {
  const cells: MazeCell[] = Array.from({ length: size * size }, () => ({ top: true, right: true, bottom: true, left: true }));
  const visited = new Set<number>([0]);
  const stack = [0];
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

function createBinarySolution(size: number) {
  const rows = validBinaryRows(size);
  const solution: number[] = [];
  const chosen: number[][] = [];
  function backtrack(row: number): boolean {
    if (row === size) {
      const cols = Array.from({ length: size }, (_, col) => chosen.map((values) => values[col]).join(''));
      return new Set(cols).size === size && cols.every((col) => isValidBinaryLine([...col].map(Number), true));
    }
    const candidates = shuffle(rows).filter((candidate) => !chosen.some((picked) => picked.join('') === candidate.join('')));
    for (const candidate of candidates) {
      chosen.push(candidate);
      if (columnsStillValid(chosen, size) && backtrack(row + 1)) return true;
      chosen.pop();
    }
    return false;
  }
  backtrack(0);
  chosen.forEach((row) => solution.push(...row));
  return solution.length === size * size ? solution : Array.from({ length: size * size }, (_, index) => (Math.floor(index / size) + index) % 2);
}

function validBinaryRows(size: number) {
  const rows: number[][] = [];
  const build = (prefix: number[]) => {
    if (prefix.length === size) {
      if (isValidBinaryLine(prefix, true)) rows.push(prefix);
      return;
    }
    [0, 1].forEach((value) => build([...prefix, value]));
  };
  build([]);
  return rows;
}

function columnsStillValid(chosen: number[][], size: number) {
  for (let col = 0; col < size; col += 1) {
    const column = chosen.map((row) => row[col]);
    if (!isValidBinaryLine(column, false, size)) return false;
  }
  return true;
}

function isValidBinaryLine(values: number[], complete: boolean, size = values.length) {
  for (let index = 2; index < values.length; index += 1) {
    if (values[index] === values[index - 1] && values[index] === values[index - 2]) return false;
  }
  const ones = values.filter((value) => value === 1).length;
  const zeros = values.filter((value) => value === 0).length;
  return complete ? ones === zeros : ones <= size / 2 && zeros <= size / 2;
}
