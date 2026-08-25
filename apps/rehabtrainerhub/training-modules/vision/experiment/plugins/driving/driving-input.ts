import type { DrivingControlMode } from './types';

export interface DrivingWheelDevice {
  id: string;
  index: number;
}

export interface DrivingInputCapabilitiesSnapshot {
  keyboardConfirmed: boolean;
  touchAvailable: boolean;
  wheelApiSupported: boolean;
  wheelDevice: DrivingWheelDevice | null;
}

type DrivingGamepadCandidate = Pick<Gamepad, 'connected' | 'id' | 'index'>;

export interface DrivingGamepadSnapshot {
  axes: number[];
  buttons: number[];
}

export interface DrivingWheelAnalogBinding {
  source: 'axis' | 'button';
  index: number;
  releasedValue: number;
  pressedValue: number;
}

export interface DrivingWheelCalibration {
  version: 1;
  deviceId: string;
  steering: {
    axis: number;
    center: number;
    left: number;
    right: number;
  };
  throttle: DrivingWheelAnalogBinding;
  brake: DrivingWheelAnalogBinding;
}

export interface DrivingWheelCalibrationSamples {
  deviceId: string;
  neutral: DrivingGamepadSnapshot;
  left: DrivingGamepadSnapshot[];
  right: DrivingGamepadSnapshot[];
  throttle: DrivingGamepadSnapshot[];
  brake: DrivingGamepadSnapshot[];
}

export interface DrivingWheelInput {
  steering: number;
  throttle: number;
  brake: number;
}

const knownWheelIdPatterns = [
  /\b(?:steering|racing|driving|formula)\s+wheel\b/i,
  /\bwheel\b/i,
  /\b(?:volant|lenkrad)\b/i,
  /\bdriving\s+force\b/i,
  /\blogitech\s+g(?:25|27|29|920|923)\b/i,
  /\bg(?:25|27|29|920|923)\b.*\b(?:racing|wheel)\b/i,
  /\bthrustmaster\b.*\b(?:t80|t128|t150|t248|t300|t500|t598|tx|tsxw|t-gt|sf1000)\b/i,
  /\bfanatec\b.*\b(?:csl|clubsport|podium|dd|wheel|base)\b/i,
  /\bmoza\b.*\b(?:r3|r5|r9|r12|r16|r21|wheel|base)\b/i,
  /\b(?:simagic|cammus)\b.*\b(?:wheel|base|alpha|mini)\b/i,
  /\bpxn[-\s]?(?:v3|v9|v10|v12|v99)\b/i,
  /\bhori\b.*\b(?:racing|apex|wheel)\b/i,
];

/**
 * The Gamepad API has no standard device-kind field. Be deliberately
 * conservative: an unknown controller stays unavailable instead of being
 * mislabeled as a steering wheel and producing unsafe neutral pedal values.
 */
export function IsDrivingWheelGamepad(
  gamepad: DrivingGamepadCandidate | null | undefined,
): gamepad is DrivingGamepadCandidate {
  if (!gamepad?.connected || !gamepad.id.trim()) return false;
  return knownWheelIdPatterns.some((pattern) => pattern.test(gamepad.id));
}

export function FindDrivingWheelGamepad<T extends DrivingGamepadCandidate>(
  gamepads: ArrayLike<T | null> | Iterable<T | null>,
): T | null {
  return Array.from(gamepads).find(
    (gamepad): gamepad is T => IsDrivingWheelGamepad(gamepad),
  ) ?? null;
}

export function IsDrivingControlModeAvailable(
  mode: DrivingControlMode,
  capabilities: DrivingInputCapabilitiesSnapshot,
) {
  if (mode === 'arrow' || mode === 'wasd') return capabilities.keyboardConfirmed;
  if (mode === 'wheel') return capabilities.wheelDevice !== null;
  if (mode === 'touch') return capabilities.touchAvailable;
  return false;
}

export function CreateDrivingGamepadSnapshot(
  gamepad: Pick<Gamepad, 'axes' | 'buttons'>,
): DrivingGamepadSnapshot {
  return {
    axes: Array.from(gamepad.axes, (value) => Number.isFinite(value) ? value : 0),
    buttons: Array.from(gamepad.buttons, (button) => (
      Number.isFinite(button.value) ? button.value : button.pressed ? 1 : 0
    )),
  };
}

export function CreateDrivingWheelCalibration(
  samples: DrivingWheelCalibrationSamples,
): { calibration: DrivingWheelCalibration | null; error: 'steering' | 'throttle' | 'brake' | null } {
  const steering = InferSteeringBinding(samples.neutral, samples.left, samples.right);
  if (!steering) return { calibration: null, error: 'steering' };
  const throttle = InferAnalogBinding(samples.neutral, samples.throttle, steering.axis);
  if (!throttle) return { calibration: null, error: 'throttle' };
  const brake = InferAnalogBinding(
    samples.neutral,
    samples.brake,
    steering.axis,
    throttle,
  );
  if (!brake) return { calibration: null, error: 'brake' };

  return {
    calibration: {
      version: 1,
      deviceId: samples.deviceId,
      steering,
      throttle,
      brake,
    },
    error: null,
  };
}

export function ParseDrivingWheelCalibration(value: unknown): DrivingWheelCalibration | null {
  let candidate = value;
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return null;
    }
  }
  if (!candidate || typeof candidate !== 'object') return null;
  const calibration = candidate as Partial<DrivingWheelCalibration>;
  if (calibration.version !== 1 || typeof calibration.deviceId !== 'string') return null;
  const steering = calibration.steering;
  if (!steering
    || !Number.isInteger(steering.axis)
    || ![steering.center, steering.left, steering.right].every(Number.isFinite)
    || Math.abs(steering.left - steering.center) < 0.2
    || Math.abs(steering.right - steering.center) < 0.2
    || Math.sign(steering.left - steering.center) === Math.sign(steering.right - steering.center)
  ) return null;
  if (!IsAnalogBinding(calibration.throttle) || !IsAnalogBinding(calibration.brake)) return null;
  return calibration as DrivingWheelCalibration;
}

export function ReadDrivingWheelInput(
  gamepad: Pick<Gamepad, 'id' | 'axes' | 'buttons'>,
  calibration: DrivingWheelCalibration,
): DrivingWheelInput | null {
  if (!IsDrivingWheelCalibrationCompatible(gamepad, calibration)) return null;
  const steeringValue = gamepad.axes[calibration.steering.axis];
  const steeringDelta = steeringValue - calibration.steering.center;
  const leftDelta = calibration.steering.left - calibration.steering.center;
  const rightDelta = calibration.steering.right - calibration.steering.center;
  let steering = 0;
  if (steeringDelta * leftDelta > 0) {
    steering = -Math.min(1, Math.abs(steeringDelta / leftDelta));
  } else if (steeringDelta * rightDelta > 0) {
    steering = Math.min(1, Math.abs(steeringDelta / rightDelta));
  }

  return {
    steering,
    throttle: ReadAnalogBinding(gamepad, calibration.throttle),
    brake: ReadAnalogBinding(gamepad, calibration.brake),
  };
}

/**
 * A saved profile is usable only when every calibrated source still exists on
 * the live device. Browsers and wheel drivers may expose a different mapping
 * after reconnecting or changing USB ports; in that case gameplay must remain
 * paused until the player recalibrates instead of silently reading zero input.
 */
export function IsDrivingWheelCalibrationCompatible(
  gamepad: Pick<Gamepad, 'id' | 'axes' | 'buttons'>,
  calibration: DrivingWheelCalibration,
) {
  if (gamepad.id !== calibration.deviceId) return false;
  if (!Number.isFinite(gamepad.axes[calibration.steering.axis])) return false;
  return [calibration.throttle, calibration.brake].every((binding) => (
    binding.source === 'axis'
      ? Number.isFinite(gamepad.axes[binding.index])
      : Number.isFinite(gamepad.buttons[binding.index]?.value)
  ));
}

function InferSteeringBinding(
  neutral: DrivingGamepadSnapshot,
  leftSamples: DrivingGamepadSnapshot[],
  rightSamples: DrivingGamepadSnapshot[],
) {
  let best: DrivingWheelCalibration['steering'] | null = null;
  let bestScore = 0;
  for (let axis = 0; axis < neutral.axes.length; axis += 1) {
    const center = neutral.axes[axis];
    const left = FindLastFiniteValue(leftSamples.map((sample) => sample.axes[axis]), center);
    const right = FindLastFiniteValue(rightSamples.map((sample) => sample.axes[axis]), center);
    if (!Number.isFinite(left) || !Number.isFinite(right)) continue;
    const leftDelta = left - center;
    const rightDelta = right - center;
    const score = Math.abs(leftDelta) + Math.abs(rightDelta);
    if (Math.abs(leftDelta) < 0.25
      || Math.abs(rightDelta) < 0.25
      || Math.sign(leftDelta) === Math.sign(rightDelta)
      || score <= bestScore
    ) continue;
    best = { axis, center, left, right };
    bestScore = score;
  }
  return best;
}

function InferAnalogBinding(
  neutral: DrivingGamepadSnapshot,
  samples: DrivingGamepadSnapshot[],
  steeringAxis: number,
  excludedBinding?: DrivingWheelAnalogBinding,
): DrivingWheelAnalogBinding | null {
  let best: DrivingWheelAnalogBinding | null = null;
  let bestDelta = 0.2;
  for (let axis = 0; axis < neutral.axes.length; axis += 1) {
    if (axis === steeringAxis) continue;
    const releasedValue = neutral.axes[axis];
    const pressedValue = FindFarthestValue(samples.map((sample) => sample.axes[axis]), releasedValue);
    const delta = Math.abs(pressedValue - releasedValue);
    if (excludedBinding?.source === 'axis'
      && excludedBinding.index === axis
      && Math.sign(pressedValue - releasedValue)
        === Math.sign(excludedBinding.pressedValue - excludedBinding.releasedValue)
    ) continue;
    if (!Number.isFinite(pressedValue) || delta <= bestDelta) continue;
    best = { source: 'axis', index: axis, releasedValue, pressedValue };
    bestDelta = delta;
  }
  for (let index = 0; index < neutral.buttons.length; index += 1) {
    if (excludedBinding?.source === 'button' && excludedBinding.index === index) continue;
    const releasedValue = neutral.buttons[index];
    const pressedValue = FindFarthestValue(samples.map((sample) => sample.buttons[index]), releasedValue);
    const delta = Math.abs(pressedValue - releasedValue);
    if (!Number.isFinite(pressedValue) || delta <= bestDelta) continue;
    best = { source: 'button', index, releasedValue, pressedValue };
    bestDelta = delta;
  }
  return best;
}

function FindFarthestValue(values: Array<number | undefined>, origin: number): number {
  let farthest = origin;
  for (const value of values) {
    if (Number.isFinite(value) && Math.abs((value as number) - origin) > Math.abs(farthest - origin)) {
      farthest = value as number;
    }
  }
  return farthest;
}

function FindLastFiniteValue(values: Array<number | undefined>, fallback: number) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (Number.isFinite(values[index])) return values[index] as number;
  }
  return fallback;
}

function IsAnalogBinding(value: unknown): value is DrivingWheelAnalogBinding {
  if (!value || typeof value !== 'object') return false;
  const binding = value as Partial<DrivingWheelAnalogBinding>;
  return (binding.source === 'axis' || binding.source === 'button')
    && Number.isInteger(binding.index)
    && Number.isFinite(binding.releasedValue)
    && Number.isFinite(binding.pressedValue)
    && Math.abs((binding.pressedValue as number) - (binding.releasedValue as number)) >= 0.2;
}

function ReadAnalogBinding(
  gamepad: Pick<Gamepad, 'axes' | 'buttons'>,
  binding: DrivingWheelAnalogBinding,
) {
  const value = binding.source === 'axis'
    ? gamepad.axes[binding.index]
    : gamepad.buttons[binding.index]?.value;
  if (!Number.isFinite(value)) return 0;
  const range = binding.pressedValue - binding.releasedValue;
  if (Math.abs(range) < 0.0001) return 0;
  return Math.max(0, Math.min(1, ((value as number) - binding.releasedValue) / range));
}
