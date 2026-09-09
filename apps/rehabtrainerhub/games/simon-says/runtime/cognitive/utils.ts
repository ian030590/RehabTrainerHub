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
export function ClearStage(app: Application) {
    const children = app.stage.removeChildren();
    children.forEach((child) => child.destroy({ children: true }));
}
export function RandomBetween(min: number, max: number) {
    return min + Math.random() * (max - min);
}
