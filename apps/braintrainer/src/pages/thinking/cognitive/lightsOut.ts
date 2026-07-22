import { Application, Container, Graphics } from 'pixi.js';
import { lightsConfig } from './constants';
import type { Difficulty, GameResult, LightsOutState, ResultStats } from './types';
import {
  GetGridLayout,
  IsMobileCognitiveViewport,
  ToggleLights,
} from './utils';

const lightsBoardColor = 0x1a1a2e;
const lightsCellOff = 0x16213e;
const lightsCellOffBorder = 0x0f3460;
const lightsCellOn = 0xf1c40f;
const lightsCellOnBorder = 0xf39c12;

export function CreateLightsState(difficulty: Difficulty): LightsOutState {
  const config = lightsConfig[difficulty];
  const lights = Array.from({ length: config.size }, () => Array.from({ length: config.size }, () => false));
  for (let i = 0; i < config.shuffles; i += 1) {
    ToggleLights(lights, Math.floor(Math.random() * config.size), Math.floor(Math.random() * config.size));
  }
  if (IsAllLightsOff(lights)) {
    ToggleLights(lights, Math.floor(config.size / 2), Math.floor(config.size / 2));
  }
  return { kind: 'lights-out', size: config.size, lights, moves: 0 };
}

export function HandleLightsTap(state: LightsOutState, index: number, finishGame: (result: GameResult) => void) {
  const row = Math.floor(index / state.size);
  const col = index % state.size;
  ToggleLights(state.lights, row, col);
  state.moves += 1;
  if (IsAllLightsOff(state.lights)) finishGame('Victory');
}

export function IsLightsAutoSuccess(state: LightsOutState) {
  return IsAllLightsOff(state.lights);
}

export function BuildLightsResultStats(state: LightsOutState): ResultStats {
  const lightsOn = CountLightsOn(state.lights);
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

function IsAllLightsOff(lights: boolean[][]): boolean {
  return lights.every((row) => row.every((light) => !light));
}

function CountLightsOn(lights: boolean[][]): number {
  return lights.reduce(
    (total, row) => total + row.reduce((rowTotal, light) => rowTotal + (light ? 1 : 0), 0),
    0,
  );
}

export function DrawLightsOut(app: Application, state: LightsOutState, onTap: (index: number) => void) {
  const padding = IsMobileCognitiveViewport(app) ? 10 : 15;
  const { cell, gap, startX, startY } = GetGridLayout(app, state.size, state.size, 60, 4, padding);
  const board = new Graphics();
  board.rect(
    startX - padding,
    startY - padding,
    state.size * cell + (state.size - 1) * gap + padding * 2,
    state.size * cell + (state.size - 1) * gap + padding * 2,
  ).fill(lightsBoardColor);
  app.stage.addChild(board);

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
      g.rect(0, 0, cell, cell)
        .fill(light ? lightsCellOn : lightsCellOff)
        .stroke({ color: light ? lightsCellOnBorder : lightsCellOffBorder, width: 2 });
      node.addChild(g);
      if (light) {
        const glow = new Graphics();
        glow.circle(cell / 2, cell / 2, cell * 0.32).fill({ color: lightsCellOn, alpha: 0.32 });
        glow.circle(cell / 2, cell / 2, cell * 0.18).fill({ color: 0xffffff, alpha: 0.78 });
        node.addChild(glow);
      }
      app.stage.addChild(node);
    });
  });
}
