// Hub-owned language-neutral cognitive runtimes.
import { Application,Container,Graphics } from 'pixi.js';
import type { CognitiveGameState,Difficulty,DotsAndBoxesState,GameResult,NumberGridState,ReferenceGameId,SimonTapResult,SimonTrialRecord,TFunction } from './types';
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
const originalBlue = 0x3498db;
const originalRed = 0xe74c3c;
const originalText = 0x2c3e50;
const originalLightMuted = 0xf5f5f5;
const originalGrayBorder = 0xdee2e6;
const playerColor = originalBlue;
const aiColor = originalRed;
const dotsVerticalOffset = 1300;
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
        case 'dots-and-boxes':
            return CreateDotsAndBoxesState(difficulty);
        default:
            return null;
    }
}
export function HandleLanguageNeutralGameTap(state: LanguageNeutralGameState, index: number, elapsed: number, finishGame: (result: GameResult) => void, recordSimonTrial?: (trial: SimonTrialRecord) => void): SimonTapResult | null {
    switch (state.kind) {
        case 'dots-and-boxes':
            HandleDotsAndBoxesTap(state, index, elapsed, finishGame);
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
    if (state.kind === 'dots-and-boxes') {
        if (state.aiMoveAt !== null && elapsed >= state.aiMoveAt) {
            state.aiMoveAt = null;
            TakeDotsAndBoxesAiTurn(state, elapsed, finishGame);
            render();
        }
        return;
    }
    ;
    return;
}
export function IsLanguageNeutralAutoSuccess(state: LanguageNeutralGameState) {
    switch (state.kind) {
        case 'dots-and-boxes':
            return IsDotsBoardFull(state) && state.playerScore > state.aiScore;
        default:
            return false;
    }
}
export function GetLanguageNeutralFeedbackCounts(state: LanguageNeutralGameState): {
    success: number;
    errors: number;
} {
    switch (state.kind) {
        case 'dots-and-boxes':
            return { success: state.playerScore, errors: state.errors + state.aiScore };
        default:
            return { success: 0, errors: 0 };
    }
}
export function DrawLanguageNeutralGame(app: Application, state: LanguageNeutralGameState, elapsed: number, onTap: (index: number) => void, t: TFunction) {
    switch (state.kind) {
        case 'dots-and-boxes':
            DrawDotsAndBoxes(app, state, onTap, t);
            break;
        default:
            break;
    }
}
function CreateDotsAndBoxesState(difficulty: Difficulty): DotsAndBoxesState {
    const size = [4, 5, 6][DifficultyIndex(difficulty)];
    return {
        kind: 'dots-and-boxes',
        size,
        hLines: Array.from({ length: size * (size - 1) }, () => null),
        vLines: Array.from({ length: (size - 1) * size }, () => null),
        boxes: Array.from({ length: (size - 1) * (size - 1) }, () => null),
        aiMoveAt: null,
        moves: 0,
        aiMoves: 0,
        errors: 0,
        playerScore: 0,
        aiScore: 0,
    };
}
function HandleDotsAndBoxesTap(state: DotsAndBoxesState, index: number, elapsed: number, finishGame: (result: GameResult) => void) {
    if (state.aiMoveAt !== null)
        return;
    const move = ParseDotsLineIndex(state, index);
    if (!move || IsDotsLineDrawn(state, move.horizontal, move.index)) {
        state.errors += 1;
        return;
    }
    SetDotsLine(state, move.horizontal, move.index, 'P');
    const completed = ClaimDotsBoxes(state, move.horizontal, move.index, 'P');
    state.playerScore += completed;
    state.moves += 1;
    if (FinishDotsIfFull(state, finishGame))
        return;
    if (completed > 0)
        return;
    state.aiMoveAt = elapsed + aiTurnDelaySeconds;
}
function TakeDotsAndBoxesAiTurn(state: DotsAndBoxesState, elapsed: number, finishGame?: (result: GameResult) => void) {
    if (IsDotsBoardFull(state))
        return;
    const aiMove = ChooseDotsMove(state);
    if (!aiMove)
        return;
    SetDotsLine(state, aiMove.horizontal, aiMove.index, 'A');
    const aiCompleted = ClaimDotsBoxes(state, aiMove.horizontal, aiMove.index, 'A');
    state.aiScore += aiCompleted;
    state.aiMoves += 1;
    if (finishGame && FinishDotsIfFull(state, finishGame))
        return;
    if (aiCompleted > 0)
        state.aiMoveAt = elapsed + aiTurnDelaySeconds;
}
function DrawDotsAndBoxes(app: Application, state: DotsAndBoxesState, onTap: (index: number) => void, _t: TFunction) {
    const padding = 16;
    const boardSpan = state.size - 1;
    const { cell, startX, startY } = GetGridLayout(app, boardSpan, boardSpan, 72, 0, padding);
    const board = new Graphics();
    board.rect(startX - padding, startY - padding, (state.size - 1) * cell + padding * 2, (state.size - 1) * cell + padding * 2).fill(originalLightMuted).stroke({ color: originalGrayBorder, width: 2 });
    app.stage.addChild(board);
    for (let row = 0; row < state.size - 1; row += 1) {
        for (let col = 0; col < state.size - 1; col += 1) {
            const owner = state.boxes[row * (state.size - 1) + col];
            if (!owner)
                continue;
            const g = new Graphics();
            g.rect(startX + col * cell + 8, startY + row * cell + 8, cell - 16, cell - 16)
                .fill({ color: owner === 'P' ? originalBlue : originalRed, alpha: 0.4 });
            app.stage.addChild(g);
        }
    }
    state.hLines.forEach((owner, index) => {
        const row = Math.floor(index / (state.size - 1));
        const col = index % (state.size - 1);
        DrawDotsLine(app, startX + col * cell, startY + row * cell, startX + (col + 1) * cell, startY + row * cell, owner, index, onTap);
    });
    state.vLines.forEach((owner, index) => {
        const row = Math.floor(index / state.size);
        const col = index % state.size;
        DrawDotsLine(app, startX + col * cell, startY + row * cell, startX + col * cell, startY + (row + 1) * cell, owner, dotsVerticalOffset + index, onTap);
    });
    for (let row = 0; row < state.size; row += 1) {
        for (let col = 0; col < state.size; col += 1) {
            const dot = new Graphics();
            dot.circle(startX + col * cell, startY + row * cell, 5).fill(originalText);
            app.stage.addChild(dot);
        }
    }
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
function ParseDotsLineIndex(state: DotsAndBoxesState, index: number) {
    if (index >= dotsVerticalOffset) {
        const line = index - dotsVerticalOffset;
        return line >= 0 && line < state.vLines.length ? { horizontal: false, index: line } : null;
    }
    return index >= 0 && index < state.hLines.length ? { horizontal: true, index } : null;
}
function IsDotsLineDrawn(state: DotsAndBoxesState, horizontal: boolean, index: number) {
    return Boolean(horizontal ? state.hLines[index] : state.vLines[index]);
}
function SetDotsLine(state: DotsAndBoxesState, horizontal: boolean, index: number, owner: 'P' | 'A' | null) {
    if (horizontal)
        state.hLines[index] = owner;
    else
        state.vLines[index] = owner;
}
function ClaimDotsBoxes(state: DotsAndBoxesState, horizontal: boolean, lineIndex: number, owner: 'P' | 'A') {
    const candidates: Array<[
        number,
        number
    ]> = [];
    if (horizontal) {
        const row = Math.floor(lineIndex / (state.size - 1));
        const col = lineIndex % (state.size - 1);
        candidates.push([row - 1, col], [row, col]);
    }
    else {
        const row = Math.floor(lineIndex / state.size);
        const col = lineIndex % state.size;
        candidates.push([row, col - 1], [row, col]);
    }
    let completed = 0;
    candidates.forEach(([row, col]) => {
        if (row < 0 || col < 0 || row >= state.size - 1 || col >= state.size - 1)
            return;
        const boxIndex = row * (state.size - 1) + col;
        if (state.boxes[boxIndex] || !IsDotsBoxComplete(state, row, col))
            return;
        state.boxes[boxIndex] = owner;
        completed += 1;
    });
    return completed;
}
function IsDotsBoxComplete(state: DotsAndBoxesState, row: number, col: number) {
    return state.hLines[row * (state.size - 1) + col]
        && state.hLines[(row + 1) * (state.size - 1) + col]
        && state.vLines[row * state.size + col]
        && state.vLines[row * state.size + col + 1];
}
function ChooseDotsMove(state: DotsAndBoxesState) {
    const moves = [
        ...state.hLines.map((owner, index) => ({ drawn: Boolean(owner), horizontal: true, index })),
        ...state.vLines.map((owner, index) => ({ drawn: Boolean(owner), horizontal: false, index })),
    ].filter((move) => !move.drawn);
    return moves.find((move) => WouldCompleteDotsBox(state, move.horizontal, move.index))
        ?? moves[Math.floor(Math.random() * moves.length)]
        ?? null;
}
function WouldCompleteDotsBox(state: DotsAndBoxesState, horizontal: boolean, index: number) {
    SetDotsLine(state, horizontal, index, 'P');
    const completes = horizontal
        ? [
            [Math.floor(index / (state.size - 1)) - 1, index % (state.size - 1)],
            [Math.floor(index / (state.size - 1)), index % (state.size - 1)],
        ].some(([row, col]) => row >= 0 && col >= 0 && row < state.size - 1 && col < state.size - 1 && !state.boxes[row * (state.size - 1) + col] && IsDotsBoxComplete(state, row, col))
        : [
            [Math.floor(index / state.size), (index % state.size) - 1],
            [Math.floor(index / state.size), index % state.size],
        ].some(([row, col]) => row >= 0 && col >= 0 && row < state.size - 1 && col < state.size - 1 && !state.boxes[row * (state.size - 1) + col] && IsDotsBoxComplete(state, row, col));
    SetDotsLine(state, horizontal, index, null);
    return completes;
}
function IsDotsBoardFull(state: DotsAndBoxesState) {
    return state.hLines.every(Boolean) && state.vLines.every(Boolean);
}
function FinishDotsIfFull(state: DotsAndBoxesState, finishGame: (result: GameResult) => void) {
    if (!IsDotsBoardFull(state))
        return false;
    finishGame(state.playerScore > state.aiScore
        ? 'Victory'
        : state.playerScore === state.aiScore
            ? 'Draw'
            : 'Defeat');
    return true;
}
function DrawDotsLine(app: Application, x1: number, y1: number, x2: number, y2: number, owner: 'P' | 'A' | null, index: number, onTap: (index: number) => void) {
    const node = InteractiveNode(onTap, index);
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    node.x = minX;
    node.y = minY;
    const w = Math.abs(x2 - x1) || 18;
    const h = Math.abs(y2 - y1) || 18;
    const hit = new Graphics();
    hit.rect(-9, -9, w + 18, h + 18).fill({ color: 0xffffff, alpha: 0.001 });
    hit.moveTo(x1 - minX, y1 - minY).lineTo(x2 - minX, y2 - minY)
        .stroke({
        color: owner === 'P' ? playerColor : owner === 'A' ? aiColor : 0xdddddd,
        width: owner ? 5 : 4,
    });
    node.addChild(hit);
    app.stage.addChild(node);
}
