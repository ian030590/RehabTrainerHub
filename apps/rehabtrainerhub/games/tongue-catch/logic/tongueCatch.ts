import type { PlayConfig } from '../settings';

export type TongueLabel = 'Rest' | 'Tongue_Left' | 'Tongue_Right';
export interface Recognition { label: TongueLabel; confidence: number; faceVisible: boolean }
export interface TongueFrame {
  timestamp: number; videoWidth: number; videoHeight: number; face: boolean; mouth: { x: number; y: number } | null;
  label: TongueLabel | null; confidence: number; samples: Record<TongueLabel, number>;
}
export interface Apple {
  id: number; resultIndex: number; normalizedX: number; size: number; x: number; y: number; rotation: number;
  fallElapsed: number; swayAmplitude: number; swayPhase: number; swaySpeed: number;
}
export interface AppleResult { horizontalPositionPercent: number; caught: boolean }

// Values from the original Pixi game.
export const tonguePlay = {
  maxFrameSeconds: 0.05, mouthFollowRate: 9, retractFactor: 1.7, tongueSegments: 10, tongueWidth: 28,
  catchMinLength: 20, visibleMinLength: 2, minHoldSeconds: 0.12, startY: 0.66,
} as const;
export const appleSpawn = {
  size: [95, 120], edgeLeft: [0.1, 0.28], edgeRight: [0.72, 0.9], center: [0.27, 0.73],
  swayAmplitude: [5, 9], swaySpeed: [1.7, 2.3], swayRotation: 0.09,
} as const;

const Clamp = (value: number, minimum: number, maximum: number) => Math.min(Math.max(value, minimum), maximum);
const Between = (random: () => number, [minimum, maximum]: readonly [number, number]) => minimum + random() * (maximum - minimum);

export function CreateTongueSession(width: number, height: number) {
  const mouthX = width / 2;
  const mouthY = height * tonguePlay.startY;
  return {
    elapsed: 0, score: 0, missed: 0, appleResults: [] as AppleResult[],
    holdStartedAt: null as number | null, holdDirection: null as TongueLabel | null, holdDurations: [] as number[],
    apples: [] as Apple[], nextAppleId: 1, spawnElapsed: 0,
    mouthX, mouthY, tongueLength: 0, tongueDirection: 0 as -1 | 0 | 1, tongueVisible: false,
    points: Array.from({ length: tonguePlay.tongueSegments }, () => ({ x: mouthX, y: mouthY })),
  };
}
export type TongueSession = ReturnType<typeof CreateTongueSession>;

function CloseActiveHold(session: TongueSession, now: number) {
  if (session.holdStartedAt !== null) {
    const duration = Math.max(0, (now - session.holdStartedAt) / 1000);
    if (duration >= tonguePlay.minHoldSeconds) session.holdDurations.push(duration);
  }
  session.holdStartedAt = null;
  session.holdDirection = null;
}

function DistanceToSegmentSquared(x: number, y: number, startX: number, startY: number, endX: number, endY: number) {
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  const projection = lengthSquared === 0 ? 0 : Clamp(((x - startX) * segmentX + (y - startY) * segmentY) / lengthSquared, 0, 1);
  const dx = x - (startX + segmentX * projection);
  const dy = y - (startY + segmentY * projection);
  return dx * dx + dy * dy;
}

function TongueTouches(session: TongueSession, apple: Apple) {
  const radius = apple.size / 2 + tonguePlay.tongueWidth / 2;
  for (let index = 1; index < session.points.length; index++) {
    const [start, end] = [session.points[index - 1], session.points[index]];
    if (DistanceToSegmentSquared(apple.x, apple.y, start.x, start.y, end.x, end.y) <= radius * radius) return true;
  }
  return false;
}

// The random draws keep the original order: edge or not, side, position, size, then sway amplitude, phase and speed.
function SpawnApple(session: TongueSession, edgeChance: number, random: () => number) {
  const useEdge = random() < edgeChance;
  const side = random() < 0.5 ? -1 : 1;
  const normalizedX = Between(random, useEdge ? side < 0 ? appleSpawn.edgeLeft : appleSpawn.edgeRight : appleSpawn.center);
  const size = Between(random, appleSpawn.size);
  const apple: Apple = {
    id: session.nextAppleId++, resultIndex: session.appleResults.length, normalizedX, size, x: 0, y: -size, rotation: 0, fallElapsed: 0,
    swayAmplitude: Between(random, appleSpawn.swayAmplitude), swayPhase: Between(random, [0, Math.PI * 2]), swaySpeed: Between(random, appleSpawn.swaySpeed),
  };
  session.apples.push(apple);
  session.appleResults.push({ horizontalPositionPercent: Number((normalizedX * 200 - 100).toFixed(1)), caught: false });
  return apple.id;
}

// One frame of play, as the original ticker ran it. mouth is already in stage pixels, or null when no face was found.
export function StepTongueSession(session: TongueSession, input: {
  dtMs: number; now: number; width: number; height: number; mouth: { x: number; y: number } | null; recognition: Recognition; random: () => number;
}, config: PlayConfig) {
  const events = { spawned: [] as number[], caught: [] as number[], missed: [] as number[] };
  const { width, height, recognition } = input;
  const dt = Math.min(input.dtMs / 1000, tonguePlay.maxFrameSeconds);
  session.elapsed += dt;
  if (input.mouth) {
    const follow = Math.min(1, dt * tonguePlay.mouthFollowRate);
    session.mouthX += (input.mouth.x - session.mouthX) * follow;
    session.mouthY += (input.mouth.y - session.mouthY) * follow;
  }
  const direction = recognition.faceVisible && recognition.confidence >= config.sensitivity
    ? recognition.label === 'Tongue_Left' ? -1 : recognition.label === 'Tongue_Right' ? 1 : 0 : 0;
  if (direction === 0) {
    session.tongueLength = Math.max(0, session.tongueLength - config.growthRate * tonguePlay.retractFactor * dt);
    CloseActiveHold(session, input.now);
  } else {
    if (session.holdDirection !== recognition.label) {
      CloseActiveHold(session, input.now);
      session.holdStartedAt = input.now;
      session.holdDirection = recognition.label;
    }
    if (session.tongueDirection !== 0 && session.tongueDirection !== direction) session.tongueLength = 0;
    session.tongueDirection = direction;
    const maxLength = direction < 0 ? Math.max(0, session.mouthX) : Math.max(0, width - session.mouthX);
    session.tongueLength = Math.min(maxLength, session.tongueLength + config.growthRate * dt);
  }
  if (session.tongueLength <= 1) session.tongueDirection = direction;
  const side = session.tongueDirection || 1;
  session.points.forEach((point, index) => {
    point.x = session.mouthX + side * session.tongueLength * index / (session.points.length - 1);
    point.y = session.mouthY;
  });
  session.tongueVisible = session.tongueLength > tonguePlay.visibleMinLength;

  session.spawnElapsed += dt;
  if (session.spawnElapsed >= config.spawnIntervalSec) {
    session.spawnElapsed = 0;
    events.spawned.push(SpawnApple(session, config.edgeChance, input.random));
  }
  for (let index = session.apples.length - 1; index >= 0; index--) {
    const apple = session.apples[index];
    apple.fallElapsed += dt;
    apple.y += config.appleSpeed * dt;
    const sway = Math.sin(apple.swayPhase + apple.fallElapsed * apple.swaySpeed);
    const half = apple.size / 2;
    apple.x = Clamp(width * apple.normalizedX + sway * apple.swayAmplitude, half, width - half);
    apple.rotation = sway * appleSpawn.swayRotation;
    if (session.tongueLength > tonguePlay.catchMinLength && TongueTouches(session, apple)) {
      session.appleResults[apple.resultIndex].caught = true;
      session.apples.splice(index, 1);
      session.score++;
      events.caught.push(apple.id);
    } else if (apple.y - half > height) {
      session.apples.splice(index, 1);
      session.missed++;
      events.missed.push(apple.id);
    }
  }
  return events;
}

// Closes a hold still running at the end, as the original game did when time ran out.
export function SummarizeTongueSession(session: TongueSession, now: number) {
  CloseActiveHold(session, now);
  const holds = session.holdDurations;
  return {
    durationSeconds: Number(session.elapsed.toFixed(1)), score: session.score, missed: session.missed,
    averageHoldSeconds: Number((holds.length ? holds.reduce((total, value) => total + value, 0) / holds.length : 0).toFixed(2)),
    apples: session.appleResults.map(apple => ({ ...apple })),
  };
}
export type SessionSummary = ReturnType<typeof SummarizeTongueSession>;

// The container shows the camera mirrored and cover-fitted to the frame, so the mouth is placed the same way.
export function MapVideoPointToStage(x: number, y: number, videoWidth: number, videoHeight: number, stageWidth: number, stageHeight: number) {
  const scale = Math.max(stageWidth / videoWidth, stageHeight / videoHeight);
  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;
  return { x: (stageWidth - renderedWidth) / 2 + (1 - x) * renderedWidth, y: (stageHeight - renderedHeight) / 2 + y * renderedHeight };
}

// A guess below the sensitivity counts as rest, as in the original game.
export function RecognitionFromFrame(frame: TongueFrame, sensitivity: number): Recognition {
  if (!frame.face) return { label: 'Rest', confidence: 0, faceVisible: false };
  if (!frame.label) return { label: 'Rest', confidence: frame.confidence, faceVisible: true };
  return { label: frame.confidence >= sensitivity ? frame.label : 'Rest', confidence: frame.confidence, faceVisible: true };
}
