import { Application, Container, Graphics, Text } from 'pixi.js';

export const COGNITIVE_ACCENT_CSS = '#005EB8';
export const COGNITIVE_ACCENT = 0x005eb8;
export const COGNITIVE_ACCENT_TINT = 0xe8f3ff;
export const COGNITIVE_SURFACE = 0xffffff;
export const COGNITIVE_BG = 0xf2f4f3;
export const COGNITIVE_BORDER = 0xc2c6d4;
export const COGNITIVE_TEXT = 0x1a1c1e;
export const COGNITIVE_TEXT_MUTED = 0x424752;
export const MOBILE_COGNITIVE_BOARD_RATIO = 0.7;
const MOBILE_COGNITIVE_MAX_MINOR_AXIS = 640;
const DESKTOP_COGNITIVE_BOARD_MARGIN = 48;

export function drawBackground(app: Application) {
  const bg = new Graphics();
  bg.rect(0, 0, app.renderer.width, app.renderer.height).fill(COGNITIVE_BG);
  app.stage.addChild(bg);
}

export function isMobileCognitiveViewport(app: Application) {
  return Math.min(app.renderer.width, app.renderer.height) <= MOBILE_COGNITIVE_MAX_MINOR_AXIS;
}

export function getResponsiveBoardMaxSize(app: Application) {
  if (isMobileCognitiveViewport(app)) {
    return {
      width: app.renderer.width * MOBILE_COGNITIVE_BOARD_RATIO,
      height: app.renderer.height * MOBILE_COGNITIVE_BOARD_RATIO,
    };
  }
  return {
    width: app.renderer.width - DESKTOP_COGNITIVE_BOARD_MARGIN,
    height: app.renderer.height - DESKTOP_COGNITIVE_BOARD_MARGIN,
  };
}

export function getResponsiveBoardBounds(app: Application) {
  const size = getResponsiveBoardMaxSize(app);
  return {
    ...size,
    left: (app.renderer.width - size.width) / 2,
    top: (app.renderer.height - size.height) / 2,
    right: (app.renderer.width + size.width) / 2,
    bottom: (app.renderer.height + size.height) / 2,
  };
}

export function getGridLayout(app: Application, cols: number, rows: number, preferredCell: number, gap: number, padding = 0) {
  const boardBounds = getResponsiveBoardBounds(app);
  const preferredLimit = isMobileCognitiveViewport(app) ? Number.POSITIVE_INFINITY : preferredCell;
  const maxW = Math.max(1, boardBounds.width - padding * 2);
  const maxH = Math.max(1, boardBounds.height - padding * 2);
  const cell = Math.floor(Math.min(preferredLimit, (maxW - gap * (cols - 1)) / cols, (maxH - gap * (rows - 1)) / rows));
  const width = cell * cols + gap * (cols - 1);
  const height = cell * rows + gap * (rows - 1);
  return {
    cell,
    gap,
    startX: boardBounds.left + (boardBounds.width - width - padding * 2) / 2 + padding,
    startY: boardBounds.top + (boardBounds.height - height - padding * 2) / 2 + padding,
  };
}

export function addText(container: Container, text: string, x: number, y: number, style: Record<string, unknown>) {
  const label = new Text({ text, style });
  label.anchor.set(0.5);
  label.x = x;
  label.y = y;
  container.addChild(label);
}

export function clearStage(app: Application) {
  const children = app.stage.removeChildren();
  children.forEach((child) => child.destroy({ children: true }));
}

export function toggleLights(lights: boolean[][], row: number, col: number) {
  const size = lights.length;
  [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dy, dx]) => {
    const y = row + dy;
    const x = col + dx;
    if (y < 0 || y >= size || x < 0 || x >= size) return;
    lights[y][x] = !lights[y][x];
  });
}

export function getSlidingNeighbors(index: number, size: number) {
  const row = Math.floor(index / size);
  const col = index % size;
  return [
    row > 0 ? index - size : null,
    row < size - 1 ? index + size : null,
    col > 0 ? index - 1 : null,
    col < size - 1 ? index + 1 : null,
  ].filter((value): value is number => value !== null);
}

export function isSlidingSolved(tiles: number[]) {
  return tiles.every((tile, index) => tile === (index + 1) % tiles.length);
}

export function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
