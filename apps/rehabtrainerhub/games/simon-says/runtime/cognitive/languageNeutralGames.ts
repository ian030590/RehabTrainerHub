// Hub-owned language-neutral cognitive runtimes.
import { Application,Container,Graphics } from 'pixi.js';
import { CreateSimonState,HandleSimonTap } from './trialRecords';
import type { CognitiveGameState,Difficulty,GameResult,NumberGridState,ReferenceGameId,SimonState,SimonTapResult,SimonTrialRecord,TFunction } from './types';
import { GetResponsiveBoardMaxSize,IsMobileCognitiveViewport } from './utils';
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
const originalGreen = 0x2ecc71;
const originalRed = 0xe74c3c;
const originalYellow = 0xf1c40f;
const originalText = 0x2c3e50;
const simonLightSeconds = 0.36;
const simonLightGapSeconds = 0.14;
const simonClickAnimationSeconds = 0.18;
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
        case 'simon-says':
            return CreateSimonState(difficulty, simonLives);
        default:
            return null;
    }
}
export function HandleLanguageNeutralGameTap(state: LanguageNeutralGameState, index: number, elapsed: number, finishGame: (result: GameResult) => void, recordSimonTrial?: (trial: SimonTrialRecord) => void): SimonTapResult | null {
    switch (state.kind) {
        case 'simon-says':
            {
                const result = HandleSimonTap(state, index, elapsed);
                if (result.trial)
                    recordSimonTrial?.(result.trial);
                return result;
            }
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
    if (state.kind !== 'simon-says')
        return;
    if (state.pressedStartedAt !== null) {
        if (elapsed - state.pressedStartedAt < simonClickAnimationSeconds) {
            render();
        }
        else {
            state.pressedIndex = null;
            state.pressedStartedAt = null;
            render();
        }
    }
    if (state.status !== 'showing')
        return;
    if (state.litIndex !== null && elapsed < state.nextStepAt) {
        render();
        return;
    }
    if (elapsed < state.nextStepAt)
        return;
    if (state.litIndex !== null) {
        state.litIndex = null;
        state.litStartedAt = null;
        state.nextStepAt = elapsed + simonLightGapSeconds;
        render();
        return;
    }
    if (state.showIndex < state.sequence.length) {
        state.litIndex = state.sequence[state.showIndex];
        state.litStartedAt = elapsed;
        state.showIndex += 1;
        state.nextStepAt = elapsed + simonLightSeconds;
        render();
        return;
    }
    state.status = 'input';
    state.inputIndex = 0;
    state.attemptStartedAt = elapsed;
    onSimonInputStart?.();
    render();
}
export function IsLanguageNeutralAutoSuccess(state: LanguageNeutralGameState) {
    switch (state.kind) {
        case 'simon-says':
            return state.trials.some((trial) => trial.correct && trial.memoryLength >= state.targetRounds);
        default:
            return false;
    }
}
export function GetLanguageNeutralFeedbackCounts(state: LanguageNeutralGameState): {
    success: number;
    errors: number;
} {
    switch (state.kind) {
        case 'simon-says':
            return { success: state.moves, errors: state.errors };
        default:
            return { success: 0, errors: 0 };
    }
}
export function DrawLanguageNeutralGame(app: Application, state: LanguageNeutralGameState, elapsed: number, onTap: (index: number) => void, t: TFunction) {
    switch (state.kind) {
        case 'simon-says':
            DrawSimon(app, state, elapsed, onTap, t);
            break;
        default:
            break;
    }
}
function DrawSimon(app: Application, state: SimonState, elapsed: number, onTap: (index: number) => void, _t: TFunction) {
    const boardMax = GetResponsiveBoardMaxSize(app);
    const boardSize = Math.floor(Math.min(IsMobileCognitiveViewport(app) ? Number.POSITIVE_INFINITY : 320, boardMax.width, boardMax.height));
    const buttonSize = boardSize * (150 / 320);
    const gap = boardSize - buttonSize * 2;
    const startX = (app.renderer.width - boardSize) / 2;
    const startY = (app.renderer.height - boardSize) / 2;
    const buttons = [
        { color: originalGreen, activeColor: 0x58d68d, corner: 'top-left' as const },
        { color: originalRed, activeColor: 0xec7063, corner: 'top-right' as const },
        { color: originalYellow, activeColor: 0xf4d03f, corner: 'bottom-left' as const },
        { color: originalBlue, activeColor: 0x5dade2, corner: 'bottom-right' as const },
    ];
    buttons.forEach((button, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        DrawSimonButton(app, startX + col * (buttonSize + gap), startY + row * (buttonSize + gap), buttonSize, button.corner, state.litIndex === index ? button.activeColor : button.color, state.litIndex === index, state.litStartedAt, state.pressedIndex === index, state.pressedStartedAt, state.status === 'input', elapsed, index, onTap);
    });
    const center = new Graphics();
    center.circle(app.renderer.width / 2, app.renderer.height / 2, boardSize * (50 / 320)).fill(originalText);
    app.stage.addChild(center);
}
function DrawSimonButton(app: Application, x: number, y: number, size: number, corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right', color: number, active: boolean, litStartedAt: number | null, pressed: boolean, pressedStartedAt: number | null, interactive: boolean, elapsed: number, index: number, onTap: (index: number) => void) {
    const node = new Container();
    const g = new Graphics();
    const r = size;
    const lightProgress = active && litStartedAt !== null
        ? Math.min(1, Math.max(0, (elapsed - litStartedAt) / simonLightSeconds))
        : 1;
    const clickProgress = pressed && pressedStartedAt !== null
        ? Math.min(1, Math.max(0, (elapsed - pressedStartedAt) / simonClickAnimationSeconds))
        : 1;
    const lightBounce = active ? Math.sin(lightProgress * Math.PI) : 0;
    const clickBounce = pressed ? Math.sin(clickProgress * Math.PI) : 0;
    const baseScale = 1 + lightBounce * 0.1 - clickBounce * 0.07;
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    node.pivot.set(centerX, centerY);
    node.position.set(centerX, centerY);
    node.scale.set(baseScale);
    if (interactive) {
        node.eventMode = 'static';
        node.cursor = 'pointer';
        node.on('pointerover', () => node.scale.set(baseScale * 1.04));
        node.on('pointerout', () => node.scale.set(baseScale));
        node.on('pointertap', () => onTap(index));
    }
    if (active) {
        const glow = new Graphics();
        glow.roundRect(x - size * 0.08, y - size * 0.08, size * 1.16, size * 1.16, size * 0.2)
            .fill({ color, alpha: 0.24 })
            .stroke({ color: 0xffffff, width: 5, alpha: 0.88 });
        node.addChild(glow);
    }
    if (corner === 'top-left') {
        g.moveTo(x + r, y).lineTo(x + size, y).lineTo(x + size, y + size).lineTo(x, y + size).lineTo(x, y + r)
            .arc(x + r, y + r, r, Math.PI, Math.PI * 1.5).closePath();
    }
    else if (corner === 'top-right') {
        g.moveTo(x, y).lineTo(x + size - r, y)
            .arc(x + size - r, y + r, r, Math.PI * 1.5, Math.PI * 2)
            .lineTo(x + size, y + size).lineTo(x, y + size).closePath();
    }
    else if (corner === 'bottom-left') {
        g.moveTo(x, y).lineTo(x + size, y).lineTo(x + size, y + size).lineTo(x + r, y + size)
            .arc(x + r, y + size - r, r, Math.PI / 2, Math.PI)
            .lineTo(x, y).closePath();
    }
    else {
        g.moveTo(x, y).lineTo(x + size, y).lineTo(x + size, y + size - r)
            .arc(x + size - r, y + size - r, r, 0, Math.PI / 2)
            .lineTo(x, y + size).closePath();
    }
    g.fill({ color, alpha: active ? 1 : pressed ? 0.82 : 0.55 })
        .stroke({ color: active || pressed ? 0xffffff : 0x333333, width: active ? 7 : pressed ? 6 : 4 });
    node.addChild(g);
    if (pressed) {
        const clickFlash = new Graphics();
        clickFlash.roundRect(x + size * 0.1, y + size * 0.1, size * 0.8, size * 0.8, size * 0.16)
            .stroke({ color: 0xffffff, width: 5, alpha: 1 - clickProgress });
        node.addChild(clickFlash);
    }
    app.stage.addChild(node);
}
