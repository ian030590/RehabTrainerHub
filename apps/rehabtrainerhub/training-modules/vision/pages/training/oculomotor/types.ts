// Types local to the Hub-owned oculomotor module.
export type OculomotorMode =
  | 'pursuit'
  | 'reaction-jumps'
  | 'multi-object'
  | 'lilac-chaser';

export type OculomotorPattern =
  | 'randomWalk'
  | 'circle'
  | 'ellipse'
  | 'oval'
  | 'figureEight'
  | 'wave'
  | 'horizontalSweep'
  | 'verticalSweep'
  | 'downRightSweep'
  | 'downLeftSweep'
  | 'bounce'
  | 'diagonal'
  | 'directionChange'
  | 'teleport'
  | 'perimeterLoop'
  | 'diamondLoop'
  | 'clover'
  | 'stairStep'
  | 'lissajous'
  | 'hourglass'
  | 'cornerTour'
  | 'multipleObjectTracking'
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
  | 'ring'
  | 'star'
  | 'square'
  | 'diamond'
  | 'cross'
  | 'triangle'
  | 'custom';

export type OculomotorSpeedUnit = 'deg/s' | 'cm/s' | 'screen/s';

export type OculomotorBehavior =
  | 'constant'
  | 'wavePattern'
  | 'surgePattern'
  | 'alternatingPattern'
  | 'climbPattern'
  | 'sizePulse';

export type OculomotorLetterWeight = 400 | 500 | 600 | 700 | 800;

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
