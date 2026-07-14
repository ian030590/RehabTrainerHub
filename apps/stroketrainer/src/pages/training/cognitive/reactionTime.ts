import { Application, Container, Graphics } from 'pixi.js';
import { REACTION_CONFIG } from './constants';
import type { TFunction } from '../types';
import type { Difficulty, GameResult, ReactionState, ResultStats } from './types';
import {
  COGNITIVE_ACCENT,
  COGNITIVE_ACCENT_TINT,
  COGNITIVE_BORDER,
  COGNITIVE_SURFACE,
  COGNITIVE_TEXT,
  COGNITIVE_TEXT_MUTED,
  addText,
  average,
} from './utils';

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
  const boxW = Math.min(w - 48, 720);
  const boxH = Math.min(h - 150, 420);
  const x = (w - boxW) / 2;
  const y = (h - boxH) / 2 + 24;
  const colors = {
    waiting: COGNITIVE_SURFACE,
    ready: COGNITIVE_ACCENT_TINT,
    go: COGNITIVE_ACCENT,
    result: COGNITIVE_ACCENT_TINT,
    'too-early': COGNITIVE_ACCENT_TINT,
  };
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
  g.roundRect(x, y, boxW, boxH, 8).fill(colors[state.status]).stroke({ color: state.status === 'go' ? COGNITIVE_ACCENT : COGNITIVE_BORDER, width: 2 });
  node.addChild(g);
  addText(node, labels[state.status], w / 2, y + boxH / 2 - 20, {
    fontSize: 52,
    fontWeight: '900',
    fill: state.status === 'go' ? '#FFFFFF' : `#${COGNITIVE_TEXT.toString(16).padStart(6, '0')}`,
  });
  const avg = average(state.attempts);
  addText(node, `${state.attempts.length}/${state.targetTrials}${avg === null ? '' : `  ${t('cognitive.reaction.average')} ${avg} ms`}`, w / 2, y + boxH / 2 + 58, {
    fontSize: 22,
    fontWeight: '700',
    fill: state.status === 'go' ? '#FFFFFF' : `#${COGNITIVE_TEXT_MUTED.toString(16).padStart(6, '0')}`,
  });
  app.stage.addChild(node);
}
