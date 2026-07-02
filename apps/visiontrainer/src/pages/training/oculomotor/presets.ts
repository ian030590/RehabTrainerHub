import type { OculomotorMode, OculomotorPattern } from './types';

export const oculomotorModes: Array<{
  id: OculomotorMode;
  label: string;
  desc: string;
}> = [
  { id: 'pursuit', label: '追視', desc: '平滑追蹤' },
  { id: 'reaction-jumps', label: '跳視', desc: '快速定位' },
  { id: 'multi-object', label: '多目標', desc: '干擾追蹤' },
  { id: 'lilac-chaser', label: '周邊', desc: '中心固視' },
];

export const oculomotorPatterns: Array<{
  id: OculomotorPattern;
  label: string;
}> = [
  { id: 'randomWalk', label: '隨機路徑 (Random Walk)' },
  { id: 'circle', label: '圓形 (Circle)' },
  { id: 'oval', label: '橢圓形 (Oval)' },
  { id: 'figureEight', label: '8 字形 (Figure Eight)' },
  { id: 'horizontalSweep', label: '水平掃視 (Horizontal Sweep)' },
  { id: 'verticalSweep', label: '垂直掃視 (Vertical Sweep)' },
  { id: 'bounce', label: '反彈 (Bounce)' },
  { id: 'diagonal', label: '斜向 (Diagonal)' },
  { id: 'spiralBloom', label: '螺旋 (Spiral Bloom)' },
  { id: 'zigZag', label: '折線 (ZigZag)' },
  { id: 'triangle', label: '三角形 (Triangle)' },
  { id: 'square', label: '正方形 (Square)' },
  { id: 'rectangle', label: '長方形 (Rectangle)' },
  { id: 'parallelogram', label: '平行四邊形 (Parallelogram)' },
  { id: 'rhombus', label: '菱形 (Rhombus)' },
  { id: 'trapezoid', label: '梯形 (Trapezoid)' },
  { id: 'kite', label: '鳶形 (Kite)' },
  { id: 'pentagon', label: '五邊形 (Pentagon)' },
  { id: 'hexagon', label: '六邊形 (Hexagon)' },
  { id: 'heptagon', label: '七邊形 (Heptagon)' },
  { id: 'octagon', label: '八邊形 (Octagon)' },
  { id: 'nonagon', label: '九邊形 (Nonagon)' },
  { id: 'decagon', label: '十邊形 (Decagon)' },
  { id: 'hexagram', label: '六芒星 (Hexagram)' },
  { id: 'decagram', label: '十芒星 (Decagram)' },
  { id: 'superellipse', label: '超橢圓 (Superellipse)' },
  { id: 'deltoid', label: '三角星 (Deltoid)' },
  { id: 'randomizedSmooth', label: '平滑隨機 (Randomized Smooth)' },
  { id: 'peekaboo', label: '躲貓貓 (Peek-a-boo)' },
];

export const isOculomotorMode = (value: string): value is OculomotorMode =>
  oculomotorModes.some((mode) => mode.id === value);

export const isOculomotorPattern = (value: string): value is OculomotorPattern =>
  oculomotorPatterns.some((pattern) => pattern.id === value);

export const getOculomotorModeLabel = (id: string) =>
  oculomotorModes.find((mode) => mode.id === id)?.label ?? id;

export const getOculomotorPatternLabel = (id: string) =>
  oculomotorPatterns.find((pattern) => pattern.id === id)?.label ?? id;
