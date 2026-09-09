// Hub-owned language-neutral cognitive runtimes.
import { Application,Container,Graphics } from 'pixi.js';
import type { CognitiveGameState,Connect4State,Difficulty,GameResult,NumberGridState,ReferenceGameId,SimonTapResult,SimonTrialRecord,TFunction } from './types';
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
const originalConnect4Yellow = 0xfacc15;
const originalConnect4Red = 0xdc143c;
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
        case 'connect4':
            return CreateConnect4State();
        default:
            return null;
    }
}
export function HandleLanguageNeutralGameTap(state: LanguageNeutralGameState, index: number, elapsed: number, finishGame: (result: GameResult) => void, recordSimonTrial?: (trial: SimonTrialRecord) => void): SimonTapResult | null {
    switch (state.kind) {
        case 'connect4':
            HandleConnect4Tap(state, index, elapsed, finishGame);
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
    if (state.kind === 'connect4') {
        const hadDrops = state.drops.length > 0;
        state.drops = state.drops.filter((drop) => elapsed - drop.startedAt < 0.45);
        let tookAiTurn = false;
        if (state.aiMoveAt !== null && elapsed >= state.aiMoveAt) {
            state.aiMoveAt = null;
            TakeConnect4AiTurn(state, elapsed, finishGame);
            tookAiTurn = true;
        }
        if (hadDrops || tookAiTurn || state.pendingResult)
            render();
        if (state.pendingResult && elapsed >= state.pendingResult.finishAt)
            finishGame?.(state.pendingResult.result);
        return;
    }
    ;
    ;
    return;
}
export function IsLanguageNeutralAutoSuccess(state: LanguageNeutralGameState) {
    switch (state.kind) {
        case 'connect4':
            return CheckConnect4Win(state.board, state.rows, state.cols, 'P');
        default:
            return false;
    }
}
export function GetLanguageNeutralFeedbackCounts(state: LanguageNeutralGameState): {
    success: number;
    errors: number;
} {
    switch (state.kind) {
        case 'connect4':
        default:
            return { success: 0, errors: 0 };
    }
}
export function DrawLanguageNeutralGame(app: Application, state: LanguageNeutralGameState, elapsed: number, onTap: (index: number) => void, t: TFunction) {
    switch (state.kind) {
        case 'connect4':
            DrawConnect4(app, state, onTap, t, elapsed);
            break;
        default:
            break;
    }
}
function CreateConnect4State(): Connect4State {
    return {
        kind: 'connect4',
        rows: 6,
        cols: 7,
        board: Array.from({ length: 42 }, () => null),
        drops: [],
        winningLine: [],
        pendingResult: null,
        aiMoveAt: null,
        moves: 0,
        aiMoves: 0,
        errors: 0,
    };
}
function HandleConnect4Tap(state: Connect4State, index: number, elapsed: number, finishGame: (result: GameResult) => void) {
    if (state.drops.length > 0 || state.pendingResult || state.aiMoveAt !== null)
        return;
    const col = index % state.cols;
    const playerRow = DropConnect4Disc(state, col, 'P');
    if (playerRow === null) {
        state.errors += 1;
        return;
    }
    state.drops.push({ index: playerRow * state.cols + col, mark: 'P', startedAt: elapsed });
    state.moves += 1;
    const playerLine = FindConnect4Line(state.board, state.rows, state.cols, 'P');
    if (playerLine) {
        QueueConnect4Result(state, 'Victory', elapsed, playerLine);
        return;
    }
    if (state.board.every(Boolean)) {
        finishGame('Draw');
        return;
    }
    state.aiMoveAt = elapsed + aiTurnDelaySeconds;
}
function TakeConnect4AiTurn(state: Connect4State, elapsed: number, finishGame?: (result: GameResult) => void) {
    const aiCol = ChooseConnect4Move(state);
    if (aiCol !== null) {
        const aiRow = DropConnect4Disc(state, aiCol, 'A');
        if (aiRow !== null)
            state.drops.push({ index: aiRow * state.cols + aiCol, mark: 'A', startedAt: elapsed });
        state.aiMoves += 1;
    }
    const aiLine = FindConnect4Line(state.board, state.rows, state.cols, 'A');
    if (aiLine)
        QueueConnect4Result(state, 'Defeat', elapsed, aiLine);
    else if (state.board.every(Boolean))
        finishGame?.('Draw');
}
function DrawConnect4(app: Application, state: Connect4State, onTap: (index: number) => void, _t: TFunction, elapsed = 0) {
    const { cell, gap, startX, startY } = GetGridLayout(app, state.cols, state.rows, 50, 10);
    const dropping = new Set(state.drops.map((drop) => drop.index));
    state.board.forEach((disc, index) => {
        const row = Math.floor(index / state.cols);
        const col = index % state.cols;
        const node = InteractiveNode(onTap, col);
        node.x = startX + col * (cell + gap);
        node.y = startY + row * (cell + gap);
        const g = new Graphics();
        g.circle(cell / 2, cell / 2, cell / 2).fill(disc && !dropping.has(index) ? Connect4Color(disc) : 0xffffff);
        if (state.winningLine.includes(index)) {
            g.circle(cell / 2, cell / 2, cell / 2 - 3).stroke({ color: 0x111827, width: Math.max(3, cell * 0.08), alpha: 0.95 });
        }
        node.addChild(g);
        app.stage.addChild(node);
    });
    state.drops.forEach((drop) => {
        const row = Math.floor(drop.index / state.cols);
        const col = drop.index % state.cols;
        const progress = Math.min(1, Math.max(0, (elapsed - drop.startedAt) / 0.45));
        const eased = 1 - (1 - progress) ** 3;
        const disc = new Graphics();
        disc.circle(0, 0, cell / 2).fill(Connect4Color(drop.mark));
        const targetY = startY + row * (cell + gap) + cell / 2;
        disc.x = startX + col * (cell + gap) + cell / 2;
        disc.y = startY - cell / 2 + (targetY - (startY - cell / 2)) * eased;
        app.stage.addChild(disc);
    });
    if (state.winningLine.length >= 4) {
        const first = state.winningLine[0];
        const last = state.winningLine[state.winningLine.length - 1];
        const startRow = Math.floor(first / state.cols);
        const startCol = first % state.cols;
        const endRow = Math.floor(last / state.cols);
        const endCol = last % state.cols;
        const lineProgress = state.pendingResult
            ? Math.min(1, Math.max(0, (elapsed - (state.pendingResult.finishAt - 1.2)) / 0.7))
            : 1;
        const x1 = startX + startCol * (cell + gap) + cell / 2;
        const y1 = startY + startRow * (cell + gap) + cell / 2;
        const x2 = startX + endCol * (cell + gap) + cell / 2;
        const y2 = startY + endRow * (cell + gap) + cell / 2;
        const line = new Graphics();
        line.moveTo(x1, y1)
            .lineTo(x1 + (x2 - x1) * lineProgress, y1 + (y2 - y1) * lineProgress)
            .stroke({ color: 0x111827, width: Math.max(6, cell * 0.12), alpha: 0.9 });
        app.stage.addChild(line);
    }
}
function InteractiveNode(onTap: (index: number) => void, index: number) {
    const node = new Container();
    node.eventMode = 'static';
    node.cursor = 'pointer';
    node.on('pointertap', () => onTap(index));
    return node;
}
function DropConnect4Disc(state: Connect4State, col: number, mark: 'P' | 'A') {
    for (let row = state.rows - 1; row >= 0; row -= 1) {
        const index = row * state.cols + col;
        if (!state.board[index]) {
            state.board[index] = mark;
            return row;
        }
    }
    return null;
}
function CheckConnect4Win(board: Array<string | null>, rows: number, cols: number, mark: string) {
    return Boolean(FindConnect4Line(board, rows, cols, mark));
}
function FindConnect4Line(board: Array<string | null>, rows: number, cols: number, mark: string) {
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]] as const;
    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            if (board[row * cols + col] !== mark)
                continue;
            for (const [dx, dy] of directions) {
                const line = [row * cols + col];
                for (let step = 1; step < 4; step += 1) {
                    const nextRow = row + dy * step;
                    const nextCol = col + dx * step;
                    if (nextRow < 0 || nextRow >= rows || nextCol < 0 || nextCol >= cols || board[nextRow * cols + nextCol] !== mark)
                        break;
                    line.push(nextRow * cols + nextCol);
                }
                if (line.length >= 4)
                    return line;
            }
        }
    }
    return null;
}
function QueueConnect4Result(state: Connect4State, result: GameResult, elapsed: number, winningLine: number[]) {
    state.winningLine = winningLine;
    state.pendingResult = { result, finishAt: elapsed + 1.8 };
}
function Connect4Color(mark: 'P' | 'A') {
    return mark === 'P' ? originalConnect4Yellow : originalConnect4Red;
}
function ChooseConnect4Move(state: Connect4State) {
    const available = Array.from({ length: state.cols }, (_, col) => col).filter((col) => !state.board[col]);
    return FindConnect4WinningColumn(state, 'A', available)
        ?? FindConnect4WinningColumn(state, 'P', available)
        ?? available[Math.floor(Math.random() * available.length)]
        ?? null;
}
function FindConnect4WinningColumn(state: Connect4State, mark: 'P' | 'A', available: number[]) {
    return available.find((col) => {
        const clone: Connect4State = { ...state, board: [...state.board] };
        DropConnect4Disc(clone, col, mark);
        return CheckConnect4Win(clone.board, clone.rows, clone.cols, mark);
    }) ?? null;
}
