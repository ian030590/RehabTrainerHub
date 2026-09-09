// Hub-owned language-neutral cognitive runtimes.
import { Application,Container,Graphics } from 'pixi.js';
import type { CognitiveGameState,Difficulty,GameResult,MazeCell,MazeState,NumberGridState,ReferenceGameId,SimonTapResult,SimonTrialRecord,TFunction } from './types';
import { GetGridLayout } from './utils';
type ReferenceLanguageNeutralGameKind = Exclude<ReferenceGameId, 'memory-match' | 'lights-out' | 'reaction-time' | 'whack-a-mole' | 'sliding-puzzle'>;
type LanguageNeutralGameKind = ReferenceLanguageNeutralGameKind | NumberGridState['kind'];
type LanguageNeutralGameState = Extract<CognitiveGameState, {
    kind: LanguageNeutralGameKind;
}>;
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
const directionByKey: Partial<Record<string, GridDirection>> = {
    ArrowUp: { dx: 0, dy: -1 },
    ArrowDown: { dx: 0, dy: 1 },
    ArrowLeft: { dx: -1, dy: 0 },
    ArrowRight: { dx: 1, dy: 0 },
};
type GridDirection = {
    dx: number;
    dy: number;
};
const lastMazeSignatureByDifficulty: Partial<Record<Difficulty, string>> = {};
export function IsLanguageNeutralGameState(state: CognitiveGameState): state is LanguageNeutralGameState {
    return languageNeutralKinds.includes(state.kind as LanguageNeutralGameKind);
}
export function CreateLanguageNeutralGameState(gameId: ReferenceGameId, difficulty: Difficulty, simonLives = 3): LanguageNeutralGameState | null {
    switch (gameId) {
        case 'maze':
            return CreateMazeState(difficulty);
        default:
            return null;
    }
}
export function HandleLanguageNeutralGameTap(state: LanguageNeutralGameState, index: number, elapsed: number, finishGame: (result: GameResult) => void, recordSimonTrial?: (trial: SimonTrialRecord) => void): SimonTapResult | null {
    switch (state.kind) {
        case 'maze':
            HandleMazeTap(state, index, finishGame);
            break;
        default:
            break;
    }
    return null;
}
export function HandleLanguageNeutralGameKey(state: LanguageNeutralGameState, key: string, finishGame: (result: GameResult) => void) {
    const direction = directionByKey[key];
    if (!direction)
        return false;
    if (state.kind === 'maze') {
        MoveMaze(state, direction, finishGame);
        return true;
    }
    return false;
}
export function UpdateLanguageNeutralTimedState(state: LanguageNeutralGameState, elapsed: number, render: () => void, finishGame?: (result: GameResult) => void, onSimonInputStart?: () => void) {
    ;
    ;
    ;
    ;
    return;
}
export function IsLanguageNeutralAutoSuccess(state: LanguageNeutralGameState) {
    switch (state.kind) {
        case 'maze':
            return state.current === state.end;
        default:
            return false;
    }
}
export function GetLanguageNeutralFeedbackCounts(state: LanguageNeutralGameState): {
    success: number;
    errors: number;
} {
    switch (state.kind) {
        case 'maze':
            return { success: state.moves, errors: state.errors };
        default:
            return { success: 0, errors: 0 };
    }
}
export function DrawLanguageNeutralGame(app: Application, state: LanguageNeutralGameState, elapsed: number, onTap: (index: number) => void, t: TFunction) {
    switch (state.kind) {
        case 'maze':
            DrawMaze(app, state, onTap, t, elapsed);
            break;
        default:
            break;
    }
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
    return `${state.current}:${state.end}:${state.cells.map((cell) => (`${cell.top ? 1 : 0}${cell.right ? 1 : 0}${cell.bottom ? 1 : 0}${cell.left ? 1 : 0}`)).join('')}`;
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
    if (state.current === state.end)
        finishGame('Victory');
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
        if (mazeCell.top)
            bg.lineTo(cell, 0);
        else
            bg.moveTo(cell, 0);
        if (mazeCell.right)
            bg.lineTo(cell, cell);
        else
            bg.moveTo(cell, cell);
        if (mazeCell.bottom)
            bg.lineTo(0, cell);
        else
            bg.moveTo(0, cell);
        if (mazeCell.left)
            bg.lineTo(0, 0);
        bg.stroke({ color: 0x333333, width: 2 });
        if (index === state.current)
            bg.rect(cell * 0.25, cell * 0.25, cell * 0.5, cell * 0.5).fill(0xff0000);
        node.addChild(bg);
        app.stage.addChild(node);
    });
}
function DifficultyIndex(difficulty: Difficulty) {
    if (difficulty === 'Beginner')
        return 0;
    if (difficulty === 'Intermediate')
        return 1;
    return 2;
}
function InteractiveNode(onTap: (index: number) => void, index: number) {
    const node = new Container();
    node.eventMode = 'static';
    node.cursor = 'pointer';
    node.on('pointertap', () => onTap(index));
    return node;
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
        if (!current)
            break;
        if (current.distance > farthest.distance)
            farthest = current;
        GetOpenMazeNeighbors(cells, size, current.index).forEach((next) => {
            if (seen.has(next))
                return;
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
    if (!cell.top && row > 0)
        neighbors.push(index - size);
    if (!cell.right && col < size - 1)
        neighbors.push(index + 1);
    if (!cell.bottom && row < size - 1)
        neighbors.push(index + size);
    if (!cell.left && col > 0)
        neighbors.push(index - 1);
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
    ].filter((neighbor): neighbor is {
        index: number;
        direction: 'top' | 'right' | 'bottom' | 'left';
    } => neighbor !== null);
}
function RemoveMazeWall(current: MazeCell, next: MazeCell, direction: 'top' | 'right' | 'bottom' | 'left') {
    current[direction] = false;
    if (direction === 'top')
        next.bottom = false;
    if (direction === 'right')
        next.left = false;
    if (direction === 'bottom')
        next.top = false;
    if (direction === 'left')
        next.right = false;
}
function CanMoveMaze(state: MazeState, from: number, to: number) {
    const row = Math.floor(from / state.size);
    const col = from % state.size;
    const targetRow = Math.floor(to / state.size);
    const targetCol = to % state.size;
    if (Math.abs(row - targetRow) + Math.abs(col - targetCol) !== 1)
        return false;
    const cell = state.cells[from];
    if (targetRow < row)
        return !cell.top;
    if (targetCol > col)
        return !cell.right;
    if (targetRow > row)
        return !cell.bottom;
    return !cell.left;
}
