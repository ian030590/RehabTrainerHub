export type OculomotorMode =
  | 'pursuit'
  | 'reaction-jumps'
  | 'multi-object'
  | 'lilac-chaser';

export type OculomotorPattern =
  | 'randomWalk'
  | 'circle'
  | 'oval'
  | 'figureEight'
  | 'horizontalSweep'
  | 'verticalSweep'
  | 'bounce'
  | 'diagonal'
  | 'spiralBloom'
  | 'zigZag'
  | 'triangle'
  | 'square'
  | 'rectangle'
  | 'parallelogram'
  | 'rhombus'
  | 'trapezoid'
  | 'kite'
  | 'pentagon'
  | 'hexagon'
  | 'heptagon'
  | 'octagon'
  | 'nonagon'
  | 'decagon'
  | 'hexagram'
  | 'decagram'
  | 'superellipse'
  | 'deltoid'
  | 'randomizedSmooth'
  | 'peekaboo';

export type OculomotorTargetShape =
  | 'circle'
  | 'star'
  | 'square'
  | 'cross'
  | 'triangle'
  | 'custom';

export interface Arena {
  width: number;
  height: number;
}

export interface TargetFrame {
  x: number;
  y: number;
  radiusPx: number;
  color: number;
  alpha: number;
  role: 'target' | 'distractor';
}

export interface PatternParams {
  radiusPx: number;
  speedPxPerSec: number;
  travelPx: number;
  targetCount: number;
  distractorCount: number;
  colorA: number;
  colorB: number;
  opacity?: number;
  jitter?: number;
}
