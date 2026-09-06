import { access, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ParseGameSettingsDefinition } from '../packages/game-settings/src/index.js';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const gamesRoot = resolve(repositoryRoot, 'apps/rehabtrainerhub/games');
const force = process.argv.includes('--force');
const sections = Sections;
const cognitiveSettings = CognitiveSettings;
const slider = Slider;
const list = List;
const checkbox = Checkbox;

const text = (zh, en) => ({ 'zh-TW': zh, en });
const option = (value, zh, en) => ({ value, label: text(zh, en) });
const difficulty = {
  key: 'difficulty',
  type: 'list',
  label: text('難度', 'Difficulty'),
  description: text('選擇這次活動的刺激與操作難度。', 'Choose the stimulus and control difficulty for this session.'),
  default: 'medium',
  options: [
    option('easy', '簡單', 'Easy'),
    option('medium', '中等', 'Medium'),
    option('hard', '困難', 'Hard'),
  ],
};
const duration = (defaultValue = 60, maximum = 300) => ({
  key: 'durationSec',
  type: 'slider',
  label: text('活動時間', 'Session duration'),
  description: text('設定這次活動進行的時間。', 'Set how long this activity will run.'),
  default: defaultValue,
  min: 30,
  max: maximum,
  step: 15,
  unit: text('秒', 'sec'),
});
const rounds = (defaultValue = 10, maximum = 40) => ({
  key: 'rounds',
  type: 'slider',
  label: text('回合數', 'Rounds'),
  description: text('設定這次活動要完成的回合數。', 'Set the number of rounds in this session.'),
  default: defaultValue,
  min: 5,
  max: maximum,
  step: 5,
  unit: text('回合', 'rounds'),
});
const sound = {
  key: 'soundEnabled',
  type: 'checkbox',
  label: text('聲音回饋', 'Sound feedback'),
  description: text('在操作與結果時播放提示音。', 'Play audio cues during interactions and results.'),
  default: true,
};
const timeLimit = {
  key: 'timeLimitSec',
  type: 'list',
  label: text('時間限制', 'Time limit'),
  description: text('選擇是否限制單次活動時間。', 'Choose a time limit for this session.'),
  default: 0,
  options: [
    option(0, '不限時', 'No limit'),
    option(60, '1 分鐘', '1 minute'),
    option(180, '3 分鐘', '3 minutes'),
    option(300, '5 分鐘', '5 minutes'),
  ],
};

const definitions = {
  'drawing-defense': sections('活動設定', 'Session settings', [difficulty, duration(60, 300), sound]),
  'asteroid-shield': sections('防護設定', 'Shield settings', [
    difficulty,
    duration(90, 300),
    slider('sensitivity', '移動靈敏度', 'Movement sensitivity', 5, 1, 10, 1),
    sound,
  ]),
  'gesture-battler': sections('手勢設定', 'Gesture settings', [
    slider('enemyMaxHp', '對手耐久度', 'Opponent durability', 10, 1, 100, 1),
    slider('holdDurationSec', '手勢維持時間', 'Gesture hold duration', 2, 0.5, 10, 0.5, '秒', 'sec'),
    slider('strictnessPercent', '辨識嚴格度', 'Recognition strictness', 70, 50, 90, 5, '%', '%'),
    list('targetMode', '目標模式', 'Target mode', 'free', [
      option('free', '自由手勢', 'Free gestures'),
      option('directed', '指定手勢', 'Directed gestures'),
    ]),
  ]),
  'motor-cortex-rehab': sections('目標設定', 'Target settings', [
    difficulty,
    list('drill', '移動路徑', 'Movement path', 'bounce', [
      option('bounce', '反彈追蹤', 'Bounce tracking'),
      option('vertical', '垂直移動', 'Vertical movement'),
      option('horizontal', '水平移動', 'Horizontal movement'),
      option('random', '隨機目標', 'Random targets'),
    ]),
    list('durationSec', '活動時間', 'Session duration', 60, [
      option(45, '45 秒', '45 seconds'), option(60, '60 秒', '60 seconds'), option(90, '90 秒', '90 seconds'),
    ]),
    slider('targetSizePercent', '目標大小', 'Target size', 100, 75, 130, 5, '%', '%'),
    slider('speedPercent', '移動速度', 'Movement speed', 100, 70, 140, 5, '%', '%'),
  ]),
  'moving-card': sections('卡片設定', 'Card settings', [difficulty, rounds(10, 40), sound]),
  'oculomotor-training': sections('移動刺激設定', 'Moving stimulus settings', [
    list('movementPath', '移動路徑', 'Movement path', 'horizontal', [
      option('horizontal', '水平', 'Horizontal'),
      option('vertical', '垂直', 'Vertical'),
      option('circle', '圓形', 'Circular'),
      option('random', '隨機', 'Random'),
    ]),
    duration(60, 300),
    slider('speed', '移動速度', 'Movement speed', 5, 1, 10, 1),
    slider('targetSize', '刺激大小', 'Stimulus size', 48, 24, 96, 4, 'px', 'px'),
    {
      key: 'targetColor',
      type: 'color',
      label: text('目標顏色', 'Target color'),
      default: '#76d900',
    },
  ], [
    checkbox('webgazerEnabled', '啟用鏡頭眼動追蹤', 'Enable camera gaze tracking', false),
    checkbox('gazePointVisible', '顯示注視點', 'Show gaze point', false),
  ]),
  'gabor-patching': sections('刺激設定', 'Stimulus settings', [
    difficulty,
    slider('durationSec', '刺激時間', 'Stimulus duration', 60, 30, 180, 15, '秒', 'sec'),
    slider('maxSpots', '最大刺激數', 'Maximum patches', 8, 3, 20, 1),
  ]),
  'reading-training': sections('閱讀設定', 'Reading settings', [
    slider('wordsPerMinute', '呈現速度', 'Presentation speed', 240, 60, 600, 20, '字／分', 'wpm'),
    slider('crowding', '文字間距', 'Text spacing', 100, 80, 180, 10, '%', '%'),
    slider('contrast', '文字對比', 'Text contrast', 100, 20, 100, 10, '%', '%'),
  ]),
  'driving-rehab': sections('模擬設定', 'Simulation settings', [
    difficulty,
    list('renderQuality', '畫面品質', 'Rendering quality', 'high', [
      option('high', '高', 'High'), option('medium', '中', 'Medium'), option('low', '低', 'Low'),
    ]),
    list('controlMode', '控制方式', 'Control method', 'arrow', [
      option('arrow', '方向鍵', 'Arrow keys'),
      option('wasd', 'WASD 鍵', 'WASD keys'),
      option('gamepad', '方向盤／控制器', 'Wheel or gamepad'),
      option('touch', '觸控', 'Touch'),
    ]),
    checkbox('redFlashEnabled', '危險紅光提示', 'Hazard red-flash cue', true),
  ]),
  'hart-chart': sections('視標設定', 'Chart settings', [
    slider('rounds', '往返次數', 'Alternations', 10, 5, 30, 5, '次', 'times'),
    list('chartSize', '視標大小', 'Chart size', 'medium', [
      option('large', '大', 'Large'), option('medium', '中', 'Medium'), option('small', '小', 'Small'),
    ]),
  ]),
  ufov: sections('活動設定', 'Session settings', [
    list('mode', '活動模式', 'Activity mode', 'practice', [
      option('practice', '練習模式', 'Practice'), option('formal', '正式模式', 'Formal'),
    ]),
    slider('trialCount', '測試次數', 'Trial count', 30, 10, 120, 10, '次', 'trials'),
    slider('contrastPercent', '刺激對比', 'Stimulus contrast', 100, 20, 100, 10, '%', '%'),
  ]),
  'every-ball-response': sections('活動設定', 'Session settings', [difficulty, rounds(20, 60), sound]),
  'reaction-time': sections('活動設定', 'Session settings', [difficulty, rounds(10, 50), timeLimit, sound]),
  'whack-a-mole': sections('活動設定', 'Session settings', [difficulty, duration(60, 300), sound]),
  'memory-match': sections('活動設定', 'Session settings', [difficulty, timeLimit, sound]),
  'simon-says': sections('活動設定', 'Session settings', [
    difficulty,
    slider('lives', '機會次數', 'Lives', 3, 1, 5, 1, '次', 'lives'),
    sound,
  ]),
  minesweeper: sections('盤面設定', 'Board settings', [
    difficulty,
    list('boardSize', '盤面大小', 'Board size', 'medium', [
      option('small', '小型 8×8', 'Small 8×8'),
      option('medium', '中型 12×12', 'Medium 12×12'),
      option('large', '大型 16×16', 'Large 16×16'),
    ]),
  ]),
  'lights-out': cognitiveSettings(),
  'sliding-puzzle': cognitiveSettings(),
  sudoku: cognitiveSettings(),
  'tic-tac-toe': cognitiveSettings(false),
  connect4: cognitiveSettings(false),
  'dots-and-boxes': cognitiveSettings(false),
  hex: cognitiveSettings(false),
  maze: cognitiveSettings(),
  'tongue-catch': sections('口部動作設定', 'Oral movement settings', [
    slider('sensitivityPercent', '動作靈敏度', 'Movement sensitivity', 65, 45, 95, 5, '%', '%'),
    duration(60, 300),
    slider('edgeChancePercent', '邊緣目標比例', 'Edge target ratio', 40, 0, 90, 5, '%', '%'),
  ]),
};

for (const [gameId, sectionList] of Object.entries(definitions)) {
  const definition = ParseGameSettingsDefinition({
    schemaVersion: 1,
    gameId,
    sections: sectionList,
  }, gameId);
  const gameDirectory = resolve(gamesRoot, gameId);
  const settingsPath = resolve(gameDirectory, 'settings.json');
  await mkdir(gameDirectory, { recursive: true });
  if (!force && await Exists(settingsPath)) {
    throw new Error(`Refusing to overwrite ${settingsPath}; pass --force to replace it.`);
  }
  await writeFile(settingsPath, `${JSON.stringify(definition, null, 2)}\n`, 'utf8');
}

console.log(`Scaffolded ${Object.keys(definitions).length} official game settings files.`);

function Sections(primaryZh, primaryEn, primaryFields, secondaryFields = []) {
  const result = [{
    id: 'training',
    title: text(primaryZh, primaryEn),
    description: text('設定值只用於這次活動。', 'These values apply only to this session.'),
    fields: primaryFields,
  }];
  if (secondaryFields.length > 0) {
    result.push({
      id: 'optional',
      title: text('選用功能', 'Optional features'),
      description: text('啟用前請確認裝置與環境適合使用。', 'Check that your device and environment are suitable before enabling these features.'),
      fields: secondaryFields,
    });
  }
  return result;
}

function CognitiveSettings(includeTimeLimit = true) {
  return sections('活動設定', 'Session settings', [
    difficulty,
    ...(includeTimeLimit ? [timeLimit] : []),
    sound,
  ]);
}

function Slider(key, zh, en, defaultValue, min, max, step, unitZh, unitEn) {
  return {
    key,
    type: 'slider',
    label: text(zh, en),
    default: defaultValue,
    min,
    max,
    step,
    ...(unitZh ? { unit: text(unitZh, unitEn) } : {}),
  };
}

function List(key, zh, en, defaultValue, options) {
  return { key, type: 'list', label: text(zh, en), default: defaultValue, options };
}

function Checkbox(key, zh, en, defaultValue) {
  return { key, type: 'checkbox', label: text(zh, en), default: defaultValue };
}

async function Exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
