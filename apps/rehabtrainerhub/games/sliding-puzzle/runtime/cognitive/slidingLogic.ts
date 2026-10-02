export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type GameResult = 'Victory' | 'Defeat';

export interface SlidingState {
  kind: 'sliding-puzzle';
  size: number;
  tiles: number[];
  blankIndex: number;
  moves: number;
  errors: number;
}

const configs: Record<Difficulty, { size: number; shuffles: number }> = {
  Beginner: { size: 3, shuffles: 36 },
  Intermediate: { size: 4, shuffles: 72 },
  Advanced: { size: 5, shuffles: 120 },
};

function GetNeighbors(index: number, size: number) {
  const row = Math.floor(index / size);
  const col = index % size;
  return [
    row > 0 ? index - size : null,
    row < size - 1 ? index + size : null,
    col > 0 ? index - 1 : null,
    col < size - 1 ? index + 1 : null,
  ].filter((value): value is number => value !== null);
}

export function IsSlidingAutoSuccess(state: SlidingState) {
  return state.tiles.every((tile, index) => tile === (index + 1) % state.tiles.length);
}

export function CreateSlidingState(difficulty: Difficulty, random = Math.random): SlidingState {
  const { size, shuffles } = configs[difficulty];
  const total = size * size;
  const state: SlidingState = {
    kind: 'sliding-puzzle', size,
    tiles: Array.from({ length: total }, (_, index) => (index + 1) % total),
    blankIndex: total - 1, moves: 0, errors: 0,
  };
  let lastBlank = -1;
  for (let i = 0; i < shuffles; i += 1) {
    const neighbors = GetNeighbors(state.blankIndex, size).filter(index => index !== lastBlank);
    const next = neighbors[Math.floor(random() * neighbors.length)];
    [state.tiles[state.blankIndex], state.tiles[next]] = [state.tiles[next], state.tiles[state.blankIndex]];
    lastBlank = state.blankIndex;
    state.blankIndex = next;
  }
  if (IsSlidingAutoSuccess(state)) {
    const next = GetNeighbors(state.blankIndex, size)[0];
    [state.tiles[state.blankIndex], state.tiles[next]] = [state.tiles[next], state.tiles[state.blankIndex]];
    state.blankIndex = next;
  }
  return state;
}

export function HandleSlidingTap(state: SlidingState, index: number, finishGame: (result: GameResult) => void) {
  if (!Number.isInteger(index) || index < 0 || index >= state.tiles.length || index === state.blankIndex) return;
  if (!GetNeighbors(state.blankIndex, state.size).includes(index)) {
    state.errors += 1;
    return;
  }
  [state.tiles[state.blankIndex], state.tiles[index]] = [state.tiles[index], state.tiles[state.blankIndex]];
  state.blankIndex = index;
  state.moves += 1;
  if (IsSlidingAutoSuccess(state)) finishGame('Victory');
}

export function GetSlidingTimedOutcome(state: SlidingState, startedMs: number, nowMs: number, limitSec: number): GameResult | null {
  if (limitSec <= 0 || nowMs - startedMs < limitSec * 1000) return null;
  return IsSlidingAutoSuccess(state) ? 'Victory' : 'Defeat';
}

export function BuildSlidingResultData(state: SlidingState, durationSec: number, result: GameResult) {
  return {
    Total_Duration_Seconds: durationSec,
    Moves: state.moves,
    Completed: result === 'Victory',
    Errors: state.errors,
    Board_Size: state.size,
  };
}
