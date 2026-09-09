// Hub-owned language-neutral cognitive runtimes.
import { Application,Container,Graphics } from 'pixi.js';
import type { CognitiveGameState,Difficulty,GameResult,NumberGridState,ReferenceGameId,SimonTapResult,SimonTrialRecord,TFunction } from './types';
import { AddText,GetGridLayout,Shuffle } from './utils';
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
const numberGridBorder = 0x000000;
const numberGridCellFill = 0xffffff;
const numberGridEntryText = '#005EB8';
const numberGridGivenText = '#000000';
const empty = 0;
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
        case 'sudoku':
            return CreateMergedSudokuState(difficulty);
        default:
            return null;
    }
}
export function HandleLanguageNeutralGameTap(state: LanguageNeutralGameState, index: number, elapsed: number, finishGame: (result: GameResult) => void, recordSimonTrial?: (trial: SimonTrialRecord) => void): SimonTapResult | null {
    switch (state.kind) {
        case 'sudoku':
        case 'latin-square':
        case 'magic-square':
            HandleNumberGridTap(state, index, finishGame);
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
    ;
    return;
}
export function IsLanguageNeutralAutoSuccess(state: LanguageNeutralGameState) {
    switch (state.kind) {
        case 'sudoku':
        case 'latin-square':
        case 'magic-square':
            return IsNumberGridSolved(state);
        default:
            return false;
    }
}
export function GetLanguageNeutralFeedbackCounts(state: LanguageNeutralGameState): {
    success: number;
    errors: number;
} {
    switch (state.kind) {
        case 'sudoku':
        case 'latin-square':
        case 'magic-square':
            // Number-grid entries are exploratory until the whole board is solved.
            // Keep per-cell changes silent; the completed board owns the only
            // success sound through finishGame('Victory').
            return { success: 0, errors: state.errors };
        default:
            return { success: 0, errors: 0 };
    }
}
export function DrawLanguageNeutralGame(app: Application, state: LanguageNeutralGameState, elapsed: number, onTap: (index: number) => void, t: TFunction) {
    switch (state.kind) {
        case 'sudoku':
        case 'latin-square':
        case 'magic-square':
            DrawNumberGrid(app, state, onTap, t);
            break;
        default:
            break;
    }
}
function CreateNumberGridState(kind: NumberGridState['kind'], difficulty: Difficulty): NumberGridState {
    const diff = DifficultyIndex(difficulty);
    if (kind === 'sudoku') {
        const solution = [
            5, 3, 4, 6, 7, 8, 9, 1, 2,
            6, 7, 2, 1, 9, 5, 3, 4, 8,
            1, 9, 8, 3, 4, 2, 5, 6, 7,
            8, 5, 9, 7, 6, 1, 4, 2, 3,
            4, 2, 6, 8, 5, 3, 7, 9, 1,
            7, 1, 3, 9, 2, 4, 8, 5, 6,
            9, 6, 1, 5, 3, 7, 2, 8, 4,
            2, 8, 7, 4, 1, 9, 6, 3, 5,
            3, 4, 5, 2, 8, 6, 1, 7, 9,
        ];
        return MaskNumberGrid('sudoku', 9, solution, [34, 42, 50][diff], 3);
    }
    if (kind === 'latin-square') {
        const size = [4, 5, 6][diff];
        const solution = Array.from({ length: size * size }, (_, index) => ((Math.floor(index / size) + index) % size) + 1);
        return MaskNumberGrid('latin-square', size, solution, [6, 11, 18][diff]);
    }
    if (kind === 'magic-square') {
        return MaskNumberGrid('magic-square', 3, [8, 1, 6, 3, 5, 7, 4, 9, 2], [4, 6, 7][diff]);
    }
    throw new Error(`Unsupported number grid kind: ${kind}`);
}
function CreateMergedSudokuState(difficulty: Difficulty): NumberGridState {
    if (difficulty === 'Beginner')
        return CreateNumberGridState('latin-square', difficulty);
    if (difficulty === 'Intermediate')
        return CreateNumberGridState('magic-square', difficulty);
    return CreateNumberGridState('sudoku', difficulty);
}
function MaskNumberGrid(kind: NumberGridState['kind'], size: number, solution: number[], blanks: number, boxSize?: number): NumberGridState {
    const values = [...solution];
    const givens = Array.from({ length: solution.length }, () => true);
    Shuffle(Array.from({ length: solution.length }, (_, index) => index)).slice(0, blanks).forEach((index) => {
        values[index] = empty;
        givens[index] = false;
    });
    return { kind, size, boxSize, solution, values, givens, moves: 0, errors: 0 };
}
function HandleNumberGridTap(state: NumberGridState, index: number, finishGame: (result: GameResult) => void) {
    if (state.givens[index])
        return;
    const emptyValue = empty;
    const maxValue = state.kind === 'magic-square' ? state.size * state.size : state.size;
    const current = state.values[index];
    state.values[index] = current >= maxValue ? emptyValue : current + 1;
    state.moves += 1;
    if (IsNumberGridSolved(state)) {
        finishGame('Victory');
        return;
    }
    if (state.values.every((value) => value !== emptyValue))
        state.errors += 1;
}
function IsNumberGridSolved(state: NumberGridState) {
    return state.values.every((value, index) => value === state.solution[index]);
}
function DrawNumberGrid(app: Application, state: NumberGridState, onTap: (index: number) => void, _t: TFunction) {
    const emptyValue = empty;
    const preferred = state.kind === 'sudoku' ? 50 : state.size >= 8 ? 46 : 74;
    const { cell, gap, startX, startY } = GetGridLayout(app, state.size, state.size, preferred, 0);
    state.values.forEach((value, index) => {
        const row = Math.floor(index / state.size);
        const col = index % state.size;
        const node = InteractiveNode(onTap, index);
        node.x = startX + col * (cell + gap);
        node.y = startY + row * (cell + gap);
        const given = state.givens[index];
        const g = new Graphics();
        g.rect(0, 0, cell, cell).fill(numberGridCellFill);
        node.addChild(g);
        if (value !== emptyValue) {
            AddText(node, String(value), cell / 2, cell / 2, {
                fontSize: Math.max(18, cell * 0.42),
                fontWeight: given ? '900' : '700',
                fill: given ? numberGridGivenText : numberGridEntryText,
            });
        }
        app.stage.addChild(node);
    });
    DrawNumberGridLines(app, startX, startY, cell, state.size, state.kind === 'sudoku' ? (state.boxSize ?? 3) : state.size);
}
function DrawNumberGridLines(app: Application, startX: number, startY: number, cell: number, size: number, majorEvery: number) {
    const boardSize = cell * size;
    const minor = new Graphics();
    const major = new Graphics();
    for (let index = 0; index <= size; index += 1) {
        const position = index * cell;
        const target = index % majorEvery === 0 ? major : minor;
        target.moveTo(startX + position, startY).lineTo(startX + position, startY + boardSize);
        target.moveTo(startX, startY + position).lineTo(startX + boardSize, startY + position);
    }
    minor.stroke({ color: numberGridBorder, width: 1 });
    major.stroke({ color: numberGridBorder, width: 4 });
    app.stage.addChild(minor);
    app.stage.addChild(major);
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
