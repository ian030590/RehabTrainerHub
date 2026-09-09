// Hub-owned language-neutral cognitive runtimes.
import { Application,Container,Graphics } from 'pixi.js';
import type { CognitiveGameState,Difficulty,GameResult,HexState,NumberGridState,ReferenceGameId,SimonTapResult,SimonTrialRecord,TFunction } from './types';
import { GetResponsiveBoardMaxSize } from './utils';
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
const originalBlue = 0x3498db;
const originalBlueDark = 0x2980b9;
const originalBlueEdge = 0x2471a3;
const originalRed = 0xe74c3c;
const originalRedDark = 0xc0392b;
const originalRedEdge = 0xa93226;
const originalLight = 0xecf0f1;
const originalBorder = 0xbdc3c7;
const playerColor = originalBlue;
const aiColor = originalRed;
const empty = 0;
const aiTurnDelaySeconds = 1;
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
export function IsLanguageNeutralGameState(state: CognitiveGameState): state is LanguageNeutralGameState {
    return languageNeutralKinds.includes(state.kind as LanguageNeutralGameKind);
}
export function CreateLanguageNeutralGameState(gameId: ReferenceGameId, difficulty: Difficulty, simonLives = 3): LanguageNeutralGameState | null {
    switch (gameId) {
        case 'hex':
            return CreateHexState(difficulty);
        default:
            return null;
    }
}
export function HandleLanguageNeutralGameTap(state: LanguageNeutralGameState, index: number, elapsed: number, finishGame: (result: GameResult) => void, recordSimonTrial?: (trial: SimonTrialRecord) => void): SimonTapResult | null {
    switch (state.kind) {
        case 'hex':
            HandleHexTap(state, index, elapsed, finishGame);
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
    ;
    return false;
}
export function UpdateLanguageNeutralTimedState(state: LanguageNeutralGameState, elapsed: number, render: () => void, finishGame?: (result: GameResult) => void, onSimonInputStart?: () => void) {
    ;
    ;
    ;
    if (state.kind === 'hex') {
        if (state.aiMoveAt !== null && elapsed >= state.aiMoveAt) {
            state.aiMoveAt = null;
            TakeHexAiTurn(state, finishGame);
            render();
        }
        return;
    }
    return;
}
export function IsLanguageNeutralAutoSuccess(state: LanguageNeutralGameState) {
    switch (state.kind) {
        case 'hex':
            return HasHexPath(state, 1);
        default:
            return false;
    }
}
export function GetLanguageNeutralFeedbackCounts(state: LanguageNeutralGameState): {
    success: number;
    errors: number;
} {
    switch (state.kind) {
        case 'hex':
            return { success: state.moves, errors: state.errors };
        default:
            return { success: 0, errors: 0 };
    }
}
export function DrawLanguageNeutralGame(app: Application, state: LanguageNeutralGameState, elapsed: number, onTap: (index: number) => void, t: TFunction) {
    switch (state.kind) {
        case 'hex':
            DrawHex(app, state, onTap, t);
            break;
        default:
            break;
    }
}
function CreateHexState(difficulty: Difficulty): HexState {
    const size = [5, 7, 9][DifficultyIndex(difficulty)];
    return { kind: 'hex', size, board: Array.from({ length: size * size }, () => 0), aiMoveAt: null, moves: 0, aiMoves: 0, errors: 0 };
}
function HandleHexTap(state: HexState, index: number, elapsed: number, finishGame: (result: GameResult) => void) {
    if (state.aiMoveAt !== null)
        return;
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
    if (HasHexPath(state, 2))
        finishGame?.('Defeat');
    else if (state.board.every(Boolean))
        finishGame?.('Draw');
}
function DrawHex(app: Application, state: HexState, onTap: (index: number) => void, _t: TFunction) {
    const boardMax = GetResponsiveBoardMaxSize(app);
    const horizontalFactor = (state.size * 1.5 - 0.5) * Math.sqrt(3);
    const verticalFactor = state.size * 1.5 + 0.5;
    const edgePadding = 24;
    const radius = Math.floor(Math.max(8, Math.min((boardMax.width - edgePadding) / horizontalFactor, (boardMax.height - edgePadding) / verticalFactor)));
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
function DrawHexagon(g: Graphics, cx: number, cy: number, radius: number) {
    for (let point = 0; point < 6; point += 1) {
        const angle = Math.PI / 6 + point * Math.PI / 3;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        if (point === 0)
            g.moveTo(x, y);
        else
            g.lineTo(x, y);
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
        if (index === undefined)
            break;
        const row = Math.floor(index / state.size);
        const col = index % state.size;
        if ((player === 1 && row === state.size - 1) || (player === 2 && col === state.size - 1))
            return true;
        GetHexNeighbors(index, state.size).forEach((next) => {
            if (state.board[next] !== player || seen.has(next))
                return;
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
