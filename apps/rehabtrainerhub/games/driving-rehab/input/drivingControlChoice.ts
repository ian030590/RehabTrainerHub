import type { DrivingControlMode } from '../types/types';
import { IsDrivingControlModeAvailable, type DrivingInputCapabilitiesSnapshot } from './driving-input';

export interface DrivingControlDevice extends DrivingInputCapabilitiesSnapshot {
  /** The primary pointer is a finger, as on phones and tablets. */
  touchPreferred: boolean;
}

/** The latest key press or screen tap on the settings screen. */
export type DrivingLastInput = 'arrow' | 'wasd' | 'touch';

export type DrivingControlHint = 'press-key' | 'keyboard-ready' | 'touch-ready' | 'no-touch' | 'wheel';

function DetectDrivingControlMode(
  device: DrivingControlDevice,
  lastInput: DrivingLastInput | null,
): DrivingControlMode {
  if (lastInput === 'touch' && device.touchAvailable) return 'touch';
  if (lastInput && lastInput !== 'touch' && device.keyboardConfirmed) return lastInput;
  return device.touchPreferred && device.touchAvailable ? 'touch' : 'arrow';
}

/**
 * Until the player picks a control method, follow the device and the input
 * they last used. A picked or restored method only changes when this device
 * cannot use it; a wheel stays selected while the player connects it.
 */
export function ChooseDrivingControlMode({ capabilities, current, lastInput, playerChosen }: {
  capabilities: DrivingControlDevice;
  current: DrivingControlMode;
  lastInput: DrivingLastInput | null;
  playerChosen: boolean;
}): DrivingControlMode {
  const detected = DetectDrivingControlMode(capabilities, lastInput);
  if (!playerChosen) return detected;
  if (current === 'wheel' || IsDrivingControlModeAvailable(current, capabilities)) return current;
  return IsDrivingControlModeAvailable(detected, capabilities) ? detected : current;
}

export function GetDrivingControlHint(
  mode: DrivingControlMode,
  capabilities: DrivingInputCapabilitiesSnapshot,
): DrivingControlHint {
  if (mode === 'wheel') return 'wheel';
  if (mode === 'touch') return capabilities.touchAvailable ? 'touch-ready' : 'no-touch';
  return capabilities.keyboardConfirmed ? 'keyboard-ready' : 'press-key';
}
