import { Application, Container, Graphics } from 'pixi.js';
import { WHACK_CONFIG } from './constants';
import type { Difficulty, ResultStats, WhackState } from './types';
import {
  COGNITIVE_ACCENT,
  COGNITIVE_BORDER,
  COGNITIVE_SURFACE,
  clamp,
  getGridLayout,
  randomBetween,
} from './utils';

export function createWhackState(difficulty: Difficulty): WhackState {
  const config = WHACK_CONFIG[difficulty];
  return {
    kind: 'whack-a-mole',
    gridSize: config.gridSize,
    activeIndex: null,
    nextTargetAt: 0.6,
    targetExpiresAt: null,
    targetMs: config.targetMs,
    minDelay: config.minDelay,
    maxDelay: config.maxDelay,
    hits: 0,
    misses: 0,
    taps: 0,
  };
}

export function handleWhackTap(state: WhackState, index: number, elapsed: number) {
  state.taps += 1;
  if (state.activeIndex === index) {
    state.hits += 1;
    scheduleNextTarget(state, elapsed);
    return;
  }
  state.misses += 1;
}

export function updateWhackTimedState(state: WhackState, elapsed: number, render: () => void) {
  if (state.activeIndex !== null && state.targetExpiresAt !== null && elapsed >= state.targetExpiresAt) {
    state.misses += 1;
    scheduleNextTarget(state, elapsed);
    render();
  }
  if (state.activeIndex === null && elapsed >= state.nextTargetAt) {
    state.activeIndex = Math.floor(Math.random() * state.gridSize * state.gridSize);
    state.targetExpiresAt = elapsed + state.targetMs / 1000;
    render();
  }
}

function scheduleNextTarget(state: WhackState, elapsed: number) {
  state.activeIndex = null;
  state.targetExpiresAt = null;
  state.nextTargetAt = elapsed + randomBetween(state.minDelay, state.maxDelay);
}

export function isWhackAutoSuccess(state: WhackState) {
  return state.hits > 0;
}

export function buildWhackResultStats(state: WhackState): ResultStats {
  return {
    score: Math.max(0, state.hits * 100 - state.misses * 25),
    accuracy: state.taps > 0 ? Math.round((state.hits / state.taps) * 100) : 0,
    moves: 0,
    attempts: state.taps,
    success: state.hits,
    errors: state.misses,
    details: { gridSize: state.gridSize, targetMs: state.targetMs },
  };
}

export function drawWhack(app: Application, state: WhackState, elapsed: number, duration: number, onTap: (index: number) => void) {
  const { cell, gap, startX, startY } = getGridLayout(app, state.gridSize, state.gridSize, 104, 14);
  const total = state.gridSize * state.gridSize;
  for (let index = 0; index < total; index += 1) {
    const row = Math.floor(index / state.gridSize);
    const col = index % state.gridSize;
    const x = startX + col * (cell + gap);
    const y = startY + row * (cell + gap);
    const node = new Container();
    node.x = x;
    node.y = y;
    node.eventMode = 'static';
    node.cursor = 'pointer';
    node.on('pointertap', () => onTap(index));
    const g = new Graphics();
    g.roundRect(0, 0, cell, cell, 8).fill(COGNITIVE_SURFACE).stroke({ color: COGNITIVE_BORDER, width: 2 });
    g.circle(cell / 2, cell / 2, cell * 0.28).fill(0xe7eef5).stroke({ color: COGNITIVE_BORDER, width: 2 });
    node.addChild(g);
    if (state.activeIndex === index) {
      const target = new Graphics();
      target.circle(cell / 2, cell / 2, cell * 0.28).fill(COGNITIVE_ACCENT);
      target.circle(cell / 2, cell / 2, cell * 0.14).fill(COGNITIVE_SURFACE);
      target.circle(cell / 2, cell / 2, cell * 0.06).fill(COGNITIVE_ACCENT);
      node.addChild(target);
    }
    app.stage.addChild(node);
  }
  const progressWidth = Math.min(app.renderer.width - 48, 520);
  const progressX = (app.renderer.width - progressWidth) / 2;
  const progressY = Math.max(80, startY - 36);
  const ratio = clamp(1 - elapsed / Math.max(1, duration), 0, 1);
  const bar = new Graphics();
  bar.roundRect(progressX, progressY, progressWidth, 10, 5).fill(0xd8dee8);
  bar.roundRect(progressX, progressY, progressWidth * ratio, 10, 5).fill(COGNITIVE_ACCENT);
  app.stage.addChild(bar);
}
