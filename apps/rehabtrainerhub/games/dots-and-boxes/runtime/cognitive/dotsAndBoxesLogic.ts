export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameResult = 'Victory' | 'Defeat' | 'Draw';
type Owner = 'P' | 'A' | null;

export interface DotsAndBoxesState {
  kind: 'dots-and-boxes';
  size: number;
  hLines: Owner[];
  vLines: Owner[];
  boxes: Owner[];
  aiMoveAt: number | null;
  moves: number;
  aiMoves: number;
  errors: number;
  playerScore: number;
  aiScore: number;
}

const verticalOffset = 1300;

export function CreateDotsAndBoxesState(difficulty: Difficulty): DotsAndBoxesState {
  const size = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 5 : 6;
  return {
    kind: 'dots-and-boxes', size,
    hLines: Array(size * (size - 1)).fill(null),
    vLines: Array(size * (size - 1)).fill(null),
    boxes: Array((size - 1) ** 2).fill(null),
    aiMoveAt: null, moves: 0, aiMoves: 0, errors: 0, playerScore: 0, aiScore: 0,
  };
}

function Line(state: DotsAndBoxesState, index: number) {
  if (!Number.isInteger(index)) return null;
  if (index >= verticalOffset) {
    const position = index - verticalOffset;
    return position < state.vLines.length ? { lines: state.vLines, position, horizontal: false } : null;
  }
  return index >= 0 && index < state.hLines.length
    ? { lines: state.hLines, position: index, horizontal: true } : null;
}

function AdjacentBoxes(state: DotsAndBoxesState, index: number): number[] {
  const line = Line(state, index);
  if (!line) return [];
  const { size } = state;
  const row = Math.floor(line.position / (line.horizontal ? size - 1 : size));
  const col = line.position % (line.horizontal ? size - 1 : size);
  const positions = line.horizontal ? [[row - 1, col], [row, col]] : [[row, col - 1], [row, col]];
  return positions.filter(([r, c]) => r >= 0 && c >= 0 && r < size - 1 && c < size - 1)
    .map(([r, c]) => r * (size - 1) + c);
}

function BoxComplete(state: DotsAndBoxesState, box: number) {
  const row = Math.floor(box / (state.size - 1));
  const col = box % (state.size - 1);
  const top = row * (state.size - 1) + col;
  const left = row * state.size + col;
  return Boolean(state.hLines[top] && state.hLines[top + state.size - 1]
    && state.vLines[left] && state.vLines[left + 1]);
}

function ClaimBoxes(state: DotsAndBoxesState, index: number, owner: 'P' | 'A') {
  let claimed = 0;
  for (const box of AdjacentBoxes(state, index)) {
    if (!state.boxes[box] && BoxComplete(state, box)) {
      state.boxes[box] = owner;
      claimed += 1;
    }
  }
  return claimed;
}

function FinishIfFull(state: DotsAndBoxesState, finishGame: (result: GameResult) => void) {
  if (![...state.hLines, ...state.vLines].every(Boolean)) return false;
  finishGame(state.playerScore > state.aiScore ? 'Victory'
    : state.playerScore < state.aiScore ? 'Defeat' : 'Draw');
  return true;
}

export function HandleDotsAndBoxesTap(state: DotsAndBoxesState, index: number, elapsed: number, finishGame: (result: GameResult) => void) {
  if (state.aiMoveAt !== null) return;
  const line = Line(state, index);
  if (!line || line.lines[line.position]) {
    state.errors += 1;
    return;
  }
  line.lines[line.position] = 'P';
  const claimed = ClaimBoxes(state, index, 'P');
  state.playerScore += claimed;
  state.moves += 1;
  if (FinishIfFull(state, finishGame)) return;
  if (claimed) return;
  state.aiMoveAt = elapsed + 1;
}

export function ChooseDotsAndBoxesAiMove(state: DotsAndBoxesState, random = Math.random): number | null {
  const available = [
    ...state.hLines.flatMap((owner, index) => owner ? [] : [index]),
    ...state.vLines.flatMap((owner, index) => owner ? [] : [verticalOffset + index]),
  ];
  const closing = available.find(index => {
    const line = Line(state, index)!;
    line.lines[line.position] = 'A';
    const complete = AdjacentBoxes(state, index).some(box => !state.boxes[box] && BoxComplete(state, box));
    line.lines[line.position] = null;
    return complete;
  });
  return closing ?? available[Math.floor(random() * available.length)] ?? null;
}

export function UpdateDotsAndBoxesTimedState(state: DotsAndBoxesState, elapsed: number, finishGame: (result: GameResult) => void, random = Math.random) {
  if (state.aiMoveAt === null || elapsed < state.aiMoveAt) return;
  state.aiMoveAt = null;
  const index = ChooseDotsAndBoxesAiMove(state, random);
  if (index === null) return;
  const line = Line(state, index)!;
  line.lines[line.position] = 'A';
  const claimed = ClaimBoxes(state, index, 'A');
  state.aiScore += claimed;
  state.aiMoves += 1;
  if (FinishIfFull(state, finishGame)) return;
  if (claimed) state.aiMoveAt = elapsed + 1;
}

export function BuildDotsAndBoxesResultData(state: DotsAndBoxesState, durationSeconds: number, result: GameResult) {
  return {
    Total_Duration_Seconds: durationSeconds,
    Moves: state.moves,
    Completed: result === 'Victory',
    Errors: state.errors,
    Opponent_Moves: state.aiMoves,
    Player_Boxes: state.playerScore,
    Opponent_Boxes: state.aiScore,
    Board_Size: state.size,
  };
}
