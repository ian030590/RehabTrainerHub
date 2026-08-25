export type SubtestId = 1 | 2 | 3;
export type PeripheralAttentionRunMode = 'instruction' | 'practice' | 'formal';
export type PeripheralAttentionTargetAxis = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

// Backward-compatibility aliases
export type UfovRunMode = PeripheralAttentionRunMode;
export type UfovTargetAxis = PeripheralAttentionTargetAxis;

export interface PeripheralAttentionSubtestLabels {
  1: string;
  2: string;
  3: string;
}

export type UfovSubtestLabels = PeripheralAttentionSubtestLabels;

export interface PeripheralAttentionModeLabel {
  label: string;
  description: string;
}

export type UfovModeLabel = PeripheralAttentionModeLabel;

export interface PeripheralAttentionModeLabels {
  instruction: PeripheralAttentionModeLabel;
  practice: PeripheralAttentionModeLabel;
  formal: PeripheralAttentionModeLabel;
}

export type UfovModeLabels = PeripheralAttentionModeLabels;

export interface PeripheralAttentionCopy {
  title: string;
  intro: string;
  restart: string;
  car: string;
  truck: string;
  correct: string;
  incorrect: string;
  trial: string;
  results: string;
  aborted: string;
  saveNote: string;
  csvOnlyNote: string;
  practiceResult: string;
  downloadCsv: string;
  backHome: string;
  backLobby?: string;
  actualProcessingSpeed: string;
  tableTrial: string;
  tableVehicle: string;
  tableDirection: string;
  tableCorrect: string;
  tableProcessingSpeed: string;
  directionAccuracy: string;
  contrastLabel: string;
  anglesLabel: string;
  noPeripheral: string;
  directions: readonly string[];
  subtests: PeripheralAttentionSubtestLabels;
  instructions: PeripheralAttentionSubtestLabels;
}

export type UfovCopy = PeripheralAttentionCopy;

export interface PeripheralAttentionConfigLabels {
  settingsTitle: string;
  chooseSubtest: string;
  chooseMode: string;
  chooseTrialCount: string;
  customTrialCount: string;
  chooseDirections: string;
  anglesTitle: string;
  contrastTitle: string;
  contrastDesc: string;
  contrastStrength: string;
  contrastLow: string;
  contrastMid: string;
  contrastHigh: string;
  eccentricityTitle: string;
  eccentricityLow: string;
  eccentricityMid: string;
  eccentricityHigh: string;
  vehicleSizeTitle: string;
  vehicleSizeSmall: string;
  vehicleSizeStandard: string;
  vehicleSizeLarge: string;
  directionsTitle: string;
  directionsDesc: string;
  directionsBadge: string;
  centerAll: string;
  centerAllActive: string;
  geometryWarning: string;
  start: string;
  cancel: string;
  subtestUnavailable: string;
  subtests: PeripheralAttentionSubtestLabels;
  instructions: PeripheralAttentionSubtestLabels;
  modes: PeripheralAttentionModeLabels;
  directions: readonly string[];
}

export type UfovConfigLabels = PeripheralAttentionConfigLabels;
export type PartialPeripheralAttentionConfigLabels = Partial<PeripheralAttentionConfigLabels>;
export type PartialUfovConfigLabels = PartialPeripheralAttentionConfigLabels;

export interface PeripheralAttentionRuleSection {
  title: string;
  description: string;
  items?: readonly string[];
}

export type UfovRuleSection = PeripheralAttentionRuleSection;
