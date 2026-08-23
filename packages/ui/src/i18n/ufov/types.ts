export type SubtestId = 1 | 2 | 3;
export type UfovRunMode = 'instruction' | 'practice' | 'formal';
export type UfovTargetAxis = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface UfovSubtestLabels {
  1: string;
  2: string;
  3: string;
}

export interface UfovModeLabel {
  label: string;
  description: string;
}

export interface UfovModeLabels {
  instruction: UfovModeLabel;
  practice: UfovModeLabel;
  formal: UfovModeLabel;
}

export interface UfovCopy {
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
  subtests: UfovSubtestLabels;
  instructions: UfovSubtestLabels;
}

export interface UfovConfigLabels {
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
  subtests: UfovSubtestLabels;
  instructions: UfovSubtestLabels;
  modes: UfovModeLabels;
  directions: readonly string[];
}

export type PartialUfovConfigLabels = Partial<UfovConfigLabels>;

export interface UfovRuleSection {
  title: string;
  description: string;
  items?: readonly string[];
}
