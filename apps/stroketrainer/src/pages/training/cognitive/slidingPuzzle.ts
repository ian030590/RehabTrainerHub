import { Application, Container, Graphics } from 'pixi.js';
import { SLIDING_CONFIG } from './constants';
import type { TFunction } from '../types';
import type { Difficulty, GameResult, HudState, ResultStats, SessionLimitSeconds, SlidingState } from './types';
import {
  COGNITIVE_ACCENT,
  addText,
  formatTimeValue,
  getGridLayout,
  getSlidingNeighbors,
  isSlidingSolved,
} from './utils';

export function createSlidingState(difficulty: Difficulty): SlidingState {
  const config = SLIDING_CONFIG[difficulty];
  const total = config.size * config.size;
  const tiles = Array.from({ length: total }, (_, index) => (index + 1) % total);
  let blankIndex = total - 1;
  let lastBlank = -1;
  for (let i = 0; i < config.shuffles; i += 1) {
    const neighbors = getSlidingNeighbors(blankIndex, config.size).filter((index) => index !== lastBlank);
    const next = neighbors[Math.floor(Math.random() * neighbors.length)];
    [tiles[blankIndex], tiles[next]] = [tiles[next], tiles[blankIndex]];
    lastBlank = blankIndex;
    blankIndex = next;
  }
  return { kind: 'sliding-puzzle', size: config.size, tiles, blankIndex, moves: 0, errors: 0 };
}

export function handleSlidingTap(state: SlidingState, index: number, finishGame: (result: GameResult) => void) {
  if (!getSlidingNeighbors(state.blankIndex, state.size).includes(index)) {
    state.errors += 1;
    return;
  }
  [state.tiles[state.blankIndex], state.tiles[index]] = [state.tiles[index], state.tiles[state.blankIndex]];
  state.blankIndex = index;
  state.moves += 1;
  if (isSlidingSolved(state.tiles)) finishGame('Victory');
}

export function isSlidingAutoSuccess(state: SlidingState) {
  return isSlidingSolved(state.tiles);
}

export function summarizeSlidingState(state: SlidingState, elapsed: number, limit: SessionLimitSeconds, t: TFunction): HudState {
  return {
    primaryLabel: t('cognitive.hud.moves'),
    primaryValue: String(state.moves),
    secondaryLabel: t('cognitive.results.errors'),
    secondaryValue: String(state.errors),
    tertiaryLabel: t('cognitive.hud.remaining'),
    tertiaryValue: formatTimeValue(elapsed, limit),
  };
}

export function buildSlidingResultStats(state: SlidingState): ResultStats {
  return {
    score: Math.max(0, 1000 - state.moves * 10 - state.errors * 25),
    accuracy: state.moves + state.errors > 0 ? Math.round((state.moves / (state.moves + state.errors)) * 100) : 0,
    moves: state.moves,
    attempts: state.moves + state.errors,
    success: state.moves,
    errors: state.errors,
    details: { size: state.size, solved: isSlidingSolved(state.tiles) },
  };
}

export function drawSliding(app: Application, state: SlidingState, onTap: (index: number) => void) {
  const { cell, gap, startX, startY } = getGridLayout(app, state.size, state.size, 96, 8);
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
    g.roundRect(0, 0, cell, cell, 8).fill(COGNITIVE_ACCENT).stroke({ color: COGNITIVE_ACCENT, width: 2 });
    node.addChild(g);
    addText(node, String(tile), cell / 2, cell / 2, {
      fontSize: Math.max(22, cell * 0.38),
      fontWeight: '900',
      fill: '#FFFFFF',
    });
    app.stage.addChild(node);
  });
}
