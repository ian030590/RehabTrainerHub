// Hub-owned language-neutral cognitive runtimes.
import { Application,Container,Graphics } from 'pixi.js';
import type { CognitiveGameState,Difficulty,GameResult,NumberGridState,ReferenceGameId,SimonTapResult,SimonTrialRecord,TFunction,TicTacToeState } from './types';
import { AddText,GetGridLayout } from './utils';
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
        case 'tic-tac-toe':
            return CreateTicTacToeState(difficulty);
        default:
            return null;
    }
}
export function HandleLanguageNeutralGameTap(state: LanguageNeutralGameState, index: number, elapsed: number, finishGame: (result: GameResult) => void, recordSimonTrial?: (trial: SimonTrialRecord) => void): SimonTapResult | null {
    switch (state.kind) {
        case 'tic-tac-toe':
            HandleTicTacToeTap(state, index, elapsed, finishGame);
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
    if (state.kind === 'tic-tac-toe') {
        if (state.aiMoveAt !== null && elapsed >= state.aiMoveAt) {
            state.aiMoveAt = null;
            TakeTicTacToeAiTurn(state, finishGame);
            render();
        }
        return;
    }
    ;
    ;
    ;
    return;
}
export function IsLanguageNeutralAutoSuccess(state: LanguageNeutralGameState) {
    switch (state.kind) {
        case 'tic-tac-toe':
            return CheckMarkWin(state.board, state.size, state.winLength, 'X');
        default:
            return false;
    }
}
export function GetLanguageNeutralFeedbackCounts(state: LanguageNeutralGameState): {
    success: number;
    errors: number;
} {
    switch (state.kind) {
        case 'tic-tac-toe':
        default:
            return { success: 0, errors: 0 };
    }
}
export function DrawLanguageNeutralGame(app: Application, state: LanguageNeutralGameState, elapsed: number, onTap: (index: number) => void, t: TFunction) {
    switch (state.kind) {
        case 'tic-tac-toe':
            DrawTicTacToe(app, state, onTap, t);
            break;
        default:
            break;
    }
}
function CreateTicTacToeState(difficulty: Difficulty): TicTacToeState {
    const diff = DifficultyIndex(difficulty);
    const size = [3, 4, 5][diff];
    return {
        kind: 'tic-tac-toe',
        size,
        winLength: diff === 2 ? 4 : 3,
        board: Array.from({ length: size * size }, () => null),
        aiMoveAt: null,
        moves: 0,
        aiMoves: 0,
        errors: 0,
    };
}
function HandleTicTacToeTap(state: TicTacToeState, index: number, elapsed: number, finishGame: (result: GameResult) => void) {
    if (state.aiMoveAt !== null)
        return;
    if (state.board[index]) {
        state.errors += 1;
        return;
    }
    state.board[index] = 'X';
    state.moves += 1;
    if (CheckMarkWin(state.board, state.size, state.winLength, 'X')) {
        finishGame('Victory');
        return;
    }
    if (state.board.every(Boolean)) {
        finishGame('Draw');
        return;
    }
    state.aiMoveAt = elapsed + aiTurnDelaySeconds;
}
function TakeTicTacToeAiTurn(state: TicTacToeState, finishGame?: (result: GameResult) => void) {
    const aiMove = ChooseTicTacToeMove(state);
    if (aiMove !== null) {
        state.board[aiMove] = 'O';
        state.aiMoves += 1;
    }
    if (CheckMarkWin(state.board, state.size, state.winLength, 'O')) {
        finishGame?.('Defeat');
        return;
    }
    if (state.board.every(Boolean))
        finishGame?.('Draw');
}
function DrawTicTacToe(app: Application, state: TicTacToeState, onTap: (index: number) => void, _t: TFunction) {
    const padding = 10;
    const { cell, gap, startX, startY } = GetGridLayout(app, state.size, state.size, 60, 5, padding);
    const board = new Graphics();
    board.rect(startX - padding, startY - padding, state.size * cell + (state.size - 1) * gap + padding * 2, state.size * cell + (state.size - 1) * gap + padding * 2).fill(0xffffff);
    app.stage.addChild(board);
    state.board.forEach((mark, index) => {
        const row = Math.floor(index / state.size);
        const col = index % state.size;
        const node = InteractiveNode(onTap, index);
        node.x = startX + col * (cell + gap);
        node.y = startY + row * (cell + gap);
        const g = new Graphics();
        g.rect(0, 0, cell, cell).fill(0xffffff).stroke({ color: 0x333333, width: 2 });
        node.addChild(g);
        if (mark) {
            AddText(node, mark, cell / 2, cell / 2, {
                fontSize: Math.max(24, cell * 0.4),
                fontWeight: '400',
                fill: '#2c3e50',
            });
        }
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
function CheckMarkWin(board: Array<string | null>, size: number, winLength: number, mark: string) {
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]] as const;
    for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
            if (board[row * size + col] !== mark)
                continue;
            for (const [dx, dy] of directions) {
                let count = 1;
                for (let step = 1; step < winLength; step += 1) {
                    const nextRow = row + dy * step;
                    const nextCol = col + dx * step;
                    if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size || board[nextRow * size + nextCol] !== mark)
                        break;
                    count += 1;
                }
                if (count >= winLength)
                    return true;
            }
        }
    }
    return false;
}
function ChooseTicTacToeMove(state: TicTacToeState) {
    const empty = state.board.map((mark, index) => (mark ? null : index)).filter((index): index is number => index !== null);
    return FindWinningTicTacToeMove(state, 'O', empty)
        ?? FindWinningTicTacToeMove(state, 'X', empty)
        ?? empty.find((index) => index === Math.floor(state.board.length / 2))
        ?? empty[Math.floor(Math.random() * empty.length)]
        ?? null;
}
function FindWinningTicTacToeMove(state: TicTacToeState, mark: 'X' | 'O', empty: number[]) {
    return empty.find((index) => {
        state.board[index] = mark;
        const won = CheckMarkWin(state.board, state.size, state.winLength, mark);
        state.board[index] = null;
        return won;
    }) ?? null;
}
