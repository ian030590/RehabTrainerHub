export type ReferenceMode = 'vor' | 'pursuit' | 'saccade' | 'fixation';
export type ReferenceRunMode = 'evaluation' | 'predictable' | 'random';
export type ReferencePhase = 'cross' | 'movement' | 'dwell' | 'hold' | 'vor';

export interface ReferenceFrame {
  x: number;
  y: number;
  phase: ReferencePhase;
  direction: number | null;
  targetIndex: number;
  completedTargets: number;
  phaseStartMs: number;
}

interface Segment extends ReferenceFrame {
  startMs: number;
  endMs: number;
  fromX: number;
  fromY: number;
}

export interface ReferenceDrillSettings {
  mode: ReferenceMode;
  runMode: ReferenceRunMode;
  width: number;
  height: number;
  radiusPx: number;
  speedArcminSec: number;
  viewingDistanceCm: number;
  pxPerCmX: number;
  pxPerCmY: number;
  durationMs: number;
  dwellMs: number;
  holdMs: number;
  changeMs: number;
  directions: readonly number[];
  reverseOrder?: boolean;
  random?: () => number;
  movementProgress?: (elapsedMs: number, totalMs: number) => number;
}

const compass = [
  [0, -1], [1, -1], [1, 0], [1, 1],
  [0, 1], [-1, 1], [-1, 0], [-1, -1],
] as const;
const edgeSequence = [1, 7, 3, 5, 0, 4, 6, 2] as const;
const saccadeSequence = [
  1, 7, 1, 7, 3, 5, 3, 5, 2, 6, 2, 6,
  0, 4, 0, 4, 1, 3, 1, 3, 7, 5, 7, 5,
] as const;

export function BuildReferenceDrill(settings: ReferenceDrillSettings) {
  const center = { x: settings.width / 2, y: settings.height / 2 };
  const directions = settings.directions.filter((axis) => Number.isInteger(axis) && axis >= 0 && axis < 8);
  if (!directions.length && settings.mode !== 'vor') throw new Error('Select at least one target direction.');
  const enabled = new Set(directions);
  const sourceSequence = settings.mode === 'saccade' ? saccadeSequence : edgeSequence;
  const filteredSequence = sourceSequence.filter((axis) => enabled.has(axis));
  const orderedDirections = (settings.mode === 'saccade' && filteredSequence.length < 2
    ? directions : filteredSequence) as number[];
  if (settings.reverseOrder) orderedDirections.reverse();
  const segments: Segment[] = [];
  const completionTimes: number[] = [];
  const random = settings.random ?? Math.random;
  const edge = (axis: number) => ({
    x: center.x + compass[axis][0] * Math.max(0, settings.width / 2 - settings.radiusPx - 32),
    y: center.y + compass[axis][1] * Math.max(0, settings.height / 2 - settings.radiusPx - 32),
  });
  let elapsed = 0;
  let completed = 0;
  let previousAxis = -1;
  const maxDuration = Math.max(1_000, settings.durationMs);
  const evaluationTotal = settings.mode === 'saccade' ? 24 : orderedDirections.length * 2;
  const add = (phase: ReferencePhase, duration: number, point: { x: number; y: number }, from: { x: number; y: number }, direction: number | null) => {
    const endMs = elapsed + Math.max(1, duration);
    segments.push({ startMs: elapsed, endMs, phaseStartMs: elapsed, x: point.x, y: point.y, fromX: from.x, fromY: from.y,
      phase, direction, targetIndex: completed, completedTargets: completed });
    elapsed = endMs;
  };
  const nextAxis = () => {
    if (settings.runMode !== 'random' || directions.length === 1) {
      return orderedDirections[completed % orderedDirections.length];
    }
    const choices = directions.filter((axis) => axis !== previousAxis);
    return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
  };

  if (settings.mode === 'vor') {
    add('vor', maxDuration, center, center, null);
  } else {
    if (settings.mode === 'saccade') add('cross', 1_000, center, center, null);
    while (settings.runMode === 'evaluation' ? completed < evaluationTotal : elapsed < maxDuration) {
      const axis = nextAxis();
      const point = edge(axis);
      if (settings.mode === 'saccade') {
        add('dwell', settings.dwellMs, point, point, axis);
      } else {
        add('cross', 1_000, center, center, axis);
        const distanceCm = Math.hypot((point.x - center.x) / settings.pxPerCmX,
          (point.y - center.y) / settings.pxPerCmY);
        const cmPerArcmin = settings.viewingDistanceCm * Math.tan(Math.PI / 10800);
        add('movement', distanceCm / Math.max(0.01, settings.speedArcminSec * cmPerArcmin) * 1_000,
          point, center, axis);
        if (settings.mode === 'fixation') add('hold', settings.holdMs, point, point, axis);
      }
      completed += 1;
      completionTimes.push(elapsed);
      previousAxis = axis;
    }
  }
  const endMs = settings.runMode === 'evaluation' && settings.mode !== 'vor' ? elapsed : maxDuration;
  return {
    endMs,
    completedAt(timeMs: number): number {
      if (settings.mode === 'vor') return Math.floor(Math.min(timeMs, endMs) / Math.max(200, settings.changeMs)) + 1;
      return completionTimes.filter((completionTime) => completionTime <= Math.min(timeMs, endMs)).length;
    },
    frameAt(timeMs: number): ReferenceFrame {
      const time = Math.max(0, Math.min(timeMs, endMs - 0.001));
      let low = 0;
      let high = segments.length - 1;
      while (low < high) {
        const middle = (low + high) >> 1;
        if (segments[middle].endMs <= time) low = middle + 1;
        else high = middle;
      }
      const segment = segments[low];
      if (settings.mode === 'vor') {
        return { x: center.x, y: center.y, phase: 'vor', direction: null,
          targetIndex: Math.floor(time / Math.max(200, settings.changeMs)),
          completedTargets: Math.floor(time / Math.max(200, settings.changeMs)) + 1,
          phaseStartMs: Math.floor(time / Math.max(200, settings.changeMs)) * Math.max(200, settings.changeMs) };
      }
      const phaseElapsedMs = time - segment.startMs;
      const phaseDurationMs = segment.endMs - segment.startMs;
      const progress = segment.phase === 'movement'
        ? Math.min(1, Math.max(0, settings.movementProgress?.(phaseElapsedMs, phaseDurationMs)
          ?? phaseElapsedMs / phaseDurationMs)) : 1;
      return {
        x: segment.fromX + (segment.x - segment.fromX) * progress,
        y: segment.fromY + (segment.y - segment.fromY) * progress,
        phase: segment.phase,
        direction: segment.direction,
        targetIndex: segment.targetIndex,
        completedTargets: segment.completedTargets + (time >= segment.endMs ? 1 : 0),
        phaseStartMs: segment.phaseStartMs,
      };
    },
  };
}
