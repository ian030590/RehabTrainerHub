// Runtime helpers local to their Hub-owned cognitive modules.
import { Application,Graphics } from 'pixi.js';
export const cognitiveAccentCss = '#7A4A24';
export const cognitiveBg = 0xf7f1ea;
export const cognitiveBoardWidthRatio = 0.75;
export const cognitiveBoardHeightRatio = 1;
const mobileCognitiveMaxMinorAxis = 640;
export function DrawBackground(app: Application) {
    const bg = new Graphics();
    bg.rect(0, 0, app.renderer.width, app.renderer.height).fill(cognitiveBg);
    app.stage.addChild(bg);
}
export function IsMobileCognitiveViewport(app: Application) {
    return Math.min(app.renderer.width, app.renderer.height) <= mobileCognitiveMaxMinorAxis;
}
export function GetResponsiveBoardMaxSize(app: Application) {
    return {
        width: app.renderer.width * cognitiveBoardWidthRatio,
        height: app.renderer.height * cognitiveBoardHeightRatio,
    };
}
export function GetResponsiveBoardBounds(app: Application) {
    const size = GetResponsiveBoardMaxSize(app);
    return {
        ...size,
        left: (app.renderer.width - size.width) / 2,
        top: (app.renderer.height - size.height) / 2,
        right: (app.renderer.width + size.width) / 2,
        bottom: (app.renderer.height + size.height) / 2,
    };
}
export function GetGridLayout(app: Application, cols: number, rows: number, _preferredCell: number, gap: number, padding = 0) {
    const boardBounds = GetResponsiveBoardBounds(app);
    const maxW = Math.max(1, boardBounds.width - padding * 2);
    const maxH = Math.max(1, boardBounds.height - padding * 2);
    const cell = Math.floor(Math.min((maxW - gap * (cols - 1)) / cols, (maxH - gap * (rows - 1)) / rows));
    const width = cell * cols + gap * (cols - 1);
    const height = cell * rows + gap * (rows - 1);
    return {
        cell,
        gap,
        startX: boardBounds.left + (boardBounds.width - width - padding * 2) / 2 + padding,
        startY: boardBounds.top + (boardBounds.height - height - padding * 2) / 2 + padding,
    };
}
export function ClearStage(app: Application) {
    const children = app.stage.removeChildren();
    children.forEach((child) => child.destroy({ children: true }));
}
export function Average(values: number[]) {
    if (values.length === 0)
        return null;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
export function RandomBetween(min: number, max: number) {
    return min + Math.random() * (max - min);
}
export function GetPointerEventTimestamp(event: {
    timeStamp?: number;
}) {
    const now = performance.now();
    const timestamp = Number(event.timeStamp);
    return Number.isFinite(timestamp) && timestamp > 0 && Math.abs(timestamp - now) < 60000 ? timestamp : now;
}
