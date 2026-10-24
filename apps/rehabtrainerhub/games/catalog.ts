import gaborPatchingCatalog from './gabor-patching/public/game.json';
import readingTrainingCatalog from './reading-training/public/game.json';
import hartChartCatalog from './hart-chart/public/game.json';
import sartCatalog from './sart/public/game.json';
import schulteGridCatalog from './schulte-grid/public/game.json';
import hexSchulteCatalog from './hex-schulte/public/game.json';
import continuousPerformanceCatalog from './continuous-performance/public/game.json';
import simonTaskCatalog from './simon-task/public/game.json';
import cardSortingCatalog from './card-sorting/public/game.json';
import attentionalBlinkCatalog from './attentional-blink/public/game.json';
import timePerceptionCatalog from './time-perception/public/game.json';
import dividedAttentionCatalog from './divided-attention/public/game.json';
import patternMemoryCatalog from './pattern-memory/public/game.json';
import stroopCatalog from './stroop/public/game.json';
import flankerCatalog from './flanker/public/game.json';
import goNogoCatalog from './go-nogo/public/game.json';
import stopSignalCatalog from './stop-signal/public/game.json';
import attentionNetworkTaskCatalog from './attention-network-task/public/game.json';
import nBackCatalog from './n-back/public/game.json';
import numberLetterCatalog from './number-letter/public/game.json';
import digitSpanCatalog from './digit-span/public/game.json';
import spatialSpanCatalog from './spatial-span/public/game.json';
import towerOfLondonCatalog from './tower-of-london/public/game.json';
import reactionTimeCatalog from './reaction-time/public/game.json';
import ticTacToeCatalog from './tic-tac-toe/public/game.json';
import connect4Catalog from './connect4/public/game.json';
import hexCatalog from './hex/public/game.json';
import dotsAndBoxesCatalog from './dots-and-boxes/public/game.json';
import lightsOutCatalog from './lights-out/public/game.json';
import slidingPuzzleCatalog from './sliding-puzzle/public/game.json';
import mazeCatalog from './maze/public/game.json';
import sudokuCatalog from './sudoku/public/game.json';
import memoryMatchCatalog from './memory-match/public/game.json';
import simonSaysCatalog from './simon-says/public/game.json';
import whackAMoleCatalog from './whack-a-mole/public/game.json';
import minesweeperCatalog from './minesweeper/public/game.json';
import antisaccadeCatalog from './antisaccade/public/game.json';
import keepTrackCatalog from './keep-track/public/game.json';
import letterMemoryCatalog from './letter-memory/public/game.json';
import plusMinusCatalog from './plus-minus/public/game.json';
import ufovCatalog from './ufov/public/game.json';
import everyBallCatalog from './every-ball-response/public/game.json';
import tongueCatchCatalog from './tongue-catch/public/game.json';
import seagullFlightCatalog from './seagull-flight/public/game.json';
import { defaultSiteUrls } from '@rehab-trainer/ui/siteUrls';
import officialGameReleases from '@rehab-trainer/ui/officialGameReleases.json';
import drawingDefenseCatalog from './drawing-defense/public/game.json';
import asteroidShieldCatalog from './asteroid-shield/public/game.json';
import motorCortexCatalog from './motor-cortex-rehab/public/game.json';
import movingCardCatalog from './moving-card/public/game.json';
import gestureBattlerCatalog from './gesture-battler/public/game.json';
import type { MajorCategoryId,TrainerCategoryId } from './gameTags.js';
import {
GetTrainerCategoryTag,
GetTrainingPurposeTrainerId,
IsTrainerCategoryId,
categorySubcategories,
majorCategoryIds,
majorCategoryTags,
trainerCategoryTags,
} from './gameTags.js';
import {
GetTrainingModuleFlowManifest,
type TrainingFlowStep,
type TrainingMediaPermission,
} from './moduleFlowManifest';

export {
GetTrainerCategoryTag,
GetTrainingPurposeTrainerId,
IsTrainerCategoryId,
categorySubcategories,
majorCategoryIds,
majorCategoryTags,
trainerCategoryTags
};
export type { MajorCategoryId,TrainerCategoryId };

export type ThemeIconType = 'material-symbol' | 'svg';

export interface ThemeIconConfig {
  type: ThemeIconType;
  value: string;
  alt?: string;
}

export interface TrainingVisualTheme {
  id: string;
  label: {
    'zh-TW': string;
    en: string;
  };
  icon: ThemeIconConfig;
  colors: {
    primary: string;
    dark?: string;
    surfaceMixRatio?: number;
  };
  badge?: {
    text: {
      'zh-TW': string;
      en: string;
    };
  };
  aliases?: readonly string[];
}

type TrainingVisualThemeDefinition = Omit<TrainingVisualTheme, 'id'>;

function DefineTrainingThemes<
  const Themes extends Readonly<Record<string, TrainingVisualThemeDefinition>>,
>(themes: Themes): {
  readonly [ThemeId in keyof Themes]: Readonly<Themes[ThemeId] & { id: ThemeId }>;
} {
  return Object.fromEntries(
    Object.entries(themes).map(([id, theme]) => [id, { ...theme, id }]),
  ) as {
    readonly [ThemeId in keyof Themes]: Readonly<Themes[ThemeId] & { id: ThemeId }>;
  };
}

export const trainingThemes = DefineTrainingThemes({
  'upper-limb': {
    label: { 'zh-TW': '上肢動作', en: 'Upper-limb movement' },
    icon: { type: 'svg', value: '/assets/motor-logo.svg', alt: 'MotorTrainer' },
    colors: { primary: '#005eb8', dark: '#00478d' },
    aliases: ['movement'],
  },
  'lower-limb': {
    label: { 'zh-TW': '下肢動作', en: 'Lower-limb movement' },
    icon: { type: 'svg', value: '/assets/motor-logo.svg', alt: 'MotorTrainer' },
    colors: { primary: '#005eb8', dark: '#00478d' },
  },
  vision: {
    label: { 'zh-TW': '視覺訓練', en: 'Vision training' },
    icon: { type: 'svg', value: '/assets/vision-logo.svg', alt: 'VisionTrainer' },
    colors: { primary: '#006c47', dark: '#005235' },
  },
  attention: {
    label: { 'zh-TW': '注意力訓練', en: 'Attention training' },
    icon: { type: 'svg', value: '/assets/brain-logo.svg', alt: 'BrainTrainer' },
    colors: { primary: '#7a4a24', dark: '#5a3519', surfaceMixRatio: 10 },
  },
  memory: {
    label: { 'zh-TW': '記憶力訓練', en: 'Memory training' },
    icon: { type: 'svg', value: '/assets/brain-logo.svg', alt: 'BrainTrainer' },
    colors: { primary: '#7a4a24', dark: '#5a3519', surfaceMixRatio: 10 },
  },
  'higher-cognition': {
    label: { 'zh-TW': '高階認知訓練', en: 'Higher cognition training' },
    icon: { type: 'svg', value: '/assets/brain-logo.svg', alt: 'BrainTrainer' },
    colors: { primary: '#7a4a24', dark: '#5a3519', surfaceMixRatio: 10 },
    aliases: ['general'],
  },
  language: {
    label: { 'zh-TW': '語言訓練', en: 'Language training' },
    icon: { type: 'svg', value: '/assets/brain-logo.svg', alt: 'BrainTrainer' },
    colors: { primary: '#7a4a24', dark: '#5a3519', surfaceMixRatio: 10 },
  },
  oral: {
    label: { 'zh-TW': '口腔訓練', en: 'Oral training' },
    icon: { type: 'svg', value: '/assets/mouth-logo.svg', alt: 'MouthTrainer' },
    colors: { primary: '#6750a4', dark: '#4f378b', surfaceMixRatio: 9 },
  },
});

export const defaultTrainingTheme: TrainingVisualTheme = {
  id: 'default',
  label: { 'zh-TW': '一般訓練', en: 'General practice' },
  icon: { type: 'material-symbol', value: 'sports_esports' },
  colors: { primary: '#005eb8', dark: '#00478d', surfaceMixRatio: 8 },
};

export type TrainingPurposeId = keyof typeof trainingThemes;

export const trainingPurposes = Object.values(trainingThemes);
export type TrainerCatalogId = TrainerCategoryId;
export type TrainingModuleKind =
  | 'motor-upper'
  | 'vision'
  | 'brain-route'
  | 'mouth-oral';

export interface LocalizedTrainingCopy {
  title: string;
  description: string;
}

export interface TrainingCatalogModule {
  catalogId: string;
  runtimeId: string;
  trainer: TrainerCatalogId;
  category: TrainerCategoryId;
  purpose: TrainingPurposeId;
  subcategory: TrainingPurposeId;
  kind: TrainingModuleKind;
  entryPath: string;
  settingsPath: string;
  imagePath: string;
  flow: readonly TrainingFlowStep[];
  mediaPermission: TrainingMediaPermission;
  sourcePath: string;
  copy: {
    'zh-TW': LocalizedTrainingCopy;
    en: LocalizedTrainingCopy;
  };
  titleKey?: string;
  descriptionKey?: string;
  referenceTitleKey?: string;
  focusKey?: string;
}

interface TrainingCatalogSeed {
  id: string;
  trainer: TrainerCatalogId;
  purpose: TrainingPurposeId;
  kind: TrainingModuleKind;
  path: string;
  imagePath?: string;
  zh: readonly [title: string, description: string];
  en: readonly [title: string, description: string];
  titleKey?: string;
  descriptionKey?: string;
  referenceTitleKey?: string;
  focusKey?: string;
}

const seeds: readonly TrainingCatalogSeed[] = [
  {
    id: 'drawing-defense',
    trainer: drawingDefenseCatalog.trainer as TrainerCatalogId,
    purpose: drawingDefenseCatalog.category as TrainingPurposeId,
    kind: 'motor-upper',
    path: '/upper-limb-training?game=drawing-defense',
    imagePath: `/assets/game-previews/drawing-defense/${drawingDefenseCatalog.preview}`,
    zh: [drawingDefenseCatalog.copy['zh-TW'].title, drawingDefenseCatalog.copy['zh-TW'].description],
    en: [drawingDefenseCatalog.copy.en.title, drawingDefenseCatalog.copy.en.description],
    titleKey: 'training.drawing.title',
    descriptionKey: 'training.drawing.desc',
  },
  {
    id: 'asteroid-shield',
    trainer: asteroidShieldCatalog.trainer as TrainerCategoryId,
    purpose: asteroidShieldCatalog.category as TrainingPurposeId,
    imagePath: `/assets/game-previews/asteroid-shield/${asteroidShieldCatalog.preview}`,
    kind: 'motor-upper',
    path: '/upper-limb-training?game=asteroid-shield',
    zh: [asteroidShieldCatalog.copy['zh-TW'].title, asteroidShieldCatalog.copy['zh-TW'].description],
    en: [asteroidShieldCatalog.copy.en.title, asteroidShieldCatalog.copy.en.description],
    titleKey: 'training.asteroidShield.title',
    descriptionKey: 'training.asteroidShield.desc',
  },
  {
    id: 'gesture-battler',
    trainer: gestureBattlerCatalog.trainer as TrainerCategoryId,
    purpose: gestureBattlerCatalog.category as TrainingPurposeId,
    imagePath: `/assets/game-previews/gesture-battler/${gestureBattlerCatalog.preview}`,
    kind: 'motor-upper',
    path: '/upper-limb-training?game=gesture-battler',
    zh: [gestureBattlerCatalog.copy['zh-TW'].title, gestureBattlerCatalog.copy['zh-TW'].description],
    en: [gestureBattlerCatalog.copy.en.title, gestureBattlerCatalog.copy.en.description],
    titleKey: 'training.gesture.title',
    descriptionKey: 'training.gesture.desc',
  },
  {
    id: 'motor-cortex-rehab',
    trainer: motorCortexCatalog.trainer as TrainerCategoryId,
    purpose: motorCortexCatalog.category as TrainingPurposeId,
    imagePath: `/assets/game-previews/motor-cortex-rehab/${motorCortexCatalog.preview}`,
    kind: 'motor-upper',
    path: '/upper-limb-training?game=motor-cortex-rehab',
    zh: [motorCortexCatalog.copy['zh-TW'].title, motorCortexCatalog.copy['zh-TW'].description],
    en: [motorCortexCatalog.copy.en.title, motorCortexCatalog.copy.en.description],
  },
  {
    id: 'moving-card',
    trainer: movingCardCatalog.trainer as TrainerCategoryId,
    purpose: movingCardCatalog.category as TrainingPurposeId,
    imagePath: `/assets/game-previews/moving-card/${movingCardCatalog.preview}`,
    kind: 'vision',
    path: '/?module=moving-card',
    zh: [movingCardCatalog.copy['zh-TW'].title, movingCardCatalog.copy['zh-TW'].description],
    en: [movingCardCatalog.copy.en.title, movingCardCatalog.copy.en.description],
  },
  {
    id: 'oculomotor-training',
    trainer: 'vision',
    purpose: 'vision',
    kind: 'vision',
    path: '/?module=oculomotor-training',
    zh: ['眼動訓練', '以追視、跳視與多目標追蹤練習眼球運動控制。'],
    en: ['Oculomotor Training', 'Practise eye-movement control with pursuit, saccades, and multiple-target tracking.'],
    titleKey: 'home.module.oculomotor.title',
    descriptionKey: 'home.module.oculomotor.desc',
  },
  {
    id: 'gabor-patching',
    trainer: gaborPatchingCatalog.trainer as 'vision',
    purpose: gaborPatchingCatalog.category as 'vision',
    imagePath: `/assets/game-previews/gabor-patching/${gaborPatchingCatalog.preview}`,
    kind: 'vision',
    path: '/?module=gabor-patching',
    zh: [gaborPatchingCatalog.copy['zh-TW'].title, gaborPatchingCatalog.copy['zh-TW'].description],
    en: [gaborPatchingCatalog.copy.en.title, gaborPatchingCatalog.copy.en.description],
    titleKey: 'home.module.gaborPatching.title',
    descriptionKey: 'home.module.gaborPatching.desc',
  },
  {
    id: 'reading-training',
    trainer: readingTrainingCatalog.trainer as 'vision',
    purpose: readingTrainingCatalog.category as 'vision',
    imagePath: `/assets/game-previews/reading-training/${readingTrainingCatalog.preview}`,
    kind: 'vision',
    path: '/?module=reading-training',
    zh: [readingTrainingCatalog.copy['zh-TW'].title, readingTrainingCatalog.copy['zh-TW'].description],
    en: [readingTrainingCatalog.copy.en.title, readingTrainingCatalog.copy.en.description],
    titleKey: 'home.module.reading.title',
    descriptionKey: 'home.module.reading.desc',
  },
  {
    id: 'driving-rehab',
    trainer: 'vision',
    purpose: 'vision',
    kind: 'vision',
    path: '/?module=driving-rehab',
    zh: ['駕駛注意力模擬練習', '在送貨任務中回應突發事件；紀錄僅反映當次操作，不判定駕駛能力。'],
    en: ['Driving Attention Simulation Practice', 'Respond to hazards during a delivery route; records reflect only the current activity and do not determine driving ability.'],
    titleKey: 'home.module.driving.title',
    descriptionKey: 'home.module.driving.desc',
  },
  {
    id: 'hart-chart',
    trainer: hartChartCatalog.trainer as 'vision',
    purpose: hartChartCatalog.category as 'vision',
    imagePath: `/assets/game-previews/hart-chart/${hartChartCatalog.preview}`,
    kind: 'vision',
    path: '/?module=hart-chart',
    zh: [hartChartCatalog.copy['zh-TW'].title, hartChartCatalog.copy['zh-TW'].description],
    en: [hartChartCatalog.copy.en.title, hartChartCatalog.copy.en.description],
    titleKey: 'home.module.hartChart.title',
    descriptionKey: 'home.module.hartChart.desc',
  },
  {
    id: 'ufov',
    trainer: ufovCatalog.trainer as 'brain',
    purpose: ufovCatalog.category as 'attention',
    imagePath: `/assets/game-previews/ufov/${ufovCatalog.preview}`,
    kind: 'brain-route',
    path: '/attention-training?game=ufov',
    zh: [ufovCatalog.copy['zh-TW'].title, ufovCatalog.copy['zh-TW'].description],
    en: [ufovCatalog.copy.en.title, ufovCatalog.copy.en.description],
  },
  {
    id: 'every-ball-response',
    trainer: everyBallCatalog.trainer as 'brain',
    purpose: everyBallCatalog.category as 'attention',
    imagePath: `/assets/game-previews/every-ball-response/${everyBallCatalog.preview}`,
    kind: 'brain-route',
    path: '/attention-training?game=every-ball-response',
    zh: [everyBallCatalog.copy['zh-TW'].title, everyBallCatalog.copy['zh-TW'].description],
    en: [everyBallCatalog.copy.en.title, everyBallCatalog.copy.en.description],
  },
  {
    id: 'stroop',
    trainer: stroopCatalog.trainer as 'brain',
    purpose: stroopCatalog.category as 'attention',
    imagePath: `/assets/game-previews/stroop/${stroopCatalog.preview}`,
    kind: 'brain-route',
    path: '/attention-training?game=stroop',
    zh: [stroopCatalog.copy['zh-TW'].title, stroopCatalog.copy['zh-TW'].description],
    en: [stroopCatalog.copy.en.title, stroopCatalog.copy.en.description],
  },
  {
    id: 'flanker',
    trainer: flankerCatalog.trainer as 'brain',
    purpose: flankerCatalog.category as 'attention',
    imagePath: `/assets/game-previews/flanker/${flankerCatalog.preview}`,
    kind: 'brain-route',
    path: '/attention-training?game=flanker',
    zh: [flankerCatalog.copy['zh-TW'].title, flankerCatalog.copy['zh-TW'].description],
    en: [flankerCatalog.copy.en.title, flankerCatalog.copy.en.description],
  },
  {
    id: 'go-nogo',
    trainer: goNogoCatalog.trainer as 'brain',
    purpose: goNogoCatalog.category as 'attention',
    imagePath: `/assets/game-previews/go-nogo/${goNogoCatalog.preview}`,
    kind: 'brain-route',
    path: '/attention-training?game=go-nogo',
    zh: [goNogoCatalog.copy['zh-TW'].title, goNogoCatalog.copy['zh-TW'].description],
    en: [goNogoCatalog.copy.en.title, goNogoCatalog.copy.en.description],
  },
  {
    id: 'stop-signal',
    trainer: stopSignalCatalog.trainer as 'brain',
    purpose: stopSignalCatalog.category as 'attention',
    imagePath: `/assets/game-previews/stop-signal/${stopSignalCatalog.preview}`,
    kind: 'brain-route',
    path: '/attention-training?game=stop-signal',
    zh: [stopSignalCatalog.copy['zh-TW'].title, stopSignalCatalog.copy['zh-TW'].description],
    en: [stopSignalCatalog.copy.en.title, stopSignalCatalog.copy.en.description],
  },
  {
    id: 'sart',
    trainer: sartCatalog.trainer as 'brain',
    purpose: sartCatalog.category as 'attention',
    imagePath: `/assets/game-previews/sart/${sartCatalog.preview}`,
    kind: 'brain-route',
    path: '/attention-training?game=sart',
    zh: [sartCatalog.copy['zh-TW'].title, sartCatalog.copy['zh-TW'].description],
    en: [sartCatalog.copy.en.title, sartCatalog.copy.en.description],
  },
  {
    id: 'schulte-grid',
    trainer: schulteGridCatalog.trainer as 'brain',
    purpose: schulteGridCatalog.category as 'attention',
    imagePath: `/assets/game-previews/schulte-grid/${schulteGridCatalog.preview}`,
    kind: 'brain-route',
    path: '/attention-training?game=schulte-grid',
    zh: [schulteGridCatalog.copy['zh-TW'].title, schulteGridCatalog.copy['zh-TW'].description],
    en: [schulteGridCatalog.copy.en.title, schulteGridCatalog.copy.en.description],
  },
  {
    id: 'hex-schulte',
    trainer: hexSchulteCatalog.trainer as 'brain',
    purpose: hexSchulteCatalog.category as 'attention',
    imagePath: `/assets/game-previews/hex-schulte/${hexSchulteCatalog.preview}`,
    kind: 'brain-route',
    path: '/attention-training?game=hex-schulte',
    zh: [hexSchulteCatalog.copy['zh-TW'].title, hexSchulteCatalog.copy['zh-TW'].description],
    en: [hexSchulteCatalog.copy.en.title, hexSchulteCatalog.copy.en.description],
  },
  {
    id: 'continuous-performance',
    trainer: continuousPerformanceCatalog.trainer as 'brain',
    purpose: continuousPerformanceCatalog.category as 'attention',
    imagePath: `/assets/game-previews/continuous-performance/${continuousPerformanceCatalog.preview}`,
    kind: 'brain-route',
    path: '/attention-training?game=continuous-performance',
    zh: [continuousPerformanceCatalog.copy['zh-TW'].title, continuousPerformanceCatalog.copy['zh-TW'].description],
    en: [continuousPerformanceCatalog.copy.en.title, continuousPerformanceCatalog.copy.en.description],
  },
  {
    id: 'simon-task',
    trainer: simonTaskCatalog.trainer as 'brain',
    purpose: simonTaskCatalog.category as 'attention',
    imagePath: `/assets/game-previews/simon-task/${simonTaskCatalog.preview}`,
    kind: 'brain-route',
    path: '/attention-training?game=simon-task',
    zh: [simonTaskCatalog.copy['zh-TW'].title, simonTaskCatalog.copy['zh-TW'].description],
    en: [simonTaskCatalog.copy.en.title, simonTaskCatalog.copy.en.description],
  },
  {
    id: 'card-sorting',
    trainer: cardSortingCatalog.trainer as 'brain',
    purpose: cardSortingCatalog.category as 'higher-cognition',
    imagePath: `/assets/game-previews/card-sorting/${cardSortingCatalog.preview}`,
    kind: 'brain-route',
    path: '/thinking-training?game=card-sorting',
    zh: [cardSortingCatalog.copy['zh-TW'].title, cardSortingCatalog.copy['zh-TW'].description],
    en: [cardSortingCatalog.copy.en.title, cardSortingCatalog.copy.en.description],
  },
  {
    id: 'attentional-blink',
    trainer: attentionalBlinkCatalog.trainer as 'brain',
    purpose: attentionalBlinkCatalog.category as 'attention',
    imagePath: `/assets/game-previews/attentional-blink/${attentionalBlinkCatalog.preview}`,
    kind: 'brain-route',
    path: '/attention-training?game=attentional-blink',
    zh: [attentionalBlinkCatalog.copy['zh-TW'].title, attentionalBlinkCatalog.copy['zh-TW'].description],
    en: [attentionalBlinkCatalog.copy.en.title, attentionalBlinkCatalog.copy.en.description],
  },
  {
    id: 'time-perception',
    trainer: timePerceptionCatalog.trainer as 'brain',
    purpose: timePerceptionCatalog.category as 'higher-cognition',
    imagePath: `/assets/game-previews/time-perception/${timePerceptionCatalog.preview}`,
    kind: 'brain-route',
    path: '/thinking-training?game=time-perception',
    zh: [timePerceptionCatalog.copy['zh-TW'].title, timePerceptionCatalog.copy['zh-TW'].description],
    en: [timePerceptionCatalog.copy.en.title, timePerceptionCatalog.copy.en.description],
  },
  {
    id: 'divided-attention',
    trainer: dividedAttentionCatalog.trainer as 'brain',
    purpose: dividedAttentionCatalog.category as 'attention',
    imagePath: `/assets/game-previews/divided-attention/${dividedAttentionCatalog.preview}`,
    kind: 'brain-route',
    path: '/attention-training?game=divided-attention',
    zh: [dividedAttentionCatalog.copy['zh-TW'].title, dividedAttentionCatalog.copy['zh-TW'].description],
    en: [dividedAttentionCatalog.copy.en.title, dividedAttentionCatalog.copy.en.description],
  },
  {
    id: 'pattern-memory',
    trainer: patternMemoryCatalog.trainer as 'brain',
    purpose: patternMemoryCatalog.category as 'memory',
    imagePath: `/assets/game-previews/pattern-memory/${patternMemoryCatalog.preview}`,
    kind: 'brain-route',
    path: '/memory-training?game=pattern-memory',
    zh: [patternMemoryCatalog.copy['zh-TW'].title, patternMemoryCatalog.copy['zh-TW'].description],
    en: [patternMemoryCatalog.copy.en.title, patternMemoryCatalog.copy.en.description],
  },
  {
    id: 'attention-network-task',
    trainer: attentionNetworkTaskCatalog.trainer as 'brain',
    purpose: attentionNetworkTaskCatalog.category as 'attention',
    imagePath: `/assets/game-previews/attention-network-task/${attentionNetworkTaskCatalog.preview}`,
    kind: 'brain-route',
    path: '/attention-training?game=attention-network-task',
    zh: [attentionNetworkTaskCatalog.copy['zh-TW'].title, attentionNetworkTaskCatalog.copy['zh-TW'].description],
    en: [attentionNetworkTaskCatalog.copy.en.title, attentionNetworkTaskCatalog.copy.en.description],
  },
  {
    id: 'antisaccade',
    trainer: antisaccadeCatalog.trainer as 'brain',
    purpose: antisaccadeCatalog.category as 'attention',
    imagePath: `/assets/game-previews/antisaccade/${antisaccadeCatalog.preview}`,
    kind: 'brain-route',
    path: '/attention-training?game=antisaccade',
    zh: [antisaccadeCatalog.copy['zh-TW'].title, antisaccadeCatalog.copy['zh-TW'].description],
    en: [antisaccadeCatalog.copy.en.title, antisaccadeCatalog.copy.en.description],
  },
  {
    id: 'reaction-time',
    trainer: reactionTimeCatalog.trainer as 'brain',
    purpose: reactionTimeCatalog.category as 'attention',
    imagePath: `/assets/game-previews/reaction-time/${reactionTimeCatalog.preview}`,
    kind: 'brain-route',
    path: '/attention-training?game=reaction-time',
    zh: [reactionTimeCatalog.copy['zh-TW'].title, reactionTimeCatalog.copy['zh-TW'].description],
    en: [reactionTimeCatalog.copy.en.title, reactionTimeCatalog.copy.en.description],
  },
  {
    id: 'whack-a-mole',
    trainer: whackAMoleCatalog.trainer as 'brain',
    purpose: whackAMoleCatalog.category as 'attention',
    imagePath: `/assets/game-previews/whack-a-mole/${whackAMoleCatalog.preview}`,
    kind: 'brain-route',
    path: '/attention-training?game=whack-a-mole',
    zh: [whackAMoleCatalog.copy['zh-TW'].title, whackAMoleCatalog.copy['zh-TW'].description],
    en: [whackAMoleCatalog.copy.en.title, whackAMoleCatalog.copy.en.description],
  },
  {
    id: 'memory-match',
    trainer: memoryMatchCatalog.trainer as 'brain',
    purpose: memoryMatchCatalog.category as 'memory',
    imagePath: `/assets/game-previews/memory-match/${memoryMatchCatalog.preview}`,
    kind: 'brain-route',
    path: '/memory-training?game=memory-match',
    zh: [memoryMatchCatalog.copy['zh-TW'].title, memoryMatchCatalog.copy['zh-TW'].description],
    en: [memoryMatchCatalog.copy.en.title, memoryMatchCatalog.copy.en.description],
  },
  {
    id: 'simon-says',
    trainer: simonSaysCatalog.trainer as 'brain',
    purpose: simonSaysCatalog.category as 'memory',
    imagePath: `/assets/game-previews/simon-says/${simonSaysCatalog.preview}`,
    kind: 'brain-route',
    path: '/memory-training?game=simon-says',
    zh: [simonSaysCatalog.copy['zh-TW'].title, simonSaysCatalog.copy['zh-TW'].description],
    en: [simonSaysCatalog.copy.en.title, simonSaysCatalog.copy.en.description],
  },
  {
    id: 'n-back',
    trainer: nBackCatalog.trainer as 'brain',
    purpose: nBackCatalog.category as 'memory',
    imagePath: `/assets/game-previews/n-back/${nBackCatalog.preview}`,
    kind: 'brain-route',
    path: '/memory-training?game=n-back',
    zh: [nBackCatalog.copy['zh-TW'].title, nBackCatalog.copy['zh-TW'].description],
    en: [nBackCatalog.copy.en.title, nBackCatalog.copy.en.description],
  },
  {
    id: 'digit-span',
    trainer: digitSpanCatalog.trainer as 'brain',
    purpose: digitSpanCatalog.category as 'memory',
    imagePath: `/assets/game-previews/digit-span/${digitSpanCatalog.preview}`,
    kind: 'brain-route',
    path: '/memory-training?game=digit-span',
    zh: [digitSpanCatalog.copy['zh-TW'].title, digitSpanCatalog.copy['zh-TW'].description],
    en: [digitSpanCatalog.copy.en.title, digitSpanCatalog.copy.en.description],
  },
  {
    id: 'spatial-span',
    trainer: spatialSpanCatalog.trainer as 'brain',
    purpose: spatialSpanCatalog.category as 'memory',
    imagePath: `/assets/game-previews/spatial-span/${spatialSpanCatalog.preview}`,
    kind: 'brain-route',
    path: '/memory-training?game=spatial-span',
    zh: [spatialSpanCatalog.copy['zh-TW'].title, spatialSpanCatalog.copy['zh-TW'].description],
    en: [spatialSpanCatalog.copy.en.title, spatialSpanCatalog.copy.en.description],
  },
  {
    id: 'letter-memory',
    trainer: letterMemoryCatalog.trainer as 'brain',
    purpose: letterMemoryCatalog.category as 'memory',
    imagePath: `/assets/game-previews/letter-memory/${letterMemoryCatalog.preview}`,
    kind: 'brain-route',
    path: '/memory-training?game=letter-memory',
    zh: [letterMemoryCatalog.copy['zh-TW'].title, letterMemoryCatalog.copy['zh-TW'].description],
    en: [letterMemoryCatalog.copy.en.title, letterMemoryCatalog.copy.en.description],
  },
  {
    id: 'keep-track',
    trainer: keepTrackCatalog.trainer as 'brain',
    purpose: keepTrackCatalog.category as 'memory',
    imagePath: `/assets/game-previews/keep-track/${keepTrackCatalog.preview}`,
    kind: 'brain-route',
    path: '/memory-training?game=keep-track',
    zh: [keepTrackCatalog.copy['zh-TW'].title, keepTrackCatalog.copy['zh-TW'].description],
    en: [keepTrackCatalog.copy.en.title, keepTrackCatalog.copy.en.description],
  },
  {
    id: 'minesweeper',
    trainer: minesweeperCatalog.trainer as 'brain',
    purpose: minesweeperCatalog.category as 'higher-cognition',
    imagePath: `/assets/game-previews/minesweeper/${minesweeperCatalog.preview}`,
    kind: 'brain-route',
    path: '/thinking-training?game=minesweeper',
    zh: [minesweeperCatalog.copy['zh-TW'].title, minesweeperCatalog.copy['zh-TW'].description],
    en: [minesweeperCatalog.copy.en.title, minesweeperCatalog.copy.en.description],
  },
  {
    id: 'tower-of-london',
    trainer: towerOfLondonCatalog.trainer as 'brain',
    purpose: towerOfLondonCatalog.category as 'higher-cognition',
    imagePath: `/assets/game-previews/tower-of-london/${towerOfLondonCatalog.preview}`,
    kind: 'brain-route',
    path: '/thinking-training?game=tower-of-london',
    zh: [towerOfLondonCatalog.copy['zh-TW'].title, towerOfLondonCatalog.copy['zh-TW'].description],
    en: [towerOfLondonCatalog.copy.en.title, towerOfLondonCatalog.copy.en.description],
  },
  {
    id: 'number-letter',
    trainer: numberLetterCatalog.trainer as 'brain',
    purpose: numberLetterCatalog.category as 'higher-cognition',
    imagePath: `/assets/game-previews/number-letter/${numberLetterCatalog.preview}`,
    kind: 'brain-route',
    path: '/thinking-training?game=number-letter',
    zh: [numberLetterCatalog.copy['zh-TW'].title, numberLetterCatalog.copy['zh-TW'].description],
    en: [numberLetterCatalog.copy.en.title, numberLetterCatalog.copy.en.description],
  },
  {
    id: 'plus-minus',
    trainer: plusMinusCatalog.trainer as 'brain',
    purpose: plusMinusCatalog.category as 'higher-cognition',
    imagePath: `/assets/game-previews/plus-minus/${plusMinusCatalog.preview}`,
    kind: 'brain-route',
    path: '/thinking-training?game=plus-minus',
    zh: [plusMinusCatalog.copy['zh-TW'].title, plusMinusCatalog.copy['zh-TW'].description],
    en: [plusMinusCatalog.copy.en.title, plusMinusCatalog.copy.en.description],
  },
  {
    id: 'lights-out',
    trainer: lightsOutCatalog.trainer as 'brain',
    purpose: lightsOutCatalog.category as 'higher-cognition',
    imagePath: `/assets/game-previews/lights-out/${lightsOutCatalog.preview}`,
    kind: 'brain-route',
    path: '/thinking-training?game=lights-out',
    zh: [lightsOutCatalog.copy['zh-TW'].title, lightsOutCatalog.copy['zh-TW'].description],
    en: [lightsOutCatalog.copy.en.title, lightsOutCatalog.copy.en.description],
  },
  {
    id: 'sliding-puzzle',
    trainer: slidingPuzzleCatalog.trainer as 'brain',
    purpose: slidingPuzzleCatalog.category as 'higher-cognition',
    imagePath: `/assets/game-previews/sliding-puzzle/${slidingPuzzleCatalog.preview}`,
    kind: 'brain-route',
    path: '/thinking-training?game=sliding-puzzle',
    zh: [slidingPuzzleCatalog.copy['zh-TW'].title, slidingPuzzleCatalog.copy['zh-TW'].description],
    en: [slidingPuzzleCatalog.copy.en.title, slidingPuzzleCatalog.copy.en.description],
  },
  {
    id: 'sudoku',
    trainer: sudokuCatalog.trainer as 'brain',
    purpose: sudokuCatalog.category as 'higher-cognition',
    imagePath: `/assets/game-previews/sudoku/${sudokuCatalog.preview}`,
    kind: 'brain-route',
    path: '/thinking-training?game=sudoku',
    zh: [sudokuCatalog.copy['zh-TW'].title, sudokuCatalog.copy['zh-TW'].description],
    en: [sudokuCatalog.copy.en.title, sudokuCatalog.copy.en.description],
  },
  {
    id: 'tic-tac-toe',
    trainer: ticTacToeCatalog.trainer as 'brain',
    purpose: ticTacToeCatalog.category as 'higher-cognition',
    imagePath: `/assets/game-previews/tic-tac-toe/${ticTacToeCatalog.preview}`,
    kind: 'brain-route',
    path: '/thinking-training?game=tic-tac-toe',
    zh: [ticTacToeCatalog.copy['zh-TW'].title, ticTacToeCatalog.copy['zh-TW'].description],
    en: [ticTacToeCatalog.copy.en.title, ticTacToeCatalog.copy.en.description],
  },
  {
    id: 'connect4',
    trainer: connect4Catalog.trainer as 'brain',
    purpose: connect4Catalog.category as 'higher-cognition',
    imagePath: `/assets/game-previews/connect4/${connect4Catalog.preview}`,
    kind: 'brain-route',
    path: '/thinking-training?game=connect4',
    zh: [connect4Catalog.copy['zh-TW'].title, connect4Catalog.copy['zh-TW'].description],
    en: [connect4Catalog.copy.en.title, connect4Catalog.copy.en.description],
  },
  {
    id: 'dots-and-boxes',
    trainer: dotsAndBoxesCatalog.trainer as 'brain',
    purpose: dotsAndBoxesCatalog.category as 'higher-cognition',
    imagePath: `/assets/game-previews/dots-and-boxes/${dotsAndBoxesCatalog.preview}`,
    kind: 'brain-route',
    path: '/thinking-training?game=dots-and-boxes',
    zh: [dotsAndBoxesCatalog.copy['zh-TW'].title, dotsAndBoxesCatalog.copy['zh-TW'].description],
    en: [dotsAndBoxesCatalog.copy.en.title, dotsAndBoxesCatalog.copy.en.description],
  },
  {
    id: 'hex',
    trainer: hexCatalog.trainer as 'brain',
    purpose: hexCatalog.category as 'higher-cognition',
    imagePath: `/assets/game-previews/hex/${hexCatalog.preview}`,
    kind: 'brain-route',
    path: '/thinking-training?game=hex',
    zh: [hexCatalog.copy['zh-TW'].title, hexCatalog.copy['zh-TW'].description],
    en: [hexCatalog.copy.en.title, hexCatalog.copy.en.description],
  },
  {
    id: 'maze',
    trainer: mazeCatalog.trainer as 'brain',
    purpose: mazeCatalog.category as 'higher-cognition',
    imagePath: `/assets/game-previews/maze/${mazeCatalog.preview}`,
    kind: 'brain-route',
    path: '/thinking-training?game=maze',
    zh: [mazeCatalog.copy['zh-TW'].title, mazeCatalog.copy['zh-TW'].description],
    en: [mazeCatalog.copy.en.title, mazeCatalog.copy.en.description],
  },
  {
    id: 'tongue-catch',
    trainer: tongueCatchCatalog.trainer as 'mouth',
    purpose: tongueCatchCatalog.category as 'oral',
    imagePath: `/assets/game-previews/tongue-catch/${tongueCatchCatalog.preview}`,
    kind: 'mouth-oral',
    path: '/oral-training?game=tongue-catch',
    zh: [tongueCatchCatalog.copy['zh-TW'].title, tongueCatchCatalog.copy['zh-TW'].description],
    en: [tongueCatchCatalog.copy.en.title, tongueCatchCatalog.copy.en.description],
  },
  {
    id: 'seagull-flight',
    trainer: seagullFlightCatalog.trainer as 'vision',
    purpose: seagullFlightCatalog.category as 'vision',
    imagePath: `/assets/game-previews/seagull-flight/${seagullFlightCatalog.preview}`,
    kind: 'vision',
    path: '/?module=seagull-flight',
    zh: [seagullFlightCatalog.copy['zh-TW'].title, seagullFlightCatalog.copy['zh-TW'].description],
    en: [seagullFlightCatalog.copy.en.title, seagullFlightCatalog.copy.en.description],
  },
] as const;

export const trainingCatalog: readonly TrainingCatalogModule[] = seeds.map((seed) => {
  const catalogId = `${seed.trainer}:${seed.id}`;
  const flowManifest = GetTrainingModuleFlowManifest(catalogId);
  return {
    catalogId,
    runtimeId: seed.id,
    trainer: seed.trainer,
    category: seed.trainer,
    purpose: seed.purpose,
    subcategory: seed.purpose,
    kind: seed.kind,
    entryPath: seed.path,
    settingsPath: `/games/${seed.id}/settings.json`,
    imagePath: seed.imagePath ?? `/assets/training-modules/${seed.id}.webp`,
    flow: flowManifest.flow,
    mediaPermission: flowManifest.mediaPermission,
    sourcePath: flowManifest.sourcePath,
    copy: {
      'zh-TW': { title: seed.zh[0], description: seed.zh[1] },
      en: { title: seed.en[0], description: seed.en[1] },
    },
    titleKey: seed.titleKey,
    descriptionKey: seed.descriptionKey,
    referenceTitleKey: seed.referenceTitleKey,
    focusKey: seed.focusKey,
  };
});

export function GetTrainingCatalogModules(filters: {
  trainer?: TrainerCatalogId;
  purpose?: TrainingPurposeId;
  kind?: TrainingModuleKind;
} = {}): readonly TrainingCatalogModule[] {
  return trainingCatalog.filter((module) => (
    (!filters.trainer || module.trainer === filters.trainer)
    && (!filters.purpose || module.purpose === filters.purpose)
    && (!filters.kind || module.kind === filters.kind)
  ));
}

export function GetTrainingModuleCopy(
  module: TrainingCatalogModule,
  locale: 'zh' | 'zh-TW' | 'en',
): LocalizedTrainingCopy {
  return locale === 'en' ? module.copy.en : module.copy['zh-TW'];
}

export function BuildTrainingModuleHref(
  module: TrainingCatalogModule,
): string {
  const release = officialGameReleases[module.runtimeId as keyof typeof officialGameReleases];
  if (release) return `${release.origin}/games/${encodeURIComponent(module.runtimeId)}/`;
  return `/games/${encodeURIComponent(module.runtimeId)}/`;
}

export function BuildTrainingModuleSettingsHref(
  module: TrainingCatalogModule,
): string {
  return module.settingsPath;
}

export function BuildTrainingGameInstallHref(
  module: TrainingCatalogModule,
): string {
  return `/games/${encodeURIComponent(module.runtimeId)}/`;
}

export function BuildTrainingModuleImageSrc(
  module: TrainingCatalogModule,
): string {
  return `${defaultSiteUrls.hub}${module.imagePath}`;
}

export function BuildHubTrainingHref(module: TrainingCatalogModule): string {
  return `/train/?module=${encodeURIComponent(module.catalogId)}`;
}

export type TrainingThemeLookup =
  | { purpose?: string | null }
  | string
  | null
  | undefined;

export function GetTrainingModuleTheme(
  moduleOrPurposeId?: TrainingThemeLookup,
): TrainingVisualTheme {
  const purposeId = GetTrainingThemeId(moduleOrPurposeId);
  return purposeId ? trainingThemes[purposeId] : defaultTrainingTheme;
}

export function GetTrainerCategoryTheme(
  trainer?: TrainerCatalogId | string | null,
): TrainingVisualTheme {
  const themePurposeId = GetTrainerCategoryTag(trainer)?.themePurposeId;
  return themePurposeId
    ? GetTrainingModuleTheme(themePurposeId)
    : defaultTrainingTheme;
}

export function GetTrainingThemeId(
  moduleOrPurposeId?: TrainingThemeLookup,
): TrainingPurposeId | null {
  const purposeId = typeof moduleOrPurposeId === 'string'
    ? moduleOrPurposeId
    : moduleOrPurposeId?.purpose;
  if (!purposeId) return null;
  if (Object.hasOwn(trainingThemes, purposeId)) return purposeId as TrainingPurposeId;
  return trainingPurposes.find((theme) => (
    (theme as TrainingVisualTheme).aliases?.includes(purposeId)
  ))?.id ?? null;
}

export function GetTrainingPurpose(purposeId: TrainingPurposeId) {
  const theme = GetTrainingModuleTheme(purposeId);
  return {
    id: theme.id,
    label: theme.label['zh-TW'],
    labelEn: theme.label.en,
  };
}

export function GetTrainingModuleCategoryTag(module: TrainingCatalogModule) {
  return GetTrainerCategoryTag(module.trainer);
}

export function GetTrainingModuleCategoryLabel(
  module: TrainingCatalogModule,
  locale: 'zh' | 'zh-TW' | 'en',
): string {
  const tag = GetTrainerCategoryTag(module.trainer);
  if (!tag) return '';
  return locale === 'en' ? tag.label.en : tag.label['zh-TW'];
}

export function GetTrainingModuleSubcategoryLabel(
  module: TrainingCatalogModule,
  locale: 'zh' | 'zh-TW' | 'en',
): string {
  const theme = GetTrainingModuleTheme(module);
  return locale === 'en' ? theme.label.en : theme.label['zh-TW'];
}

export function GetPublishedGameCategoryTag(category: string | undefined | null) {
  const trainerId = GetTrainingPurposeTrainerId(category);
  return trainerId ? GetTrainerCategoryTag(trainerId) : null;
}

export function GetPublishedGameCategoryLabel(
  category: string | undefined | null,
  locale: 'zh' | 'zh-TW' | 'en',
): string {
  const tag = GetPublishedGameCategoryTag(category);
  if (!tag) return '';
  return locale === 'en' ? tag.label.en : tag.label['zh-TW'];
}

export function GetPublishedGameSubcategoryLabel(
  category: string | undefined | null,
  locale: 'zh' | 'zh-TW' | 'en',
): string {
  const theme = GetTrainingModuleTheme(category);
  return locale === 'en' ? theme.label.en : theme.label['zh-TW'];
}
