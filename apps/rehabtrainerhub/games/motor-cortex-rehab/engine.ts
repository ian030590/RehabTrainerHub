import { Clamp } from './gameUtils';
import type { DrillId, HandChoice, DifficultyDefinition, TargetState, HandState, SessionMetrics, DrillEventRecord, LaserEncounter } from './types';
import type { copy } from './labels';
const trackingGraceMs = 240;
const handCursorRadius = 18;
export function CreateEmptyMetrics(): SessionMetrics {
  return {
    startedAt: 0,
    lastTickAt: 0,
    handVisibleMs: 0,
    raisedMs: 0,
    inTargetMs: 0,
    successes: 0,
    misses: 0,
    currentHoldMs: 0,
    bestHoldMs: 0,
    streak: 0,
    events: [],
  };
}
export function CreateInitialTarget(drill: DrillId, difficulty: DifficultyDefinition, targetSizeScale: number, speedScale: number, width: number, height: number): TargetState {
  const radius = difficulty.radius * targetSizeScale;
  const speed = difficulty.speed * speedScale;
  const center = { x: width / 2, y: height / 2 };
  if (drill === 'vertical') {
    return { x: center.x, y: radius + 24, vx: 0, vy: speed, radius, level: 1, holdTargetMs: difficulty.holdMs };
  }
  if (drill === 'horizontal') {
    return { x: radius + 24, y: center.y, laneY: center.y, vx: speed, vy: 0, radius, level: 1, holdTargetMs: difficulty.holdMs };
  }
  if (drill === 'random') {
    return {
      ...PlaceRandomTarget({ x: center.x, y: center.y, vx: 0, vy: 0, radius, level: 1, holdTargetMs: difficulty.holdMs }, width, height),
      holdTargetMs: difficulty.holdMs + 240,
    };
  }
  return {
    x: width * 0.28,
    y: height * 0.34,
    vx: speed,
    vy: speed * 0.78,
    radius,
    level: 1,
    holdTargetMs: difficulty.holdMs,
  };
}
export function UpdateTrainingLoop({ now, rect, drill, activeDifficulty, durationSec, targetSizeScale, speedScale, target, hand, metrics, labels, onSuccess, onComplete, canScore = true, handRaised = false, moveTarget = true, }: {
  now: number;
  rect: Pick<DOMRect, 'width' | 'height'>;
  drill: DrillId;
  activeDifficulty: DifficultyDefinition;
  durationSec: number;
  targetSizeScale: number;
  speedScale: number;
  target: TargetState;
  hand: HandState;
  metrics: SessionMetrics;
  labels: (typeof copy)['zh'] | (typeof copy)['en'];
  onSuccess: () => void;
  onComplete: (completedAt: number) => void;
  canScore?: boolean;
  handRaised?: boolean;
  moveTarget?: boolean;
}) {
  if (!metrics.startedAt) {
    metrics.startedAt = now;
    metrics.lastTickAt = now;
  }
  const elapsedMs = now - metrics.startedAt;
  if (elapsedMs >= durationSec * 1000) {
    onComplete(now);
    return;
  }
  const deltaMs = Math.min(90, Math.max(0, now - metrics.lastTickAt));
  metrics.lastTickAt = now;
  if (moveTarget) MoveTarget(drill, target, rect.width, rect.height, deltaMs, now);
  const handVisible = hand.visible && now - hand.lastSeenAt <= trackingGraceMs;
  if (handVisible)
    metrics.handVisibleMs += deltaMs;
  if (handVisible && handRaised) metrics.raisedMs += deltaMs;
  const insideTarget = handVisible && canScore && Distance2d(hand, target) <= target.radius + handCursorRadius;
  if (insideTarget) {
    metrics.inTargetMs += deltaMs;
    metrics.currentHoldMs += deltaMs;
    metrics.bestHoldMs = Math.max(metrics.bestHoldMs, metrics.currentHoldMs);
  }
  else if (metrics.currentHoldMs > 180) {
    metrics.misses += 1;
    metrics.streak = 0;
    metrics.events.push(ToEventRecord({
      metrics,
      drillName: labels.drillNames[drill],
      result: 'interrupted',
      target,
      elapsedMs,
    }));
    metrics.currentHoldMs = 0;
  }
  else {
    metrics.currentHoldMs = 0;
  }
  if (metrics.currentHoldMs >= target.holdTargetMs) {
    metrics.successes += 1;
    metrics.streak += 1;
    metrics.events.push(ToEventRecord({
      metrics,
      drillName: labels.drillNames[drill],
      result: 'success',
      target,
      elapsedMs,
    }));
    metrics.currentHoldMs = 0;
    onSuccess();
    AdaptTarget(target, activeDifficulty, targetSizeScale, speedScale, metrics);
    if (drill === 'random') {
      PlaceRandomTarget(target, rect.width, rect.height);
    }
  }
}
export function CreateLaserEncounter(): LaserEncounter {
  return { number: 1, spawnedAt: 0, baseRadius: 0, defeatedUntil: 0, destinationX: null, destinationY: null,
    arrived: false, moving: true, facingLeft: false, interruptedUntil: 0 };
}

function FitEnemy(target: TargetState, arena: Pick<DOMRect, 'width' | 'height'>) {
  const margin = Math.min(24, arena.width / 12, arena.height / 12);
  target.radius = Math.min(target.radius, Math.max(1, Math.min(arena.width, arena.height) / 2 - margin));
  const padding = target.radius + margin;
  target.x = Clamp(target.x, padding, arena.width - padding);
  target.y = Clamp(target.y, padding, arena.height - padding);
}

export function UpdateLaserEncounter(args: Parameters<typeof UpdateTrainingLoop>[0] & { enemy: LaserEncounter; raiseLinePercent?: number }) {
  const { now, rect, target, hand, metrics, enemy } = args;
  if (metrics.startedAt && now - metrics.startedAt >= args.durationSec * 1000) {
    args.onComplete(now);
    return;
  }
  const arena = { width: rect.width, height: rect.height * (args.raiseLinePercent ?? 65) / 100 };
  const handRaised = hand.y <= arena.height;
  if (enemy.defeatedUntil > now) {
    FitEnemy(target, arena);
    const deltaMs = Math.min(90, Math.max(0, now - metrics.lastTickAt));
    metrics.lastTickAt = now;
    if (hand.visible && now - hand.lastSeenAt <= trackingGraceMs) {
      metrics.handVisibleMs += deltaMs;
      if (handRaised) metrics.raisedMs += deltaMs;
    }
    enemy.moving = false;
    return;
  }
  if (enemy.defeatedUntil) {
    const next = CreateInitialTarget(args.drill, args.activeDifficulty, args.targetSizeScale, args.speedScale, arena.width, arena.height);
    next.level = target.level;
    next.holdTargetMs = target.holdTargetMs;
    next.radius = enemy.baseRadius;
    next.vx = Math.sign(next.vx) * Math.abs(target.vx);
    next.vy = Math.sign(next.vy) * Math.abs(target.vy);
    Object.assign(target, next);
    enemy.number++;
    enemy.defeatedUntil = 0;
    enemy.spawnedAt = now;
    enemy.arrived = false;
    enemy.destinationX = null;
    enemy.destinationY = null;
    const deltaMs = Math.min(90, Math.max(0, now - metrics.lastTickAt));
    if (hand.visible && now - hand.lastSeenAt <= trackingGraceMs) {
      metrics.handVisibleMs += deltaMs;
      if (handRaised) metrics.raisedMs += deltaMs;
    }
    metrics.lastTickAt = now;
  }
  if (!enemy.spawnedAt) enemy.spawnedAt = now;
  if (!enemy.baseRadius) enemy.baseRadius = target.radius;
  const approach = Clamp((now - enemy.spawnedAt) / (4200 / args.speedScale), 0, 1);
  if (!enemy.arrived && (enemy.destinationX === null || enemy.destinationY === null)) {
    target.radius = enemy.baseRadius;
    FitEnemy(target, arena);
    const horizon = rect.height * .15;
    target.y = Clamp(Math.max(target.y, horizon + (arena.height - horizon) * .55), target.radius, arena.height - target.radius - 4);
    const roadHalfWidth = rect.width * .48 * Clamp((target.y + target.radius - horizon) / (arena.height - horizon), 0, 1);
    target.x = Clamp(target.x, Math.min(rect.width / 2, rect.width / 2 - roadHalfWidth + target.radius), Math.max(rect.width / 2, rect.width / 2 + roadHalfWidth - target.radius));
    enemy.destinationX = target.x / rect.width;
    enemy.destinationY = target.y / arena.height;
  }
  const wasApproaching = !enemy.arrived;
  if (wasApproaching) {
    target.radius = enemy.baseRadius * (.18 + .82 * approach);
    target.x = rect.width / 2 + ((enemy.destinationX ?? .5) * rect.width - rect.width / 2) * approach;
    target.y = rect.height * .15 + ((enemy.destinationY ?? .5) * arena.height - rect.height * .15) * approach;
    enemy.facingLeft = (enemy.destinationX ?? .5) < .5;
    if (approach === 1) enemy.arrived = true;
  }
  FitEnemy(target, arena);
  if (wasApproaching && enemy.arrived && args.drill === 'horizontal') target.laneY = target.y;
  enemy.moving = !enemy.arrived || args.drill !== 'random';
  if (!wasApproaching && target.vx) enemy.facingLeft = target.vx < 0;
  const continuousFrame = !metrics.lastTickAt || now - metrics.lastTickAt <= trackingGraceMs;
  const previousMisses = metrics.misses;
  let defeatedPosition: Pick<TargetState, 'x' | 'y' | 'radius'> | null = null;
  UpdateTrainingLoop({ ...args, rect: arena, canScore: handRaised && continuousFrame, handRaised, moveTarget: !wasApproaching,
    onSuccess: () => {
      defeatedPosition = { x: target.x, y: target.y, radius: target.radius };
      enemy.defeatedUntil = now + 400;
      enemy.interruptedUntil = 0;
      args.onSuccess();
    } });
  if (metrics.misses > previousMisses) enemy.interruptedUntil = now + 900;
  FitEnemy(target, arena);
  if (defeatedPosition) {
    enemy.baseRadius = target.radius;
    Object.assign(target, defeatedPosition);
  }
}
export function MoveTarget(drill: DrillId, target: TargetState, width: number, height: number, deltaMs: number, now = performance.now()) {
  const deltaSec = deltaMs / 1000;
  const padding = target.radius + Math.min(24, width / 12, height / 12);
  if (drill === 'random')
    return;
  if (drill === 'horizontal') { target.laneY ??= target.y; target.vy = 0; }
  if (target.x <= padding) target.vx = Math.abs(target.vx);
  if (target.x >= width - padding) target.vx = -Math.abs(target.vx);
  if (target.y <= padding) target.vy = Math.abs(target.vy);
  if (target.y >= height - padding) target.vy = -Math.abs(target.vy);
  target.x += target.vx * deltaSec;
  target.y += target.vy * deltaSec;
  if (drill === 'vertical') {
    target.x = Clamp(width / 2 + Math.sin(now * .0012) * width * .08, padding, width - padding);
  }
  else if (drill === 'horizontal') {
    const laneY = Clamp(target.laneY!, padding, height - padding);
    target.y = Clamp(laneY + Math.sin(now * .0012) * height * .08, padding, height - padding);
  }
  if (target.x < padding || target.x > width - padding) {
    target.x = Clamp(target.x, padding, width - padding);
    target.vx *= -1;
  }
  if (target.y < padding || target.y > height - padding) {
    target.y = Clamp(target.y, padding, height - padding);
    target.vy *= -1;
  }
}
export function AdaptTarget(target: TargetState, difficulty: DifficultyDefinition, targetSizeScale: number, speedScale: number, metrics: SessionMetrics) {
  const accuracy = metrics.handVisibleMs > 0 ? metrics.inTargetMs / metrics.handVisibleMs : 0;
  if (metrics.streak > 0 && metrics.streak % 4 === 0 && accuracy >= 0.58) {
    target.level += 1;
  }
  else if (metrics.misses > 0 && metrics.misses % 5 === 0 && accuracy < 0.28) {
    target.level = Math.max(1, target.level - 1);
  }
  const levelScale = 1 + (target.level - 1) * 0.08;
  const speed = difficulty.speed * speedScale * levelScale;
  const directionX = Math.sign(target.vx || 1);
  const directionY = Math.sign(target.vy || 1);
  target.vx = directionX * speed;
  target.vy = directionY * speed * 0.78;
  target.radius = Clamp(difficulty.radius * targetSizeScale * (1 - (target.level - 1) * 0.035), 38, 110);
  target.holdTargetMs = Clamp(difficulty.holdMs + (target.level - 1) * 40, 420, Math.max(1400, difficulty.holdMs + 400));
}
export function PlaceRandomTarget(target: TargetState, width: number, height: number): TargetState {
  const padding = target.radius + 28;
  target.x = padding + Math.random() * Math.max(1, width - padding * 2);
  target.y = padding + Math.random() * Math.max(1, height - padding * 2);
  return target;
}
export function ToEventRecord({ metrics, drillName, result, target, elapsedMs, }: {
  metrics: SessionMetrics;
  drillName: string;
  result: 'success' | 'interrupted';
  target: TargetState;
  elapsedMs: number;
}): DrillEventRecord {
  const accuracy = metrics.handVisibleMs > 0 ? metrics.inTargetMs / metrics.handVisibleMs : 0;
  return {
    Event_Number: metrics.events.length + 1,
    Drill: drillName,
    Result: result,
    Time_Seconds: Number((elapsedMs / 1000).toFixed(2)),
    Hold_Seconds: Number((metrics.currentHoldMs / 1000).toFixed(2)),
    Accuracy_Percent: ToPercent(accuracy),
    Target_Size_Px: Number((target.radius * 2).toFixed(1)),
    Adaptive_Level: target.level,
  };
}
export function BuildLiveState(now: number, durationSec: number, rect: Pick<DOMRect, 'width' | 'height'>, target: TargetState, hand: HandState, metrics: SessionMetrics) {
  const elapsedMs = metrics.startedAt ? now - metrics.startedAt : 0;
  const accuracy = metrics.handVisibleMs > 0 ? metrics.inTargetMs / metrics.handVisibleMs : 0;
  const visibility = elapsedMs > 0 ? metrics.handVisibleMs / elapsedMs : 0;
  const handVisible = hand.visible && now - hand.lastSeenAt <= trackingGraceMs;
  const insideTarget = handVisible && Distance2d(hand, target) <= target.radius + handCursorRadius;
  return {
    timeRemaining: Math.max(0, durationSec - elapsedMs / 1000),
    accuracy,
    visibility,
    successes: metrics.successes,
    misses: metrics.misses,
    currentHoldPercent: Clamp(metrics.currentHoldMs / target.holdTargetMs, 0, 1),
    level: target.level,
    targetX: (target.x / rect.width) * 100,
    targetY: (target.y / rect.height) * 100,
    targetRadius: target.radius,
    handX: (hand.x / rect.width) * 100,
    handY: (hand.y / rect.height) * 100,
    handVisible,
    insideTarget,
  };
}
export function BuildLaserLiveState(now: number, durationSec: number, rect: Pick<DOMRect, 'width' | 'height'>, target: TargetState, hand: HandState, metrics: SessionMetrics, enemy: LaserEncounter, raiseLinePercent = 65) {
  const live = BuildLiveState(now, durationSec, rect, target, hand, metrics);
  const enemyPhase = enemy.defeatedUntil > now ? 'defeated' as const : 'active' as const;
  const handRaised = live.handVisible && hand.y <= rect.height * raiseLinePercent / 100;
  const laserActive = handRaised && enemyPhase === 'active';
  const arenaHeight = rect.height * raiseLinePercent / 100;
  const padding = target.radius + Math.min(24, rect.width / 12, arenaHeight / 12);
  const laneY = enemy.arrived ? target.laneY ?? target.y : (enemy.destinationY ?? .5) * arenaHeight;
  return { ...live, handRaised, laserActive, enemyPhase, enemyNumber: enemy.number, insideTarget: live.insideTarget && laserActive,
    enemyMoving: enemy.moving && enemyPhase === 'active', enemyFacingLeft: enemy.facingLeft,
    defeatFrame: enemyPhase === 'defeated' ? Math.min(4, Math.floor((now - enemy.defeatedUntil + 400) / 80)) : 0,
    interrupted: enemy.interruptedUntil > now, patrolY: Clamp(laneY, padding, arenaHeight - padding) / rect.height * 100 };
}
export function GetHandCursorPoint(landmarks: {x:number;y:number;z:number}[], width: number, height: number): {
  x: number;
  y: number;
} {
  const points = [landmarks[0], landmarks[5], landmarks[9], landmarks[13], landmarks[17]].filter(Boolean);
  const average = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  return {
    x: (1 - average.x / points.length) * width,
    y: (average.y / points.length) * height,
  };
}
export function Distance2d(left: Pick<HandState, 'x' | 'y'>, right: Pick<TargetState, 'x' | 'y'>): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}
export function ToPercent(value: number): number {
  return Number((Clamp(value, 0, 1) * 100).toFixed(1));
}
export function FormatHandChoice(handChoice: HandChoice, labels: (typeof copy)['zh'] | (typeof copy)['en']): string {
  if (handChoice === 'left')
    return labels.handLeft;
  if (handChoice === 'right')
    return labels.handRight;
  return labels.handAny;
}
