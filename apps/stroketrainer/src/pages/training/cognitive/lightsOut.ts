import { Application, Container, Graphics } from 'pixi.js';
import { LIGHTS_CONFIG } from './constants';
import type { Difficulty, GameResult, LightsOutState, ResultStats } from './types';
import {
  COGNITIVE_ACCENT,
  COGNITIVE_BORDER,
  COGNITIVE_SURFACE,
  getGridLayout,
  toggleLights,
} from './utils';

export function createLightsState(difficulty: Difficulty): LightsOutState {
  const config = LIGHTS_CONFIG[difficulty];
  const lights = Array.from({ length: config.size }, () => Array.from({ length: config.size }, () => false));
  for (let i = 0; i < config.shuffles; i += 1) {
    toggleLights(lights, Math.floor(Math.random() * config.size), Math.floor(Math.random() * config.size));
  }
  if (isAllLightsOff(lights)) {
    toggleLights(lights, Math.floor(config.size / 2), Math.floor(config.size / 2));
  }
  return { kind: 'lights-out', size: config.size, lights, moves: 0 };
}

export function handleLightsTap(state: LightsOutState, index: number, finishGame: (result: GameResult) => void) {
  const row = Math.floor(index / state.size);
  const col = index % state.size;
  toggleLights(state.lights, row, col);
  state.moves += 1;
  if (isAllLightsOff(state.lights)) finishGame('Victory');
}

export function isLightsAutoSuccess(state: LightsOutState) {
  return isAllLightsOff(state.lights);
}

export function buildLightsResultStats(state: LightsOutState): ResultStats {
  const lightsOn = countLightsOn(state.lights);
  return {
    score: Math.max(0, 1000 - state.moves * 12 - lightsOn * 35),
    accuracy: lightsOn === 0 ? 100 : Math.max(0, Math.round(((state.size * state.size - lightsOn) / (state.size * state.size)) * 100)),
    moves: state.moves,
    attempts: state.moves,
    success: state.size * state.size - lightsOn,
    errors: lightsOn,
    details: { size: state.size, lightsOn },
  };
}

function isAllLightsOff(lights: boolean[][]): boolean {
  return lights.every((row) => row.every((light) => !light));
}

function countLightsOn(lights: boolean[][]): number {
  return lights.reduce(
    (total, row) => total + row.reduce((rowTotal, light) => rowTotal + (light ? 1 : 0), 0),
    0,
  );
}

export function drawLightsOut(app: Application, state: LightsOutState, onTap: (index: number) => void) {
  const { cell, gap, startX, startY } = getGridLayout(app, state.size, state.size, 96, 10);
  state.lights.forEach((row, yIndex) => {
    row.forEach((light, xIndex) => {
      const index = yIndex * state.size + xIndex;
      const x = startX + xIndex * (cell + gap);
      const y = startY + yIndex * (cell + gap);
      const node = new Container();
      node.x = x;
      node.y = y;
      node.eventMode = 'static';
      node.cursor = 'pointer';
      node.on('pointertap', () => onTap(index));
      const g = new Graphics();
      g.roundRect(0, 0, cell, cell, 8)
        .fill(light ? COGNITIVE_ACCENT : COGNITIVE_SURFACE)
        .stroke({ color: light ? COGNITIVE_ACCENT : COGNITIVE_BORDER, width: 2 });
      node.addChild(g);
      if (light) {
        const glow = new Graphics();
        glow.circle(cell / 2, cell / 2, cell * 0.18).fill({ color: 0xffffff, alpha: 0.72 });
        node.addChild(glow);
      }
      app.stage.addChild(node);
    });
  });
}
