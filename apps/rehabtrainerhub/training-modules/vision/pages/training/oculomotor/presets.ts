// Presets local to the Hub-owned oculomotor module.
import type {
  OculomotorBehavior,
  OculomotorMode,
  OculomotorPattern,
  OculomotorSpeedUnit,
  OculomotorTargetShape,
} from './types';

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
  { id: 'ellipse', label: '橢圓形 (Ellipse)' },
  { id: 'figureEight', label: '8 字形 (Figure Eight)' },
  { id: 'wave', label: '波浪 (Wave)' },
  { id: 'diagonal', label: '斜向 (Diagonal)' },
  { id: 'bounce', label: '反彈 (Bounce)' },
  { id: 'directionChange', label: '急轉向 (Hard Turns)' },
  { id: 'horizontalSweep', label: '水平掃視 (Horizontal Sweep)' },
  { id: 'verticalSweep', label: '垂直掃視 (Vertical Sweep)' },
  { id: 'downRightSweep', label: '右下掃視 (Down-right Sweep)' },
  { id: 'downLeftSweep', label: '左下掃視 (Down-left Sweep)' },
  { id: 'perimeterLoop', label: '邊緣循環 (Edge Loop)' },
  { id: 'diamondLoop', label: '菱形循環 (Diamond Loop)' },
  { id: 'clover', label: '四葉草 (Clover)' },
  { id: 'zigZag', label: '折線 (ZigZag)' },
  { id: 'stairStep', label: '階梯 (Stair Steps)' },
  { id: 'lissajous', label: '李沙育圖形 (Lissajous)' },
  { id: 'hourglass', label: '沙漏 (Hourglass)' },
  { id: 'cornerTour', label: '角落巡迴 (Corner Tour)' },
];

export const oculomotorBehaviors: Array<{
  id: OculomotorBehavior;
  label: string;
}> = [
  { id: 'constant', label: '穩定速度' },
  { id: 'wavePattern', label: '速度波動' },
  { id: 'surgePattern', label: '短促加速' },
  { id: 'alternatingPattern', label: '交替節奏' },
  { id: 'climbPattern', label: '逐步加速後重置' },
  { id: 'sizePulse', label: '大小脈動' },
];

export const oculomotorSpeedUnits: Array<{
  id: OculomotorSpeedUnit;
  label: string;
}> = [
  { id: 'deg/s', label: '度／秒 (deg/s)' },
  { id: 'cm/s', label: '公分／秒 (cm/s)' },
  { id: 'screen/s', label: '螢幕／秒 (screen/s)' },
];

export const isOculomotorMode = (value: string): value is OculomotorMode =>
  oculomotorModes.some((mode) => mode.id === value);

export const isOculomotorPattern = (value: string): value is OculomotorPattern =>
  oculomotorPatterns.some((pattern) => pattern.id === value)
  || value === 'teleport'
  || value === 'multipleObjectTracking';

export const isOculomotorBehavior = (value: string): value is OculomotorBehavior =>
  oculomotorBehaviors.some((behavior) => behavior.id === value);

export const isOculomotorSpeedUnit = (value: string): value is OculomotorSpeedUnit =>
  oculomotorSpeedUnits.some((unit) => unit.id === value);

export const isOculomotorTargetShape = (value: string): value is OculomotorTargetShape =>
  ['circle', 'ring', 'star', 'square', 'diamond', 'cross', 'triangle', 'custom'].includes(value);

export const getOculomotorModeLabel = (id: string) =>
  oculomotorModes.find((mode) => mode.id === id)?.label ?? id;

export const getOculomotorPatternLabel = (id: string) =>
  id === 'teleport'
    ? '跳躍定位 (Reaction Jumps)'
    : id === 'multipleObjectTracking'
      ? '多目標追蹤 (Multiple Object Tracking)'
      : oculomotorPatterns.find((pattern) => pattern.id === id)?.label ?? id;
