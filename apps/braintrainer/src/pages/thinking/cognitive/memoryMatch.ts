import { Application, Container, Graphics } from 'pixi.js';
import { cardValues, memoryConfig } from './constants';
import type { Difficulty, GameResult, MemoryState, ResultStats } from './types';
import {
  AddText,
  GetGridLayout,
  IsMobileCognitiveViewport,
  Shuffle,
} from './utils';

const memoryBoardColor = 0x34495e;
const memoryCardFront = 0x3498db;
const memoryCardBack = 0xecf0f1;
const memoryCardMatched = 0x2ecc71;
const memoryTextDark = '#2c3e50';

export function CreateMemoryState(difficulty: Difficulty): MemoryState {
  const config = memoryConfig[difficulty];
  const values = Shuffle(cardValues).slice(0, config.pairs);
  const cards = Shuffle([...values, ...values]).map((value) => ({ value, revealed: false, matched: false }));
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

export function HandleMemoryTap(state: MemoryState, index: number, elapsed: number, finishGame: (result: GameResult) => void) {
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

export function UpdateMemoryTimedState(state: MemoryState, elapsed: number, render: () => void) {
  if (state.mismatchClearAt === null || elapsed < state.mismatchClearAt) return;
  state.flipped.forEach((index) => {
    if (!state.cards[index].matched) state.cards[index].revealed = false;
  });
  state.flipped = [];
  state.mismatchClearAt = null;
  render();
}

export function IsMemoryAutoSuccess(state: MemoryState) {
  return state.matchedPairs === state.pairs;
}

export function BuildMemoryResultStats(state: MemoryState): ResultStats {
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

export function DrawMemory(app: Application, state: MemoryState, onTap: (index: number) => void) {
  const padding = IsMobileCognitiveViewport(app) ? 10 : 15;
  const { cell, gap, startX, startY } = GetGridLayout(app, state.cols, state.rows, 70, 10, padding);
  const board = new Graphics();
  board.rect(
    startX - padding,
    startY - padding,
    state.cols * cell + (state.cols - 1) * gap + padding * 2,
    state.rows * cell + (state.rows - 1) * gap + padding * 2,
  ).fill(memoryBoardColor);
  app.stage.addChild(board);

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
    const cardColor = card.matched ? memoryCardMatched : card.revealed ? memoryCardBack : memoryCardFront;
    const g = new Graphics();
    g.rect(0, 0, cell, cell).fill(cardColor);
    node.addChild(g);
    AddText(node, card.revealed || card.matched ? card.value : '?', cell / 2, cell / 2, {
      fontSize: Math.max(24, cell * 0.42),
      fontWeight: '400',
      fill: card.revealed || card.matched ? memoryTextDark : '#FFFFFF',
    });
    app.stage.addChild(node);
  });
}
