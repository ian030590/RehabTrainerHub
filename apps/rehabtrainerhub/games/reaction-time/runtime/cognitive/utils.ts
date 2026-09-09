// Runtime helpers local to their Hub-owned cognitive modules.
import { Application,Container,Graphics,Text } from 'pixi.js';
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
