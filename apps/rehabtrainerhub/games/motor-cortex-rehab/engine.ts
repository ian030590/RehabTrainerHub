import { Clamp } from './gameUtils';
import type { DrillId, HandChoice, DifficultyDefinition, TargetState, HandState, SessionMetrics, DrillEventRecord } from './types';
import type { copy } from './labels';
const trackingGraceMs = 240;
const handCursorRadius = 18;
export function CreateEmptyMetrics(): SessionMetrics {
  return {
    startedAt: 0,
    lastTickAt: 0,
    handVisibleMs: 0,
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
    return { x: radius + 24, y: center.y, vx: speed, vy: 0, radius, level: 1, holdTargetMs: difficulty.holdMs };
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
export function UpdateTrainingLoop({ now, rect, drill, activeDifficulty, durationSec, targetSizeScale, speedScale, target, hand, metrics, labels, onSuccess, onComplete, }: {
  now: number;
  rect: DOMRect;
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
  MoveTarget(drill, target, rect.width, rect.height, deltaMs);
  const handVisible = hand.visible && now - hand.lastSeenAt <= trackingGraceMs;
  if (handVisible)
    metrics.handVisibleMs += deltaMs;
  const insideTarget = handVisible && Distance2d(hand, target) <= target.radius + handCursorRadius;
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
export function MoveTarget(drill: DrillId, target: TargetState, width: number, height: number, deltaMs: number) {
  const deltaSec = deltaMs / 1000;
  const padding = target.radius + 24;
  if (drill === 'random')
    return;
  target.x += target.vx * deltaSec;
  target.y += target.vy * deltaSec;
  if (drill === 'vertical') {
    target.x = width / 2 + Math.sin(performance.now() * 0.0012) * width * 0.08;
  }
  else if (drill === 'horizontal') {
    target.y = height / 2 + Math.sin(performance.now() * 0.0012) * height * 0.08;
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
  target.holdTargetMs = Clamp(difficulty.holdMs + (target.level - 1) * 40, 420, 1400);
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
export function BuildLiveState(now: number, durationSec: number, rect: DOMRect, target: TargetState, hand: HandState, metrics: SessionMetrics) {
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
