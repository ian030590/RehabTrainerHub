import { Application, Container, Graphics } from 'pixi.js';
import { reactionConfig } from './constants';
import type { TFunction } from '../types';
import type { Difficulty, GameResult, ReactionState, ResultStats } from './types';
import {
  AddText,
  Average,
  GetResponsiveBoardMaxSize,
  GetPointerEventTimestamp,
  IsMobileCognitiveViewport,
} from './utils';

const reactionColors: Record<ReactionState['status'], number> = {
  waiting: 0x3498db,
  ready: 0xe74c3c,
  go: 0x2ecc71,
  result: 0x3498db,
  'too-early': 0xe67e22,
};

export function CreateReactionState(targetTrials: number): ReactionState {
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

export function HandleReactionStateTap(
  state: ReactionState,
  tapMs: number,
  difficulty: Difficulty,
  finishGame: (result: GameResult) => void,
  scheduleGo: (delayMs: number, goAtMs: number) => void,
) {
  if (state.status === 'waiting' || state.status === 'result' || state.status === 'too-early') {
    const cfg = reactionConfig[difficulty];
    const delayMs = (cfg.minDelay + Math.random() * (cfg.maxDelay - cfg.minDelay)) * 1000;
    const goAtMs = performance.now() + delayMs;
    state.status = 'ready';
    state.goAt = goAtMs;
    state.goStartedAt = null;
    state.lastReactionMs = null;
    scheduleGo(delayMs, goAtMs);
    return;
  }
  if (state.status === 'ready') {
    state.falseStarts += 1;
    state.status = 'too-early';
    state.goAt = null;
    return;
  }
  if (state.status === 'go' && state.goStartedAt !== null) {
    const reactionMs = Math.max(0, Math.round(tapMs - state.goStartedAt));
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

export function ShowReactionGo(state: ReactionState, onsetMs: number) {
  if (state.status !== 'ready') return false;
  state.status = 'go';
  state.goAt = null;
  state.goStartedAt = onsetMs;
  return true;
}

export function UpdateReactionTimedState(state: ReactionState, elapsed: number, render: () => void) {
  void state;
  void elapsed;
  void render;
}

export function IsReactionAutoSuccess(state: ReactionState) {
  return state.attempts.length >= state.targetTrials;
}

export function BuildReactionResultStats(state: ReactionState): ResultStats {
  const avg = Average(state.attempts) ?? 0;
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

export function DrawReaction(app: Application, state: ReactionState, onTap: (tapMs: number) => void, t: TFunction) {
  const w = app.renderer.width;
  const h = app.renderer.height;
  const maxSize = GetResponsiveBoardMaxSize(app);
  const scale = Math.min(
    IsMobileCognitiveViewport(app) ? Number.POSITIVE_INFINITY : 1,
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
  node.on('pointertap', (event) => onTap(GetPointerEventTimestamp(event)));
  const g = new Graphics();
  g.rect(x, y, boxW, boxH).fill(reactionColors[state.status]);
  node.addChild(g);
  AddText(node, labels[state.status], w / 2, y + boxH / 2, {
    fontSize: state.status === 'result' && state.lastReactionMs !== null ? 56 : 32,
    fontWeight: '400',
    fill: '#FFFFFF',
  });
  app.stage.addChild(node);
}
