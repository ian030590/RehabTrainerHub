import { Application, Container, Graphics, Text } from 'pixi.js';
import type { SessionLimitSeconds } from './types';

export const COGNITIVE_ACCENT_CSS = '#005EB8';
export const COGNITIVE_ACCENT = 0x005eb8;
export const COGNITIVE_ACCENT_TINT = 0xe8f3ff;
export const COGNITIVE_SURFACE = 0xffffff;
export const COGNITIVE_BG = 0xf2f4f3;
export const COGNITIVE_BORDER = 0xc2c6d4;
export const COGNITIVE_TEXT = 0x1a1c1e;
export const COGNITIVE_TEXT_MUTED = 0x424752;

export function drawBackground(app: Application) {
  const bg = new Graphics();
  bg.rect(0, 0, app.renderer.width, app.renderer.height).fill(COGNITIVE_BG);
  app.stage.addChild(bg);
}

export function getGridLayout(app: Application, cols: number, rows: number, preferredCell: number, gap: number) {
  const maxW = app.renderer.width - 48;
  const maxH = app.renderer.height - 138;
  const cell = Math.floor(Math.min(preferredCell, (maxW - gap * (cols - 1)) / cols, (maxH - gap * (rows - 1)) / rows));
  const width = cell * cols + gap * (cols - 1);
  const height = cell * rows + gap * (rows - 1);
  return {
    cell,
    gap,
    startX: (app.renderer.width - width) / 2,
    startY: (app.renderer.height - height) / 2 + 28,
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

export function formatTimeValue(elapsed: number, limit: SessionLimitSeconds) {
  return limit === null ? `${Math.floor(elapsed)}s` : `${Math.max(0, Math.ceil(limit - elapsed))}s`;
}
