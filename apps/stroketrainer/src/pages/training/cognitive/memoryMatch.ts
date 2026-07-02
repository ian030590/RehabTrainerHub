import { Application, Container, Graphics } from 'pixi.js';
import { CARD_VALUES, MEMORY_CONFIG } from './constants';
import type { TFunction } from '../types';
import type { Difficulty, GameResult, HudState, MemoryState, ResultStats, SessionLimitSeconds } from './types';
import {
  COGNITIVE_ACCENT,
  COGNITIVE_ACCENT_TINT,
  COGNITIVE_BORDER,
  COGNITIVE_SURFACE,
  addText,
  formatTimeValue,
  getGridLayout,
  shuffle,
} from './utils';

export function createMemoryState(difficulty: Difficulty): MemoryState {
  const config = MEMORY_CONFIG[difficulty];
  const values = shuffle(CARD_VALUES).slice(0, config.pairs);
  const cards = shuffle([...values, ...values]).map((value) => ({ value, revealed: false, matched: false }));
  return {
    kind: 'memory-match',
    rows: config.rows,
    cols: config.cols,
    pairs: config.pairs,
    cards,
    flipped: [],
    matchedPairs: 0,
    moves: 0,
    errors: 0,
    mismatchClearAt: null,
  };
}

export function handleMemoryTap(state: MemoryState, index: number, elapsed: number, finishGame: (result: GameResult) => void) {
  if (state.mismatchClearAt !== null || state.flipped.length >= 2) return;
  const card = state.cards[index];
  if (!card || card.revealed || card.matched) return;
  card.revealed = true;
  state.flipped.push(index);
  if (state.flipped.length !== 2) return;

  state.moves += 1;
  const [first, second] = state.flipped;
  if (state.cards[first].value === state.cards[second].value) {
    state.cards[first].matched = true;
    state.cards[second].matched = true;
    state.flipped = [];
    state.matchedPairs += 1;
    if (state.matchedPairs === state.pairs) finishGame('Victory');
  } else {
    state.errors += 1;
    state.mismatchClearAt = elapsed + 0.75;
  }
}

export function updateMemoryTimedState(state: MemoryState, elapsed: number, render: () => void) {
  if (state.mismatchClearAt === null || elapsed < state.mismatchClearAt) return;
  state.flipped.forEach((index) => {
    if (!state.cards[index].matched) state.cards[index].revealed = false;
  });
  state.flipped = [];
  state.mismatchClearAt = null;
  render();
}

export function isMemoryAutoSuccess(state: MemoryState) {
  return state.matchedPairs === state.pairs;
}

export function summarizeMemoryState(state: MemoryState, elapsed: number, limit: SessionLimitSeconds, t: TFunction): HudState {
  return {
    primaryLabel: t('cognitive.hud.pairs'),
    primaryValue: `${state.matchedPairs}/${state.pairs}`,
    secondaryLabel: t('cognitive.hud.moves'),
    secondaryValue: String(state.moves),
    tertiaryLabel: t('cognitive.hud.remaining'),
    tertiaryValue: formatTimeValue(elapsed, limit),
  };
}

export function buildMemoryResultStats(state: MemoryState): ResultStats {
  const accuracy = state.moves > 0 ? Math.round((state.matchedPairs / state.moves) * 100) : 0;
  return {
    score: Math.max(0, state.matchedPairs * 120 - state.errors * 20 - state.moves * 2),
    accuracy,
    moves: state.moves,
    attempts: state.moves,
    success: state.matchedPairs,
    errors: state.errors,
    details: { rows: state.rows, cols: state.cols, pairs: state.pairs },
  };
}

export function drawMemory(app: Application, state: MemoryState, onTap: (index: number) => void) {
  const { cell, gap, startX, startY } = getGridLayout(app, state.cols, state.rows, 92, 10);
  state.cards.forEach((card, index) => {
    const row = Math.floor(index / state.cols);
    const col = index % state.cols;
    const x = startX + col * (cell + gap);
    const y = startY + row * (cell + gap);
    const node = new Container();
    node.x = x;
    node.y = y;
    node.eventMode = card.matched ? 'none' : 'static';
    node.cursor = card.matched ? 'default' : 'pointer';
    node.on('pointertap', () => onTap(index));
    const cardColor = card.matched ? COGNITIVE_ACCENT_TINT : card.revealed ? COGNITIVE_SURFACE : COGNITIVE_ACCENT;
    const borderColor = card.revealed || card.matched ? COGNITIVE_BORDER : COGNITIVE_ACCENT;
    const g = new Graphics();
    g.roundRect(0, 0, cell, cell, 8).fill(cardColor).stroke({ color: borderColor, width: 2 });
    node.addChild(g);
    addText(node, card.revealed || card.matched ? card.value : '?', cell / 2, cell / 2, {
      fontSize: Math.max(24, cell * 0.42),
      fontWeight: '800',
      fill: card.revealed || card.matched ? '#1A1C1E' : '#FFFFFF',
    });
    app.stage.addChild(node);
  });
}
