export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type GameResult = 'Victory' | 'Defeat';

export interface MemoryCard {
  value: string;
  revealed: boolean;
  matched: boolean;
}

export interface MemoryState {
  kind: 'memory-match';
  rows: number;
  cols: number;
  pairs: number;
  cards: MemoryCard[];
  flipped: number[];
  matchedPairs: number;
  moves: number;
  errors: number;
  mismatchClearAt: number | null;
}
