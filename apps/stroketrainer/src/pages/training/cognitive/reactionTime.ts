import { Application, Container, Graphics } from 'pixi.js';
import { REACTION_CONFIG } from './constants';
import type { TFunction } from '../types';
import type { Difficulty, GameResult, ReactionState, ResultStats } from './types';
import {
  addText,
  average,
  getResponsiveBoardMaxSize,
  isMobileCognitiveViewport,
} from './utils';

const REACTION_COLORS: Record<ReactionState['status'], number> = {
  waiting: 0x3498db,
  ready: 0xe74c3c,
  go: 0x2ecc71,
  result: 0x3498db,
  'too-early': 0xe67e22,
};

export function createReactionState(targetTrials: number): ReactionState {
  return {
    kind: 'reaction-time',
    status: 'waiting',
    attempts: [],
    falseStarts: 0,
    targetTrials,
    goAt: null,
    goStartedAt: null,
    lastReactionMs: null,
  };
}

export function handleReactionStateTap(state: ReactionState, elapsed: number, difficulty: Difficulty, finishGame: (result: GameResult) => void) {
  if (state.status === 'waiting' || state.status === 'result' || state.status === 'too-early') {
    const cfg = REACTION_CONFIG[difficulty];
    state.status = 'ready';
    state.goAt = elapsed + cfg.minDelay + Math.random() * (cfg.maxDelay - cfg.minDelay);
    state.goStartedAt = null;
    state.lastReactionMs = null;
    return;
  }
  if (state.status === 'ready') {
    state.falseStarts += 1;
    state.status = 'too-early';
    state.goAt = null;
    return;
  }
  if (state.status === 'go' && state.goStartedAt !== null) {
    const reactionMs = Math.max(0, Math.round((elapsed - state.goStartedAt) * 1000));
    state.attempts.push(reactionMs);
    state.lastReactionMs = reactionMs;
    state.status = 'result';
    state.goAt = null;
    state.goStartedAt = null;
    if (state.attempts.length >= state.targetTrials) {
      finishGame('Victory');
    }
  }
}

export function updateReactionTimedState(state: ReactionState, elapsed: number, render: () => void) {
  if (state.status === 'ready' && state.goAt !== null && elapsed >= state.goAt) {
    state.status = 'go';
    state.goStartedAt = elapsed;
    render();
  }
}

export function isReactionAutoSuccess(state: ReactionState) {
  return state.attempts.length >= state.targetTrials;
}

export function buildReactionResultStats(state: ReactionState): ResultStats {
  const avg = average(state.attempts) ?? 0;
  const best = state.attempts.length > 0 ? Math.min(...state.attempts) : 0;
  const attemptsWithFalseStarts = state.attempts.length + state.falseStarts;
  return {
    score: Math.max(0, Math.round(1000 - avg * 1.8 - state.falseStarts * 80)),
    accuracy: attemptsWithFalseStarts > 0 ? Math.round((state.attempts.length / attemptsWithFalseStarts) * 100) : 0,
    moves: 0,
    attempts: attemptsWithFalseStarts,
    success: state.attempts.length,
    errors: state.falseStarts,
    details: { attemptsMs: state.attempts, averageMs: avg, bestMs: best },
  };
}

export function drawReaction(app: Application, state: ReactionState, onTap: () => void, t: TFunction) {
  const w = app.renderer.width;
  const h = app.renderer.height;
  const maxSize = getResponsiveBoardMaxSize(app);
  const scale = Math.min(
    isMobileCognitiveViewport(app) ? Number.POSITIVE_INFINITY : 1,
    maxSize.width / 500,
    maxSize.height / 300,
  );
  const boxW = Math.floor(500 * scale);
  const boxH = Math.floor(300 * scale);
  const x = (w - boxW) / 2;
  const y = (h - boxH) / 2;
  const labels = {
    waiting: t('cognitive.reaction.waiting'),
    ready: t('cognitive.reaction.ready'),
    go: t('cognitive.reaction.go'),
    result: state.lastReactionMs === null ? t('cognitive.reaction.complete') : `${state.lastReactionMs} ms`,
    'too-early': t('cognitive.reaction.tooEarly'),
  };
  const node = new Container();
  node.eventMode = 'static';
  node.cursor = 'pointer';
  node.on('pointertap', onTap);
  const g = new Graphics();
  g.rect(x, y, boxW, boxH).fill(REACTION_COLORS[state.status]);
  node.addChild(g);
  addText(node, labels[state.status], w / 2, y + boxH / 2, {
    fontSize: state.status === 'result' && state.lastReactionMs !== null ? 56 : 32,
    fontWeight: '400',
    fill: '#FFFFFF',
  });
  app.stage.addChild(node);
}
