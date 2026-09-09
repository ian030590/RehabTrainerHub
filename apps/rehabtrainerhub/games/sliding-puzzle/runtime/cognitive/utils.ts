// Runtime helpers local to their Hub-owned cognitive modules.
import { Application,Container,Graphics,Text } from 'pixi.js';
export const cognitiveAccentCss = '#7A4A24';
export const cognitiveBg = 0xf7f1ea;
export const cognitiveBoardWidthRatio = 0.75;
export const cognitiveBoardHeightRatio = 1;
export function DrawBackground(app: Application) {
    const bg = new Graphics();
    bg.rect(0, 0, app.renderer.width, app.renderer.height).fill(cognitiveBg);
    app.stage.addChild(bg);
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
export function AddText(container: Container, text: string, x: number, y: number, style: Record<string, unknown>) {
    const label = new Text({ text, style });
    label.anchor.set(0.5);
    label.x = x;
    label.y = y;
    container.addChild(label);
}
export function ClearStage(app: Application) {
    const children = app.stage.removeChildren();
    children.forEach((child) => child.destroy({ children: true }));
}
export function GetSlidingNeighbors(index: number, size: number) {
    const row = Math.floor(index / size);
    const col = index % size;
    return [
        row > 0 ? index - size : null,
        row < size - 1 ? index + size : null,
        col > 0 ? index - 1 : null,
        col < size - 1 ? index + 1 : null,
    ].filter((value): value is number => value !== null);
}
export function IsSlidingSolved(tiles: number[]) {
    return tiles.every((tile, index) => tile === (index + 1) % tiles.length);
}
export function RandomBetween(min: number, max: number) {
    return min + Math.random() * (max - min);
}
