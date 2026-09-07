import { defaultSiteUrls } from '@rehab-trainer/ui/siteUrls';
import {
  GetTrainingModuleFlowManifest,
  type TrainingFlowStep,
  type TrainingMediaPermission,
} from './moduleFlowManifest';
import {
  GetTrainerCategoryTag,
  GetTrainingPurposeTrainerId,
  IsTrainerCategoryId,
  categorySubcategories,
  majorCategoryIds,
  majorCategoryTags,
  trainerCategoryTags,
} from './gameTags.js';
import type { TrainerCategoryId, MajorCategoryId } from './gameTags.js';

export {
  GetTrainerCategoryTag,
  GetTrainingPurposeTrainerId,
  IsTrainerCategoryId,
  categorySubcategories,
  majorCategoryIds,
  majorCategoryTags,
  trainerCategoryTags,
};
export type { MajorCategoryId, TrainerCategoryId };

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
    trainer: 'motor',
    purpose: 'upper-limb',
    kind: 'motor-upper',
    path: '/upper-limb-training?game=drawing-defense',
    zh: ['畫畫塔防', '繪製指定圖形，練習上肢精細動作與手眼協調。'],
    en: ['Drawing Tower Defense', 'Draw prompted shapes to practise fine upper-limb movement and hand-eye coordination.'],
    titleKey: 'training.drawing.title',
    descriptionKey: 'training.drawing.desc',
  },
  {
    id: 'asteroid-shield',
    trainer: 'motor',
    purpose: 'upper-limb',
    kind: 'motor-upper',
    path: '/upper-limb-training?game=asteroid-shield',
    zh: ['小行星護盾防衛', '移動護盾保護飛船，練習手部定位與上肢控制。'],
    en: ['Asteroid Shield Defense', 'Move a shield to protect the ship and practise hand positioning and upper-limb control.'],
    titleKey: 'training.asteroidShield.title',
    descriptionKey: 'training.asteroidShield.desc',
  },
  {
    id: 'gesture-battler',
    trainer: 'motor',
    purpose: 'upper-limb',
    kind: 'motor-upper',
    path: '/upper-limb-training?game=gesture-battler',
    zh: ['手勢指令對戰', '辨識數字手勢完成指令，練習手部活動範圍與動作維持。'],
    en: ['Gesture Command Battle', 'Use number gestures to issue commands and practise hand range and sustained movement.'],
    titleKey: 'training.gesture.title',
    descriptionKey: 'training.gesture.desc',
  },
  {
    id: 'motor-cortex-rehab',
    trainer: 'motor',
    purpose: 'upper-limb',
    kind: 'motor-upper',
    path: '/upper-limb-training?game=motor-cortex-rehab',
    zh: ['手部目標追蹤練習', '追蹤手部位置，練習活動範圍、目標追蹤與隨機觸達。'],
    en: ['Hand Target Tracking Practice', 'Track hand position to practise range of motion, target tracking, and random reaches.'],
  },
  {
    id: 'moving-card',
    trainer: 'vision',
    purpose: 'vision',
    kind: 'vision',
    path: '/?module=moving-card',
    zh: ['移動卡片訓練', '在移動卡片中尋找目標，練習視覺搜尋與動態專注。'],
    en: ['Moving Card Training', 'Find targets among moving cards to practise visual search and dynamic attention.'],
    titleKey: 'home.module.movingCard.title',
    descriptionKey: 'home.module.movingCard.desc',
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
    trainer: 'vision',
    purpose: 'vision',
    kind: 'vision',
    path: '/?module=gabor-patching',
    zh: ['蓋伯斑塊練習', '尋找逐漸浮現的蓋伯斑塊，練習對比辨識與視覺反應。'],
    en: ['Gabor Patching', 'Find emerging Gabor patches to practise contrast recognition and visual response.'],
    titleKey: 'home.module.gaborPatching.title',
    descriptionKey: 'home.module.gaborPatching.desc',
  },
  {
    id: 'reading-training',
    trainer: 'vision',
    purpose: 'vision',
    kind: 'vision',
    path: '/?module=reading-training',
    zh: ['閱讀訓練（RSVP）', '使用快速連續視覺呈現練習閱讀速度與文章理解。'],
    en: ['Reading Training (RSVP)', 'Use rapid serial visual presentation to practise reading speed and comprehension.'],
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
    trainer: 'vision',
    purpose: 'vision',
    kind: 'vision',
    path: '/?module=hart-chart',
    zh: ['哈特圖訓練', '透過遠近交替聚焦與座標解碼練習調焦、跳視與定位。'],
    en: ['Hart Chart Training', 'Alternate near and far focus to practise accommodation, saccades, and localization.'],
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
    trainer: 'brain',
    purpose: 'attention',
    kind: 'brain-route',
    path: '/attention-training?game=stroop',
    zh: ['色彩干擾抑制（Stroop）', '辨識文字印刷顏色並抑制字義干擾，練習選擇性注意力與衝動抑制。'],
    en: ['Color Word Interference (Stroop)', 'Identify font color while suppressing word meaning to practise selective attention and response inhibition.'],
    titleKey: 'training.stroop.title',
    descriptionKey: 'training.stroop.desc',
  },
  {
    id: 'flanker',
    trainer: 'brain',
    purpose: 'attention',
    kind: 'brain-route',
    path: '/attention-training?game=flanker',
    zh: ['側翼干擾選擇（Flanker）', '辨識中央箭頭指向並忽略兩側干擾，練習視覺聚焦與干擾抑制。'],
    en: ['Flanker Selective Attention', 'Identify center arrow direction while ignoring flanking distractors to practise focus and interference suppression.'],
    titleKey: 'training.flanker.title',
    descriptionKey: 'training.flanker.desc',
  },
  {
    id: 'go-nogo',
    trainer: 'brain',
    purpose: 'attention',
    kind: 'brain-route',
    path: '/attention-training?game=go-nogo',
    zh: ['通行與抑制反應（Go/No-go）', '看到通行訊號時反應，看到禁止訊號時抑制衝動，練習持續專注與抑制控制。'],
    en: ['Go / No-Go Sustained Attention', 'Respond to Go signals and withhold responses to Stop signals to practise sustained attention and impulse control.'],
    titleKey: 'training.gonogo.title',
    descriptionKey: 'training.gonogo.desc',
  },
  {
    id: 'stop-signal',
    trainer: 'brain',
    purpose: 'attention',
    kind: 'brain-route',
    path: '/attention-training?game=stop-signal',
    zh: ['煞車抑制反應（Stop-Signal）', '看到箭頭時快速反應方向，看到煞車警示時立即收手制動，練習動作衝動抑制與專注控制。'],
    en: ['Stop-Signal Response Inhibition', 'Respond to directional arrows and immediately cancel responses when a stop signal appears to practise inhibitory control.'],
    titleKey: 'training.stopsignal.title',
    descriptionKey: 'training.stopsignal.desc',
  },
  {
    id: 'attention-network-task',
    trainer: 'brain',
    purpose: 'attention',
    kind: 'brain-route',
    path: '/attention-training?game=attention-network-task',
    zh: ['注意力網絡測驗（ANT）', '注視中央箭頭並抑制側翼干擾，結合空間提示與衝突判斷，測驗警覺、定向與執行控制網絡。'],
    en: ['Attention Network Task (ANT)', 'Determine central arrow direction under spatial cues and flanker conflicts to evaluate alerting, orienting, and executive attention.'],
    titleKey: 'training.attentionnetworktask.title',
    descriptionKey: 'training.attentionnetworktask.desc',
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
    trainer: 'brain',
    purpose: 'attention',
    kind: 'brain-reference',
    path: '/attention-training?game=reaction-time',
    zh: ['反應時間', '等待訊號後快速點擊，練習注意力維持與反應控制。'],
    en: ['Reaction Time', 'Wait for a signal and respond quickly to practise sustained attention and response control.'],
    titleKey: 'cognitive.reaction.title',
    descriptionKey: 'cognitive.reaction.desc',
    referenceTitleKey: 'cognitive.reaction.referenceTitle',
    focusKey: 'cognitive.reaction.focus',
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
    trainer: 'brain',
    purpose: 'memory',
    kind: 'brain-route',
    path: '/memory-training?game=n-back',
    zh: ['工作記憶更新（N-back）', '觀察連續出現的圖形並比對前 N 個項目，練習工作記憶動態更新與維持容量。'],
    en: ['Working Memory Updating (N-back)', 'Observe symbols and compare with N steps back to practise working memory updating and capacity.'],
    titleKey: 'training.nback.title',
    descriptionKey: 'training.nback.desc',
  },
  {
    id: 'digit-span',
    trainer: 'brain',
    purpose: 'memory',
    kind: 'brain-route',
    path: '/memory-training?game=digit-span',
    zh: ['數字廣度記憶（Digit Span）', '記住依序出現的數字串並依順向或逆向重現，練習短期記憶與心智操作廣度。'],
    en: ['Digit Span Memory Capacity', 'Memorize presented digit sequences and recall them in forward or backward order to train working memory span.'],
    titleKey: 'training.digitspan.title',
    descriptionKey: 'training.digitspan.desc',
  },
  {
    id: 'spatial-span',
    trainer: 'brain',
    purpose: 'memory',
    kind: 'brain-route',
    path: '/memory-training?game=spatial-span',
    zh: ['空間廣度記憶（Spatial Span）', '記住九宮格中方塊依序亮起的空間位置並重現，練習視覺空間工作記憶與路徑維持。'],
    en: ['Spatial Span Memory Capacity', 'Memorize the sequence of highlighted spatial blocks and recall them to train visuospatial working memory.'],
    titleKey: 'training.spatialspan.title',
    descriptionKey: 'training.spatialspan.desc',
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
    trainer: 'brain',
    purpose: 'higher-cognition',
    kind: 'brain-route',
    path: '/thinking-training?game=tower-of-london',
    zh: ['倫敦塔規劃（Tower of London）', '依柱子容量限制移動彩球達成目標排列，練習前額葉執行功能、問題解決與心智預先規劃。'],
    en: ['Tower of London Planning', 'Move colored balls across capacity-constrained pegs to match the target goal, training executive planning and problem solving.'],
    titleKey: 'training.toweroflondon.title',
    descriptionKey: 'training.toweroflondon.desc',
  },
  {
    id: 'number-letter',
    trainer: 'brain',
    purpose: 'higher-cognition',
    kind: 'brain-route',
    path: '/thinking-training?game=number-letter',
    zh: ['數字字母切換（Number-Letter）', '根據四象限位置切換「數字奇偶」與「字母母子音」分類規則，測驗認知彈性與任務切換耗損。'],
    en: ['Number-Letter Task', 'Switch between number parity and letter vocalization rules based on screen quadrant, assessing cognitive flexibility and switch costs.'],
    titleKey: 'training.numberletter.title',
    descriptionKey: 'training.numberletter.desc',
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
    imagePath: `/assets/training-modules/${seed.id}.webp`,
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
