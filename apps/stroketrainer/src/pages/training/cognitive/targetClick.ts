import { Application, Container, Graphics } from 'pixi.js';
import { whackConfig } from './constants';
import type { Difficulty, ResultStats, WhackState } from './types';
import {
  Average,
  GetGridLayout,
  GetPointerEventTimestamp,
  IsMobileCognitiveViewport,
  RandomBetween,
} from './utils';

const moleBoardColor = 0x8b4513;
const moleHoleColor = 0x3d2314;
const moleBodyColor = 0x8b7355;
const moleFaceColor = 0x2c2c2c;
const moleNoseColor = 0x5c4033;

export function CreateWhackState(difficulty: Difficulty): WhackState {
  const config = whackConfig[difficulty];
  return {
    kind: 'whack-a-mole',
    gridSize: config.gridSize,
    activeIndex: null,
    nextTargetAt: performance.now() + 600,
    targetExpiresAt: null,
    targetStartedAt: null,
    targetMs: config.targetMs,
    minDelay: config.minDelay,
    maxDelay: config.maxDelay,
    hits: 0,
    misses: 0,
    taps: 0,
    hitReactionMs: [],
  };
}

export function HandleWhackTap(state: WhackState, index: number, tapMs: number) {
  state.taps += 1;
  if (state.activeIndex === index) {
    state.hits += 1;
    if (state.targetStartedAt !== null) {
      state.hitReactionMs.push(Math.max(0, Math.round(tapMs - state.targetStartedAt)));
    }
    ScheduleNextTarget(state, tapMs);
    return true;
  }
  state.misses += 1;
  return false;
}

export function UpdateWhackTimedState(state: WhackState, elapsed: number, render: () => void) {
  void state;
  void elapsed;
  void render;
}

export function ShowWhackTarget(state: WhackState, onsetMs: number) {
  if (state.activeIndex !== null) return false;
  state.activeIndex = Math.floor(Math.random() * state.gridSize * state.gridSize);
  state.targetStartedAt = onsetMs;
  state.targetExpiresAt = onsetMs + state.targetMs;
  return true;
}

export function ExpireWhackTarget(state: WhackState, nowMs: number) {
  if (state.activeIndex === null) return false;
  state.misses += 1;
  ScheduleNextTarget(state, nowMs);
  return true;
}

function ScheduleNextTarget(state: WhackState, nowMs: number) {
  state.activeIndex = null;
  state.targetExpiresAt = null;
  state.targetStartedAt = null;
  state.nextTargetAt = nowMs + RandomBetween(state.minDelay, state.maxDelay) * 1000;
}

export function IsWhackAutoSuccess(state: WhackState) {
  return state.hits > 0;
}

export function BuildWhackResultStats(state: WhackState): ResultStats {
  const avg = Average(state.hitReactionMs) ?? 0;
  const best = state.hitReactionMs.length > 0 ? Math.min(...state.hitReactionMs) : 0;
  return {
    score: Math.max(0, state.hits * 100 - state.misses * 25),
    accuracy: state.taps > 0 ? Math.round((state.hits / state.taps) * 100) : 0,
    moves: 0,
    attempts: state.taps,
    success: state.hits,
    errors: state.misses,
    details: { gridSize: state.gridSize, targetMs: state.targetMs, hitReactionMs: state.hitReactionMs, averageMs: avg, bestMs: best },
  };
}

export function DrawWhack(app: Application, state: WhackState, onTap: (index: number, tapMs: number) => void) {
  const padding = IsMobileCognitiveViewport(app) ? 15 : 20;
  const { cell, gap, startX, startY } = GetGridLayout(app, state.gridSize, state.gridSize, 100, 15, padding);
  const board = new Graphics();
  board.rect(
    startX - padding,
    startY - padding,
    state.gridSize * cell + (state.gridSize - 1) * gap + padding * 2,
    state.gridSize * cell + (state.gridSize - 1) * gap + padding * 2,
  ).fill(moleBoardColor);
  app.stage.addChild(board);

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
    node.on('pointertap', (event) => onTap(index, GetPointerEventTimestamp(event)));
    const g = new Graphics();
    g.circle(cell / 2, cell / 2, cell * 0.5).fill(moleHoleColor);
    g.ellipse(cell / 2, cell * 0.56, cell * 0.42, cell * 0.25).fill({ color: 0x000000, alpha: 0.25 });
    node.addChild(g);
    if (state.activeIndex === index) {
      const mole = new Graphics();
      mole.ellipse(cell / 2, cell * 0.55, cell * 0.34, cell * 0.36).fill(moleBodyColor);
      mole.circle(cell * 0.36, cell * 0.43, cell * 0.055).fill(moleFaceColor);
      mole.circle(cell * 0.64, cell * 0.43, cell * 0.055).fill(moleFaceColor);
      mole.ellipse(cell / 2, cell * 0.58, cell * 0.09, cell * 0.06).fill(moleNoseColor);
      node.addChild(mole);
    }
    app.stage.addChild(node);
  }
}
