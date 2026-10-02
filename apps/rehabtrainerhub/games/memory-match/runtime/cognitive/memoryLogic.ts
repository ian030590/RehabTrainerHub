import type { Difficulty, GameResult, MemoryState } from './types';

const memoryConfig: Record<Difficulty, { rows: number; cols: number; pairs: number }> = {
  Beginner: { rows: 3, cols: 4, pairs: 6 },
  Intermediate: { rows: 4, cols: 4, pairs: 8 },
  Advanced: { rows: 4, cols: 5, pairs: 10 },
};

function Shuffle<T>(items: T[], random: () => number): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function CreateMemoryState(difficulty: Difficulty, random = Math.random): MemoryState {
  const { rows, cols, pairs } = memoryConfig[difficulty];
  const values = Shuffle('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), random).slice(0, pairs);
  const cards = Shuffle([...values, ...values], random).map((value) => ({
    value, revealed: false, matched: false,
  }));
  return {
    kind: 'memory-match', rows, cols, pairs, cards, flipped: [],
    matchedPairs: 0, moves: 0, errors: 0, mismatchClearAt: null,
  };
}

export function HandleMemoryTap(state: MemoryState, index: number, elapsed: number, finishGame: (result: GameResult) => void) {
  if (state.mismatchClearAt !== null || state.flipped.length >= 2) return;
  const card = state.cards[index];
  if (!card || card.revealed || card.matched) return;
  card.revealed = true;
  state.flipped.push(index);
  if (state.flipped.length !== 2) return;

  state.moves += 1;
  const [first, second] = state.flipped;
  if (state.cards[first].value === state.cards[second].value) {
    state.cards[first].matched = true;
    state.cards[second].matched = true;
    state.flipped = [];
    state.matchedPairs += 1;
    if (IsMemoryAutoSuccess(state)) finishGame('Victory');
  } else {
    state.errors += 1;
    state.mismatchClearAt = elapsed + 0.75;
  }
}

export function UpdateMemoryTimedState(state: MemoryState, elapsed: number, render: () => void) {
  if (state.mismatchClearAt === null || elapsed < state.mismatchClearAt) return;
  state.flipped.forEach((index) => { state.cards[index].revealed = false; });
  state.flipped = [];
  state.mismatchClearAt = null;
  render();
}

export function IsMemoryAutoSuccess(state: MemoryState) {
  return state.matchedPairs === state.pairs;
}

export function GetMemoryTimedOutcome(state: MemoryState, startedAtMs: number, nowMs: number, limitSec: number) {
  if (limitSec === 0 || nowMs < startedAtMs + limitSec * 1000) return null;
  return IsMemoryAutoSuccess(state) ? 'Victory' : 'Defeat';
}

export function BuildMemoryResultData(state: MemoryState, durationSec: number, result: GameResult) {
  return {
    Total_Duration_Seconds: durationSec,
    Moves: state.moves,
    Completed: result === 'Victory',
    Errors: state.errors,
    Matched_Pairs: state.matchedPairs,
    Target_Pairs: state.pairs,
  };
}
