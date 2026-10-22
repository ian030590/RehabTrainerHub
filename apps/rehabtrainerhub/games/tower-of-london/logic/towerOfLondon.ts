// Balls: 1 green, 2 red, 3 blue. Each peg lists its balls from the bottom up.
export type Board = number[][];
export interface TowerProblem { target: Board; minimumMoves: number }
export interface TowerState { board: Board; held: number | null; moves: number }
export interface PlannedProblem extends TowerProblem { practice: boolean; index: number | null }

export const capacities = [3, 2, 1];
export const startBoard: Board = [[1, 2], [3], []];
export const practiceProblem: TowerProblem = { target: [[1], [3, 2], []], minimumMoves: 1 };
export const problems: TowerProblem[] = [
  { target: [[], [3, 1], [2]], minimumMoves: 2 },
  { target: [[1], [2], [3]], minimumMoves: 2 },
  { target: [[1, 3], [2], []], minimumMoves: 3 },
  { target: [[1], [2, 3], []], minimumMoves: 3 },
  { target: [[2, 1], [3], []], minimumMoves: 4 },
  { target: [[3], [2, 1], []], minimumMoves: 4 },
  { target: [[2, 3], [], [1]], minimumMoves: 4 },
  { target: [[], [2, 3], [1]], minimumMoves: 4 },
  { target: [[2, 1, 3], [], []], minimumMoves: 5 },
  { target: [[2, 3, 1], [], []], minimumMoves: 5 },
  { target: [[3, 1], [2], []], minimumMoves: 5 },
  { target: [[3], [2], [1]], minimumMoves: 5 },
];

export function CreateTowerProblems(settings: { practice: boolean }): PlannedProblem[] {
  const counted = problems.map((problem, index) => ({ ...problem, practice: false, index }));
  return settings.practice ? [{ ...practiceProblem, practice: true, index: null }, ...counted] : counted;
}

// With an empty hand a click lifts the top ball (one move); with a ball in hand it drops the ball if the peg has room.
export function PegClick(state: TowerState, peg: number): TowerState {
  const board = state.board.map(items => [...items]);
  if (state.held === null) {
    const ball = board[peg].pop();
    return ball === undefined ? state : { board, held: ball, moves: state.moves + 1 };
  }
  if (board[peg].length >= capacities[peg]) return state;
  board[peg].push(state.held);
  return { board, held: null, moves: state.moves };
}

export function Matches(board: Board, target: Board): boolean {
  return board.every((peg, index) => peg.length === target[index].length && peg.every((ball, slot) => ball === target[index][slot]));
}

// Breadth-first search over ball moves, used to check the listed minimum for each problem.
export function MinimumMoves(start: Board, target: Board): number {
  const key = (board: Board) => JSON.stringify(board);
  const seen = new Set([key(start)]);
  let frontier = [start];
  for (let moves = 0; frontier.length; moves++) {
    if (frontier.some(board => Matches(board, target))) return moves;
    const next: Board[] = [];
    for (const board of frontier) {
      board.forEach((from, source) => {
        if (!from.length) return;
        board.forEach((to, destination) => {
          if (destination === source || to.length >= capacities[destination]) return;
          const moved = board.map(items => [...items]);
          moved[destination].push(moved[source].pop()!);
          if (!seen.has(key(moved))) { seen.add(key(moved)); next.push(moved); }
        });
      });
    }
    frontier = next;
  }
  return -1;
}
