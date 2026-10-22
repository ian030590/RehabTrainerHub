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
  | 'brain-reference'
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
    trainer: 'brain',
    purpose: 'attention',
    kind: 'brain-route',
    path: '/attention-training?game=ufov',
    zh: ['周邊視野訓練', '以三階段活動練習處理速度、分散注意力與選擇性注意力。'],
    en: ['Peripheral Visual Field Training', 'Use a three-stage activity to practise processing speed, divided attention, and selective attention.'],
    titleKey: 'module.attention.ufov.title',
    descriptionKey: 'module.attention.ufov.body',
  },
  {
    id: 'every-ball-response',
    trainer: 'brain',
    purpose: 'attention',
    kind: 'brain-route',
    path: '/attention-training?game=every-ball-response',
    zh: ['有球必應', '依球類拍手、拍大腿或抑制反應，練習注意與反應控制。'],
    en: ['Every Ball Gets a Response', 'Clap, tap, or inhibit a response according to the ball to practise attention control.'],
    titleKey: 'module.attention.everyBall.title',
    descriptionKey: 'module.attention.everyBall.body',
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
    trainer: 'brain',
    purpose: 'attention',
    kind: 'brain-route',
    path: '/attention-training?game=antisaccade',
    zh: ['反向眼跳抑制（Antisaccade）', '當閃爍提示出現時抑制看向該處的衝動，轉向相反一側辨識目標箭頭，訓練前額葉反射抑制能力。'],
    en: ['Antisaccade Task', 'Suppress reflexive saccades toward sudden visual flashes and orient attention to the opposite side to identify targets.'],
    titleKey: 'training.antisaccade.title',
    descriptionKey: 'training.antisaccade.desc',
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
    trainer: 'brain',
    purpose: 'attention',
    kind: 'brain-reference',
    path: '/attention-training?game=whack-a-mole',
    zh: ['目標點擊', '在時限內點擊目標，練習視覺搜尋、注意轉移與手眼協調。'],
    en: ['Target Click', 'Click timed targets to practise visual search, attention shifting, and hand-eye coordination.'],
    titleKey: 'cognitive.whack.title',
    descriptionKey: 'cognitive.whack.desc',
    referenceTitleKey: 'cognitive.whack.referenceTitle',
    focusKey: 'cognitive.whack.focus',
  },
  {
    id: 'memory-match',
    trainer: 'brain',
    purpose: 'memory',
    kind: 'brain-reference',
    path: '/memory-training?game=memory-match',
    zh: ['記憶配對', '翻開卡片尋找相同圖案，練習短期記憶與視覺掃描。'],
    en: ['Memory Match', 'Find matching cards to practise short-term memory and visual scanning.'],
    titleKey: 'cognitive.memory.title',
    descriptionKey: 'cognitive.memory.desc',
    referenceTitleKey: 'cognitive.memory.referenceTitle',
    focusKey: 'cognitive.memory.focus',
  },
  {
    id: 'simon-says',
    trainer: 'brain',
    purpose: 'memory',
    kind: 'brain-reference',
    path: '/memory-training?game=simon-says',
    zh: ['順序記憶', '觀看並重複逐漸變長的顏色順序。'],
    en: ['Simon Says', 'Watch and repeat progressively longer color sequences.'],
    titleKey: 'cognitive.simon.title',
    descriptionKey: 'cognitive.simon.desc',
    referenceTitleKey: 'cognitive.simon.referenceTitle',
    focusKey: 'cognitive.simon.focus',
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
    trainer: 'brain',
    purpose: 'memory',
    kind: 'brain-route',
    path: '/memory-training?game=letter-memory',
    zh: ['字母記憶更新（Letter Memory）', '持續注視連續字母流並即時更新心中的最後 4 個字母，訓練工作記憶動態更新與抗干擾能力。'],
    en: ['Letter Memory Task', 'Continuously monitor a running stream of letters and update the last 4 letters in working memory.'],
    titleKey: 'training.lettermemory.title',
    descriptionKey: 'training.lettermemory.desc',
  },
  {
    id: 'keep-track',
    trainer: 'brain',
    purpose: 'memory',
    kind: 'brain-route',
    path: '/memory-training?game=keep-track',
    zh: ['類別記憶追蹤（Keep Track）', '在多類別單詞流中同時維持並更新多個指定目標類別的最後單詞，訓練多工工作記憶更新容量。'],
    en: ['Keep Track Task', 'Concurrently maintain and update the most recent exemplar across multiple target categories in a rapid word stream.'],
    titleKey: 'training.keeptrack.title',
    descriptionKey: 'training.keeptrack.desc',
  },
  {
    id: 'minesweeper',
    trainer: 'brain',
    purpose: 'higher-cognition',
    kind: 'brain-route',
    path: '/thinking-training?game=minesweeper',
    zh: ['踩地雷', '依線索開格與標記地雷，練習視覺掃描、推理與策略判斷。'],
    en: ['Minesweeper', 'Use clues to open cells and mark mines, practising visual scanning and strategic reasoning.'],
    titleKey: 'training.minesweeper.title',
    descriptionKey: 'training.minesweeper.desc',
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
    trainer: 'brain',
    purpose: 'higher-cognition',
    kind: 'brain-route',
    path: '/thinking-training?game=plus-minus',
    zh: ['心算加減切換（Plus-Minus）', '進行純加法、純減法與交替運算區塊，透過大按鈕快速計算，評估心智運算規則轉換的耗損（Shift Cost）。'],
    en: ['Plus-Minus Arithmetic Switching', 'Complete pure addition, subtraction, and alternating switch blocks to measure mental set shifting costs.'],
    titleKey: 'training.plusminus.title',
    descriptionKey: 'training.plusminus.desc',
  },
  {
    id: 'lights-out',
    trainer: 'brain',
    purpose: 'higher-cognition',
    kind: 'brain-reference',
    path: '/thinking-training?game=lights-out',
    zh: ['熄燈解題', '切換格子與相鄰格的狀態，練習邏輯推理與問題分解。'],
    en: ['Lights Out', 'Toggle cells and their neighbors to practise logical reasoning and problem decomposition.'],
    titleKey: 'cognitive.lights.title',
    descriptionKey: 'cognitive.lights.desc',
    referenceTitleKey: 'cognitive.lights.referenceTitle',
    focusKey: 'cognitive.lights.focus',
  },
  {
    id: 'sliding-puzzle',
    trainer: 'brain',
    purpose: 'higher-cognition',
    kind: 'brain-reference',
    path: '/thinking-training?game=sliding-puzzle',
    zh: ['滑塊拼圖', '移動方塊還原順序，練習規劃、空間推理與步驟控制。'],
    en: ['Sliding Puzzle', 'Restore tile order to practise planning, spatial reasoning, and step control.'],
    titleKey: 'cognitive.sliding.title',
    descriptionKey: 'cognitive.sliding.desc',
    referenceTitleKey: 'cognitive.sliding.referenceTitle',
    focusKey: 'cognitive.sliding.focus',
  },
  {
    id: 'sudoku',
    trainer: 'brain',
    purpose: 'higher-cognition',
    kind: 'brain-reference',
    path: '/thinking-training?game=sudoku',
    zh: ['數獨', '完成拉丁方格、魔術方陣或數獨，練習規則維持與推理。'],
    en: ['Sudoku', 'Complete Latin Square, Magic Square, or Sudoku tasks to practise rule-based reasoning.'],
    titleKey: 'cognitive.sudoku.title',
    descriptionKey: 'cognitive.sudoku.desc',
    referenceTitleKey: 'cognitive.sudoku.referenceTitle',
    focusKey: 'cognitive.sudoku.focus',
  },
  {
    id: 'tic-tac-toe',
    trainer: 'brain',
    purpose: 'higher-cognition',
    kind: 'brain-reference',
    path: '/thinking-training?game=tic-tac-toe',
    zh: ['圈圈叉叉', '規劃連線並預測電腦行動。'],
    en: ['Tic Tac Toe', 'Plan a line while anticipating the computer response.'],
    titleKey: 'cognitive.tictactoe.title',
    descriptionKey: 'cognitive.tictactoe.desc',
    referenceTitleKey: 'cognitive.tictactoe.referenceTitle',
    focusKey: 'cognitive.tictactoe.focus',
  },
  {
    id: 'connect4',
    trainer: 'brain',
    purpose: 'higher-cognition',
    kind: 'brain-reference',
    path: '/thinking-training?game=connect4',
    zh: ['四子棋', '投入棋子並規劃四子連線。'],
    en: ['Connect 4', 'Drop discs and plan a four-piece connection.'],
    titleKey: 'cognitive.connect4.title',
    descriptionKey: 'cognitive.connect4.desc',
    referenceTitleKey: 'cognitive.connect4.referenceTitle',
    focusKey: 'cognitive.connect4.focus',
  },
  {
    id: 'dots-and-boxes',
    trainer: 'brain',
    purpose: 'higher-cognition',
    kind: 'brain-reference',
    path: '/thinking-training?game=dots-and-boxes',
    zh: ['點格成盒', '連線完成方盒，練習預測與策略選擇。'],
    en: ['Dots and Boxes', 'Complete boxes with lines to practise prediction and strategy selection.'],
    titleKey: 'cognitive.dots.title',
    descriptionKey: 'cognitive.dots.desc',
    referenceTitleKey: 'cognitive.dots.referenceTitle',
    focusKey: 'cognitive.dots.focus',
  },
  {
    id: 'hex',
    trainer: 'brain',
    purpose: 'higher-cognition',
    kind: 'brain-reference',
    path: '/thinking-training?game=hex',
    zh: ['Hex 連線棋', '連接兩側邊界並阻擋對手路徑。'],
    en: ['Hex', 'Connect opposite sides while blocking the computer path.'],
    titleKey: 'cognitive.hex.title',
    descriptionKey: 'cognitive.hex.desc',
    referenceTitleKey: 'cognitive.hex.referenceTitle',
    focusKey: 'cognitive.hex.focus',
  },
  {
    id: 'maze',
    trainer: 'brain',
    purpose: 'higher-cognition',
    kind: 'brain-reference',
    path: '/thinking-training?game=maze',
    zh: ['迷宮', '在隨機迷宮中規劃從起點到終點的路徑。'],
    en: ['Maze', 'Plan a route from start to goal through a generated maze.'],
    titleKey: 'cognitive.maze.title',
    descriptionKey: 'cognitive.maze.desc',
    referenceTitleKey: 'cognitive.maze.referenceTitle',
    focusKey: 'cognitive.maze.focus',
  },
  {
    id: 'tongue-catch',
    trainer: 'mouth',
    purpose: 'oral',
    kind: 'mouth-oral',
    path: '/oral-training?game=tongue-catch',
    zh: ['舌頭動作訓練', '辨識舌頭左右伸出方向，練習口腔肌肉控制與動作維持。'],
    en: ['Tongue Movement Training', 'Recognize left and right tongue movement to practise oral control and sustained movement.'],
    titleKey: 'tongue.title',
    descriptionKey: 'tongue.desc',
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
