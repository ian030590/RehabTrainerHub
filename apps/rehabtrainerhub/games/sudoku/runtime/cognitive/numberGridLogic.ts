export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type GameResult = 'Victory' | 'Defeat';
export type NumberGridKind = 'latin-square' | 'magic-square' | 'sudoku';

export interface NumberGridState {
  kind: NumberGridKind;
  size: number;
  boxSize?: number;
  solution: number[];
  values: number[];
  givens: boolean[];
  moves: number;
  errors: number;
}

const sudokuSolution = [
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

export function CreateNumberGridState(difficulty: Difficulty, random = Math.random): NumberGridState {
  const kind: NumberGridKind = difficulty === 'Beginner' ? 'latin-square'
    : difficulty === 'Intermediate' ? 'magic-square' : 'sudoku';
  const size = kind === 'latin-square' ? 4 : kind === 'magic-square' ? 3 : 9;
  const blanks = kind === 'sudoku' ? 50 : 6;
  const solution = kind === 'latin-square'
    ? Array.from({ length: size * size }, (_, index) => ((Math.floor(index / size) + index) % size) + 1)
    : kind === 'magic-square' ? [8, 1, 6, 3, 5, 7, 4, 9, 2] : [...sudokuSolution];
  const positions = Array.from({ length: solution.length }, (_, index) => index);
  for (let index = positions.length - 1; index > 0; index -= 1) {
    const next = Math.floor(random() * (index + 1));
    [positions[index], positions[next]] = [positions[next], positions[index]];
  }
  const givens = Array(solution.length).fill(true) as boolean[];
  const values = [...solution];
  for (const index of positions.slice(0, blanks)) {
    givens[index] = false;
    values[index] = 0;
  }
  return { kind, size, boxSize: kind === 'sudoku' ? 3 : undefined, solution, values, givens, moves: 0, errors: 0 };
}

export function IsNumberGridSolved(state: NumberGridState) {
  return state.values.every((value, index) => value === state.solution[index]);
}

export function HandleNumberGridTap(state: NumberGridState, index: number, finishGame: (result: GameResult) => void) {
  if (!Number.isInteger(index) || index < 0 || index >= state.values.length || state.givens[index]) return;
  const max = state.kind === 'magic-square' ? 9 : state.size;
  state.values[index] = state.values[index] >= max ? 0 : state.values[index] + 1;
  state.moves += 1;
  if (IsNumberGridSolved(state)) finishGame('Victory');
  else if (state.values.every(value => value !== 0)) state.errors += 1;
}

export function GetNumberGridTimedOutcome(state: NumberGridState, startedMs: number, nowMs: number, limitSec: number): GameResult | null {
  if (limitSec <= 0 || nowMs - startedMs < limitSec * 1000) return null;
  return IsNumberGridSolved(state) ? 'Victory' : 'Defeat';
}

export function BuildNumberGridResultData(state: NumberGridState, durationSec: number, result: GameResult) {
  return {
    Total_Duration_Seconds: durationSec,
    Moves: state.moves,
    Completed: result === 'Victory',
    Errors: state.errors,
    Board_Size: state.size,
    Puzzle_Kind: state.kind === 'latin-square' ? 0 : state.kind === 'magic-square' ? 1 : 2,
    Initial_Blanks: state.givens.filter(given => !given).length,
  };
}
