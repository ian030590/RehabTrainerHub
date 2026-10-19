import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CreateDrivingGamepadSnapshot,
  CreateDrivingWheelCalibration,
  FindDrivingWheelGamepad,
  IsDrivingWheelCalibrationCompatible,
  type DrivingInputCapabilitiesSnapshot,
  type DrivingGamepadSnapshot,
  type DrivingWheelCalibration,
  type DrivingWheelDevice,
} from './driving-input';
import type { DrivingControlDevice, DrivingLastInput } from './drivingControlChoice';
let sessionCalibration: DrivingWheelCalibration | null = null;

export {
  IsDrivingControlModeAvailable,
  type DrivingInputCapabilitiesSnapshot,
  type DrivingWheelDevice,
} from './driving-input';
export { ChooseDrivingControlMode, GetDrivingControlHint } from './drivingControlChoice';

const modifierOnlyKeys = new Set([
  'Alt',
  'AltGraph',
  'CapsLock',
  'Control',
  'Dead',
  'Fn',
  'FnLock',
  'Hyper',
  'Meta',
  'NumLock',
  'Process',
  'ScrollLock',
  'Shift',
  'Super',
  'Symbol',
  'SymbolLock',
  'Unidentified',
]);

let keyboardConfirmedInSession = false;

function GetWheelCapability(): Pick<DrivingInputCapabilitiesSnapshot, 'wheelApiSupported' | 'wheelDevice'> {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return { wheelApiSupported: false, wheelDevice: null };
  }

  try {
    const gamepad = FindDrivingWheelGamepad(navigator.getGamepads());
    return {
      wheelApiSupported: true,
      wheelDevice: gamepad
        ? {
            id: gamepad.id || `Gamepad ${gamepad.index + 1}`,
            index: gamepad.index,
          }
        : null,
    };
  } catch {
    return { wheelApiSupported: false, wheelDevice: null };
  }
}

function AreCapabilitiesEqual(
  left: DrivingControlDevice,
  right: DrivingControlDevice,
) {
  return left.keyboardConfirmed === right.keyboardConfirmed
    && left.touchAvailable === right.touchAvailable
    && left.touchPreferred === right.touchPreferred
    && left.wheelApiSupported === right.wheelApiSupported
    && left.wheelDevice?.id === right.wheelDevice?.id
    && left.wheelDevice?.index === right.wheelDevice?.index;
}

function IsConfirmingKeyboardEvent(event: KeyboardEvent) {
  return event.isTrusted
    && !event.isComposing
    && !modifierOnlyKeys.has(event.key);
}

export function GetDrivingInputCapabilitiesSnapshot(): DrivingControlDevice {
  const wheelCapability = GetWheelCapability();
  return {
    keyboardConfirmed: keyboardConfirmedInSession,
    touchAvailable: typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0,
    touchPreferred: typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(pointer: coarse)').matches,
    ...wheelCapability,
  };
}

export function IsDrivingWheelCalibrationUsable(
  calibration: DrivingWheelCalibration | null,
) {
  if (!calibration || typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return false;
  }
  try {
    const wheel = FindDrivingWheelGamepad(navigator.getGamepads());
    return Boolean(wheel && IsDrivingWheelCalibrationCompatible(wheel, calibration));
  } catch {
    return false;
  }
}

export function useDrivingInputCapabilities() {
  const [capabilities, setCapabilities] = useState<DrivingControlDevice>(
    GetDrivingInputCapabilitiesSnapshot,
  );

  const rescan = useCallback(() => {
    const nextCapabilities = GetDrivingInputCapabilitiesSnapshot();
    setCapabilities((currentCapabilities) => (
      AreCapabilitiesEqual(currentCapabilities, nextCapabilities)
        ? currentCapabilities
        : nextCapabilities
    ));
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (keyboardConfirmedInSession || !IsConfirmingKeyboardEvent(event)) return;
      keyboardConfirmedInSession = true;
      rescan();
    };
    const handleGamepadChange = () => rescan();
    const handleFocus = () => rescan();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') rescan();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('gamepadconnected', handleGamepadChange);
    window.addEventListener('gamepaddisconnected', handleGamepadChange);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    rescan();

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('gamepadconnected', handleGamepadChange);
      window.removeEventListener('gamepaddisconnected', handleGamepadChange);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [rescan]);

  return { ...capabilities, rescan };
}

const wasdKeyCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);

export function useDrivingLastInput(active: boolean) {
  const [lastInput, setLastInput] = useState<DrivingLastInput | null>(null);

  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (IsConfirmingKeyboardEvent(event)) setLastInput(wasdKeyCodes.has(event.code) ? 'wasd' : 'arrow');
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (event.isTrusted && event.pointerType === 'touch') setLastInput('touch');
    };
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [active]);

  return lastInput;
}

export type DrivingWheelCalibrationPhase =
  | 'idle'
  | 'neutral'
  | 'left'
  | 'right'
  | 'throttle'
  | 'brake'
  | 'error';

export function useDrivingWheelCalibration(wheelDevice: DrivingWheelDevice | null) {
  const [phase, setPhase] = useState<DrivingWheelCalibrationPhase>('idle');
  const [error, setError] = useState<'steering' | 'throttle' | 'brake' | 'disconnected' | null>(null);
  const [calibration, setCalibration] = useState<DrivingWheelCalibration | null>(() => (
    sessionCalibration
  ));
  const neutralRef = useRef<DrivingGamepadSnapshot | null>(null);
  const samplesRef = useRef<DrivingGamepadSnapshot[]>([]);
  const stageSamplesRef = useRef<Partial<Record<'left' | 'right' | 'throttle' | 'brake', DrivingGamepadSnapshot[]>>>({});

  const getCurrentWheel = useCallback(() => {
    const wheel = FindDrivingWheelGamepad(navigator.getGamepads?.() ?? []);
    return wheel && wheel.id === wheelDevice?.id ? wheel : null;
  }, [wheelDevice?.id]);

  useEffect(() => {
    const stored = sessionCalibration;
    setCalibration(
      stored?.deviceId === wheelDevice?.id && IsDrivingWheelCalibrationUsable(stored)
        ? stored
        : null,
    );
    setPhase('idle');
    setError(null);
    neutralRef.current = null;
    samplesRef.current = [];
    stageSamplesRef.current = {};
  }, [wheelDevice?.id]);

  useEffect(() => {
    if (!['left', 'right', 'throttle', 'brake'].includes(phase)) return;
    let frameId = 0;
    const sample = () => {
      const wheel = getCurrentWheel();
      if (!wheel) {
        setError('disconnected');
        setPhase('error');
        return;
      }
      samplesRef.current.push(CreateDrivingGamepadSnapshot(wheel));
      if (samplesRef.current.length > 900) samplesRef.current.shift();
      frameId = window.requestAnimationFrame(sample);
    };
    frameId = window.requestAnimationFrame(sample);
    return () => window.cancelAnimationFrame(frameId);
  }, [getCurrentWheel, phase]);

  const begin = useCallback(() => {
    if (!getCurrentWheel()) {
      setError('disconnected');
      setPhase('error');
      return;
    }
    setError(null);
    neutralRef.current = null;
    samplesRef.current = [];
    stageSamplesRef.current = {};
    setPhase('neutral');
  }, [getCurrentWheel]);

  const advance = useCallback(() => {
    const wheel = getCurrentWheel();
    if (!wheel) {
      setError('disconnected');
      setPhase('error');
      return;
    }
    const currentSnapshot = CreateDrivingGamepadSnapshot(wheel);
    if (phase === 'neutral') {
      neutralRef.current = currentSnapshot;
      samplesRef.current = [];
      setPhase('left');
      return;
    }
    if (!['left', 'right', 'throttle', 'brake'].includes(phase)) return;
    const movementPhase = phase as 'left' | 'right' | 'throttle' | 'brake';
    stageSamplesRef.current[movementPhase] = [...samplesRef.current, currentSnapshot];
    samplesRef.current = [];
    if (movementPhase !== 'brake') {
      const nextPhase = {
        left: 'right',
        right: 'throttle',
        throttle: 'brake',
      }[movementPhase] as DrivingWheelCalibrationPhase;
      setPhase(nextPhase);
      return;
    }

    const neutral = neutralRef.current;
    if (!neutral || !wheelDevice) {
      setError('disconnected');
      setPhase('error');
      return;
    }
    const result = CreateDrivingWheelCalibration({
      deviceId: wheelDevice.id,
      neutral,
      left: stageSamplesRef.current.left ?? [],
      right: stageSamplesRef.current.right ?? [],
      throttle: stageSamplesRef.current.throttle ?? [],
      brake: stageSamplesRef.current.brake ?? [],
    });
    if (!result.calibration) {
      setError(result.error);
      setPhase('error');
      return;
    }
    sessionCalibration = result.calibration;
    setCalibration(result.calibration);
    setError(null);
    setPhase('idle');
  }, [getCurrentWheel, phase, wheelDevice]);

  const cancel = useCallback(() => {
    samplesRef.current = [];
    stageSamplesRef.current = {};
    neutralRef.current = null;
    setError(null);
    setPhase('idle');
  }, []);

  return {
    calibration,
    calibrated: phase === 'idle'
      && Boolean(
        calibration
        && calibration.deviceId === wheelDevice?.id
        && IsDrivingWheelCalibrationUsable(calibration),
      ),
    calibrating: phase !== 'idle',
    phase,
    error,
    begin,
    advance,
    cancel,
  };
}
