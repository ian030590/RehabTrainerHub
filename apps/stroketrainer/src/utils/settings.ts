/**
 * Settings manager with localStorage persistence.
 * Also includes user (account) management and global constants.
 */

// ── Global Constants ──
import { createUserStore } from '@rehab-trainer/ui/storage/userStore';

export const CARD_WIDTH_MM = 85.6;
export const CARD_HEIGHT_MM = 53.98;
export const DEFAULT_DISTANCE_CM = 60;
export const DEFAULT_CAL_BAR_LENGTH_MM = 149;
export const CAL_BAR_LENGTH_PX = 700;
export const STORAGE_PREFIX = 'stroke_trainer_';
export const DEFAULT_UI_FONT_SIZE_PX = 18;
export const MIN_UI_FONT_SIZE_PX = 14;
export const MAX_UI_FONT_SIZE_PX = 30;


export const DRIVING_DURATION_MIN_SEC = 80;
export const DRIVING_DURATION_MAX_SEC = 240;
export type DrivingControlMode = 'arrow' | 'wasd' | 'wheel';

// ── Settings ──
export interface AppSettings {
  distanceInCM: number;
  calBarLengthInMM: number;
  rulerLengthInMM: number;
  totalRounds: number;
  optionCount: number;
  optionMoveIntervalMs: number;
  targetPhysicalSizeMm: number;
  optionPhysicalSizeMm: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  soundVolume: number;
  auditoryFeedbackEnabled: boolean;
  downloadDirectory: string;
  oculomotorMode: 'pursuit' | 'reaction-jumps' | 'multi-object' | 'lilac-chaser';
  oculomotorPattern: string;
  oculomotorDurationSec: number;
  oculomotorSpeedDegPerSec: number;
  oculomotorTargetSizeMm: number;
  oculomotorDistractorCount: number;
  oculomotorTargetColor: string;
  oculomotorBackgroundColor: string;
  oculomotorTargetShape: string;
  oculomotorCustomTargetImage: string;
  oculomotorTargetOpacity: number;
  oculomotorBackgroundImage: string;
  oculomotorAudio: string;
  oculomotorBounceJitter: number;
  displayCalibrationAt: string;
  readingWPS: number;
  readingStoryId: string;
  drivingDurationSec: number;
  drivingRedFlashEnabled: boolean;
  drivingDifficulty: 'beginner' | 'intermediate' | 'advanced';
  drivingControlMode: DrivingControlMode;
  uiFontSizePx: number;
  uiFontBold: boolean;
}

interface SettingMeta<T> {
  dflt: T;
  min?: number;
  max?: number;
}

const META: { [K in keyof AppSettings]: SettingMeta<AppSettings[K]> } = {
  distanceInCM:           { dflt: DEFAULT_DISTANCE_CM,       min: 10,   max: 500 },
  calBarLengthInMM:       { dflt: DEFAULT_CAL_BAR_LENGTH_MM, min: 1,    max: 10000 },
  rulerLengthInMM:        { dflt: 0,    min: 0,    max: 10000 },
  totalRounds:            { dflt: 5,    min: 1,    max: 100 },
  optionCount:            { dflt: 18,   min: 4,    max: 40 },
  optionMoveIntervalMs:   { dflt: 800,  min: 200,  max: 5000 },
  targetPhysicalSizeMm:   { dflt: 15,   min: 2,    max: 100 },
  optionPhysicalSizeMm:   { dflt: 10,   min: 2,    max: 80 },
  difficulty:             { dflt: 'beginner' },
  soundVolume:            { dflt: 50,   min: 0,    max: 100 },
  auditoryFeedbackEnabled:{ dflt: true },
  downloadDirectory:      { dflt: '' },
  oculomotorMode:         { dflt: 'pursuit' },
  oculomotorPattern:      { dflt: 'randomWalk' },
  oculomotorDurationSec:  { dflt: 60,   min: 15,   max: 300 },
  oculomotorSpeedDegPerSec: { dflt: 10, min: 2,    max: 80 },
  oculomotorTargetSizeMm: { dflt: 10,   min: 2,    max: 50 },
  oculomotorDistractorCount: { dflt: 5, min: 0,    max: 12 },
  oculomotorTargetColor:   { dflt: '#FFFFFF' },
  oculomotorBackgroundColor: { dflt: '#000000' },
  oculomotorTargetShape:   { dflt: 'circle' },
  oculomotorCustomTargetImage: { dflt: '' },
  oculomotorTargetOpacity: { dflt: 1.0, min: 0.1, max: 1.0 },
  oculomotorBackgroundImage: { dflt: '' },
  oculomotorAudio: { dflt: '' },
  oculomotorBounceJitter: { dflt: 0, min: 0, max: 100 },
  displayCalibrationAt: { dflt: '' },
  readingWPS: { dflt: 4, min: 1, max: 20 },
  readingStoryId: { dflt: 'en_story_01' },
  drivingDurationSec: { dflt: DRIVING_DURATION_MIN_SEC, min: DRIVING_DURATION_MIN_SEC, max: DRIVING_DURATION_MAX_SEC },
  drivingRedFlashEnabled: { dflt: true },
  drivingDifficulty: { dflt: 'beginner' },
  drivingControlMode: { dflt: 'arrow' },
  uiFontSizePx: { dflt: DEFAULT_UI_FONT_SIZE_PX, min: MIN_UI_FONT_SIZE_PX, max: MAX_UI_FONT_SIZE_PX },
  uiFontBold: { dflt: false },
};

function storageKey(name: string): string {
  return STORAGE_PREFIX + name;
}

export const ACTIVE_USER_CHANGED_EVENT = 'stroke-trainer-active-user-changed';
export const SETTINGS_CHANGED_EVENT = 'stroke-trainer-settings-changed';

const settingCache: Partial<AppSettings> = {};

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  if (Object.prototype.hasOwnProperty.call(settingCache, key)) {
    return settingCache[key] as AppSettings[K];
  }

  const raw = localStorage.getItem(storageKey(key));
  if (raw === null) {
    settingCache[key] = META[key].dflt;
    return META[key].dflt;
  }

  const meta = META[key];
  if (typeof meta.dflt === 'boolean') {
    const value = (raw === 'true') as AppSettings[K];
    settingCache[key] = value;
    return value;
  }
  if (typeof meta.dflt === 'number') {
    const num = parseFloat(raw);
    if (isNaN(num) || (meta.min !== undefined && num < meta.min) || (meta.max !== undefined && num > meta.max)) {
      settingCache[key] = meta.dflt;
      return meta.dflt;
    }
    settingCache[key] = num as AppSettings[K];
    return settingCache[key] as AppSettings[K];
  }
  settingCache[key] = raw as unknown as AppSettings[K];
  return settingCache[key] as AppSettings[K];
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  settingCache[key] = value;
  localStorage.setItem(storageKey(key), String(value));
  window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT, {
    detail: { key, value },
  }));
}

export function isCalibrated(): boolean {
  return (
    getSetting('displayCalibrationAt') !== '' ||
    getSetting('distanceInCM') !== DEFAULT_DISTANCE_CM ||
    getSetting('calBarLengthInMM') !== DEFAULT_CAL_BAR_LENGTH_MM
  );
}

export function markDisplayCalibrated(): void {
  setSetting('displayCalibrationAt', new Date().toISOString());
}

export function clearDisplayCalibration(): void {
  setSetting('displayCalibrationAt', '');
}

export function getPixelsPerMM(): number {
  return CAL_BAR_LENGTH_PX / getSetting('calBarLengthInMM');
}

export function getMMPerPixel(): number {
  return getSetting('calBarLengthInMM') / CAL_BAR_LENGTH_PX;
}

// ── User Management (simple name-only) ──
export const userStore = createUserStore({
  activeUserChangedEvent: ACTIVE_USER_CHANGED_EVENT,
  storagePrefix: STORAGE_PREFIX,
});

export const addUser = userStore.addUser;
export const getActiveUser = userStore.getActiveUser;
export const getUsers = userStore.getUsers;
export const removeUser = userStore.removeUser;
export const setActiveUser = userStore.setActiveUser;
