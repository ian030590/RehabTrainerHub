import { Application, Container, Graphics } from 'pixi.js';
import { slidingConfig } from './constants';
import type { Difficulty, GameResult, ResultStats, SlidingState } from './types';
import {
  AddText,
  GetGridLayout,
  GetSlidingNeighbors,
  IsSlidingSolved,
} from './utils';

const slidingBoardColor = 0x34495e;
const slidingTileColor = 0x3498db;

export function CreateSlidingState(difficulty: Difficulty): SlidingState {
  const config = slidingConfig[difficulty];
  const total = config.size * config.size;
  const tiles = Array.from({ length: total }, (_, index) => (index + 1) % total);
  let blankIndex = total - 1;
  let lastBlank = -1;
  for (let i = 0; i < config.shuffles; i += 1) {
    const neighbors = GetSlidingNeighbors(blankIndex, config.size).filter((index) => index !== lastBlank);
    const next = neighbors[Math.floor(Math.random() * neighbors.length)];
    [tiles[blankIndex], tiles[next]] = [tiles[next], tiles[blankIndex]];
    lastBlank = blankIndex;
    blankIndex = next;
  }
  return { kind: 'sliding-puzzle', size: config.size, tiles, blankIndex, moves: 0, errors: 0 };
}

export function HandleSlidingTap(state: SlidingState, index: number, finishGame: (result: GameResult) => void) {
  if (!GetSlidingNeighbors(state.blankIndex, state.size).includes(index)) {
    state.errors += 1;
    return;
  }
  [state.tiles[state.blankIndex], state.tiles[index]] = [state.tiles[index], state.tiles[state.blankIndex]];
  state.blankIndex = index;
  state.moves += 1;
  if (IsSlidingSolved(state.tiles)) finishGame('Victory');
}

export function IsSlidingAutoSuccess(state: SlidingState) {
  return IsSlidingSolved(state.tiles);
}

export function BuildSlidingResultStats(state: SlidingState): ResultStats {
  return {
    score: Math.max(0, 1000 - state.moves * 10 - state.errors * 25),
    accuracy: state.moves + state.errors > 0 ? Math.round((state.moves / (state.moves + state.errors)) * 100) : 0,
    moves: state.moves,
    attempts: state.moves + state.errors,
    success: state.moves,
    errors: state.errors,
    details: { size: state.size, solved: IsSlidingSolved(state.tiles) },
  };
}

export function DrawSliding(app: Application, state: SlidingState, onTap: (index: number) => void) {
  const padding = 10;
  const { cell, gap, startX, startY } = GetGridLayout(app, state.size, state.size, 96, 5, padding);
  const board = new Graphics();
  board.rect(
    startX - padding,
    startY - padding,
    state.size * cell + (state.size - 1) * gap + padding * 2,
    state.size * cell + (state.size - 1) * gap + padding * 2,
  ).fill(slidingBoardColor);
  app.stage.addChild(board);

  state.tiles.forEach((tile, index) => {
    if (tile === 0) return;
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    const x = startX + col * (cell + gap);
    const y = startY + row * (cell + gap);
    const node = new Container();
    node.x = x;
    node.y = y;
    node.eventMode = 'static';
    node.cursor = 'pointer';
    node.on('pointertap', () => onTap(index));
    const g = new Graphics();
    g.rect(0, 0, cell, cell).fill(slidingTileColor);
    node.addChild(g);
    AddText(node, String(tile), cell / 2, cell / 2, {
      fontSize: Math.max(22, cell * 0.38),
      fontWeight: '400',
      fill: '#FFFFFF',
    });
    app.stage.addChild(node);
  });
}
