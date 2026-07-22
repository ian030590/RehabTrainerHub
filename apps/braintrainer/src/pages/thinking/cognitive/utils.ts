import { Application, Container, Graphics, Text } from 'pixi.js';

export const cognitiveAccentCss = '#7A4A24';
export const cognitiveAccent = 0x7a4a24;
export const cognitiveAccentTint = 0xfbf3eb;
export const cognitiveSurface = 0xffffff;
export const cognitiveBg = 0xf7f1ea;
export const cognitiveBorder = 0xd8c6b7;
export const cognitiveText = 0x201a16;
export const cognitiveTextMuted = 0x594235;
export const cognitiveBoardRatio = 0.6;
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
    width: app.renderer.width * cognitiveBoardRatio,
    height: app.renderer.height * cognitiveBoardRatio,
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

export function ToggleLights(lights: boolean[][], row: number, col: number) {
  const size = lights.length;
  [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dy, dx]) => {
    const y = row + dy;
    const x = col + dx;
    if (y < 0 || y >= size || x < 0 || x >= size) return;
    lights[y][x] = !lights[y][x];
  });
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

export function Average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function RandomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function GetPointerEventTimestamp(event: { timeStamp?: number }) {
  const now = performance.now();
  const timestamp = Number(event.timeStamp);
  return Number.isFinite(timestamp) && timestamp > 0 && Math.abs(timestamp - now) < 60_000 ? timestamp : now;
}

export function Shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function Clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
