import { Motion, Severity, type ModelFor } from './physics.js';
import type { Row } from './score.js';

export function DrivingFrame(model: ReturnType<typeof ModelFor>, gap: number, sinceStart: number,
  cueAt: number | undefined, elapsed: number, delay: number, end: number) {
  if (cueAt === undefined) return { distance: model.speed * sinceStart / 1000, speed: model.speed, pitch: 0, motion: undefined };
  const time = Math.min(elapsed, end);
  const motion = Motion(model, gap, delay, time);
  const brakingTime = time - delay;
  const pitch = brakingTime > 0 && motion.ownSpeed > 0
    ? Math.min(1, brakingTime / .18, (motion.ownSpeed / model.own) / .25) : 0;
  return { distance: model.speed * cueAt / 1000 + motion.ownDistance, speed: motion.ownSpeed, pitch, motion };
}

export function IsBrakeKey(event: Pick<KeyboardEvent, 'code' | 'repeat' | 'altKey' | 'ctrlKey' | 'metaKey'>) {
  return event.code === 'Space' && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey;
}

export function FeedbackVerdict(feedback: Row | 'early') {
  if (feedback === 'early') return 'earlyPress';
  const { rel, remaining } = feedback.outcome;
  if (rel === null) return remaining < 3 ? 'closeCall' : 'stopped';
  const grade = Severity(rel);
  return grade === 'light' ? 'lightContact' : grade;
}

export function DistanceBars(gap: number, beforeBraking: number) {
  const scale = Math.max(1, gap, beforeBraking);
  return [gap / scale, beforeBraking / scale] as const;
}
