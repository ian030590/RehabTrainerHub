import { defaultSiteUrls, type SiteUrls } from './siteUrls';

export const trainingPurposes = [
  { id: 'upper-limb', label: '上肢動作', labelEn: 'Upper-limb movement' },
  { id: 'lower-limb', label: '下肢動作', labelEn: 'Lower-limb movement' },
  { id: 'vision', label: '視覺訓練', labelEn: 'Vision training' },
  { id: 'attention', label: '注意力訓練', labelEn: 'Attention training' },
  { id: 'memory', label: '記憶力訓練', labelEn: 'Memory training' },
  { id: 'higher-cognition', label: '高階認知訓練', labelEn: 'Higher cognition training' },
  { id: 'language', label: '語言訓練', labelEn: 'Language training' },
  { id: 'oral', label: '口腔訓練', labelEn: 'Oral training' },
] as const;

export type TrainingPurposeId = (typeof trainingPurposes)[number]['id'];
export type TrainerCatalogId = 'motor' | 'vision' | 'brain' | 'mouth';
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
  purpose: TrainingPurposeId;
  kind: TrainingModuleKind;
  entryPath: string;
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
    zh: ['動作皮質復健訓練', '追蹤手部位置，練習活動範圍、目標追蹤與隨機觸達。'],
    en: ['Motor Cortex Rehab', 'Track hand position to practise range of motion, target tracking, and random reaches.'],
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
    zh: ['駕駛認知復健模擬器', '在送貨任務中回應突發事件，練習駕駛視覺注意與反應。'],
    en: ['Driving Cognitive Rehab Simulator', 'Respond to hazards during a delivery route to practise driving attention and reactions.'],
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
    path: '/attention-training/ufov',
    zh: ['UFOV 注意力測驗', '練習處理速度、分散注意力與選擇性注意力。'],
    en: ['UFOV Attention Test', 'Practise processing speed, divided attention, and selective attention.'],
    titleKey: 'module.attention.ufov.title',
    descriptionKey: 'module.attention.ufov.body',
  },
  {
    id: 'every-ball-response',
    trainer: 'brain',
    purpose: 'attention',
    kind: 'brain-route',
    path: '/attention-training/every-ball-response',
    zh: ['有球必應', '依球類拍手、拍大腿或抑制反應，練習注意與反應控制。'],
    en: ['Every Ball Gets a Response', 'Clap, tap, or inhibit a response according to the ball to practise attention control.'],
    titleKey: 'module.attention.everyBall.title',
    descriptionKey: 'module.attention.everyBall.body',
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
    id: 'main-concept',
    trainer: 'brain',
    purpose: 'higher-cognition',
    kind: 'brain-route',
    path: '/thinking-training/main-concept',
    zh: ['主旨概念訓練', '閱讀敘事內容，辨識支持主旨的句子與必要元素。'],
    en: ['Main Concept Training', 'Read narratives and identify sentences and elements that support the main concept.'],
    titleKey: 'module.thinking.mainConcept.title',
    descriptionKey: 'module.thinking.mainConcept.body',
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
    id: 'bulls-and-cows',
    trainer: 'brain',
    purpose: 'higher-cognition',
    kind: 'brain-reference',
    path: '/thinking-training?game=bulls-and-cows',
    zh: ['猜數字', '根據位置與數字提示推理出答案。'],
    en: ['Bulls and Cows', 'Use position and digit feedback to reason out the answer.'],
    titleKey: 'cognitive.bulls.title',
    descriptionKey: 'cognitive.bulls.desc',
    referenceTitleKey: 'cognitive.bulls.referenceTitle',
    focusKey: 'cognitive.bulls.focus',
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
    id: 'set-game',
    trainer: 'brain',
    purpose: 'higher-cognition',
    kind: 'brain-reference',
    path: '/thinking-training?game=set-game',
    zh: ['Set 圖卡', '依多項特徵找出全同或全異的三張圖卡。'],
    en: ['Set Game', 'Find three cards whose features are each all the same or all different.'],
    titleKey: 'cognitive.set.title',
    descriptionKey: 'cognitive.set.desc',
    referenceTitleKey: 'cognitive.set.referenceTitle',
    focusKey: 'cognitive.set.focus',
  },
  {
    id: 'sokoban',
    trainer: 'brain',
    purpose: 'higher-cognition',
    kind: 'brain-reference',
    path: '/thinking-training?game=sokoban',
    zh: ['推箱子', '規劃路徑將箱子推到目標位置。'],
    en: ['Sokoban', 'Plan a route and push every box onto a target.'],
    titleKey: 'cognitive.sokoban.title',
    descriptionKey: 'cognitive.sokoban.desc',
    referenceTitleKey: 'cognitive.sokoban.referenceTitle',
    focusKey: 'cognitive.sokoban.focus',
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

export const trainingCatalog: readonly TrainingCatalogModule[] = seeds.map((seed) => ({
  catalogId: `${seed.trainer}:${seed.id}`,
  runtimeId: seed.id,
  trainer: seed.trainer,
  purpose: seed.purpose,
  kind: seed.kind,
  entryPath: seed.path,
  copy: {
    'zh-TW': { title: seed.zh[0], description: seed.zh[1] },
    en: { title: seed.en[0], description: seed.en[1] },
  },
  titleKey: seed.titleKey,
  descriptionKey: seed.descriptionKey,
  referenceTitleKey: seed.referenceTitleKey,
  focusKey: seed.focusKey,
}));

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
  urls: SiteUrls = defaultSiteUrls,
): string {
  return `${urls[module.trainer]}/#${module.entryPath}`;
}

export function GetTrainingPurpose(purposeId: TrainingPurposeId) {
  return trainingPurposes.find((purpose) => purpose.id === purposeId) ?? trainingPurposes[0];
}
