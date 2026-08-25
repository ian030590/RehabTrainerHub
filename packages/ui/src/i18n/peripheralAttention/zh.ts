import type { PeripheralAttentionConfigLabels, PeripheralAttentionCopy, PeripheralAttentionRuleSection } from './types';

export const peripheralAttentionZhCopy: PeripheralAttentionCopy = {
  title: '周邊注意力訓練',
  intro: '完成處理速度、分散注意力與選擇性注意力三階段活動。本活動為非醫療練習工具，結果不代表認知評估、診斷或治療建議。',
  restart: '重新開始',
  car: '汽車',
  truck: '卡車',
  correct: '正確',
  incorrect: '再試一次',
  trial: '題',
  results: '作答結果',
  aborted: '已中止',
  saveNote: '結果已存入 {appName} 訓練紀錄。',
  csvOnlyNote: '完整結果可下載為 CSV。',
  practiceResult: '練習答對',
  downloadCsv: '下載 CSV',
  backHome: '返回清單',
  backLobby: '返回大廳',
  actualProcessingSpeed: '刺激呈現時間參考值',
  tableTrial: '題次',
  tableVehicle: '題目車子種類',
  tableDirection: '外圍車子方向',
  tableCorrect: '答對與否',
  tableProcessingSpeed: '刺激實際呈現時間',
  directionAccuracy: '各方向答對率',
  contrastLabel: '對比度',
  anglesLabel: '偏心視角 / 車輛大小',
  noPeripheral: '無',
  directions: ['上', '右上', '右', '右下', '下', '左下', '左', '左上'],
  subtests: {
    1: 'Subtest 1 處理速度',
    2: 'Subtest 2 分散注意力',
    3: 'Subtest 3 選擇性注意力',
  },
  instructions: {
    1: '看著中央方框。刺激出現後，選出中央出現的是汽車或卡車。',
    2: '看著中央方框。刺激出現後，先選中央車輛，再選周邊目標出現的方向。',
    3: '看著中央方框。刺激出現後，在干擾物中辨識中央車輛，並選出周邊目標方向。',
  },
};

export const peripheralAttentionZhConfigLabels: PeripheralAttentionConfigLabels = {
  settingsTitle: '周邊注意力設定',
  chooseSubtest: '選擇 Subtest',
  chooseTrialCount: '選擇最大 Trial 數量',
  customTrialCount: '自訂',
  chooseDirections: '刺激呈現方向 (九宮格方位選擇)',
  chooseMode: '選擇流程',
  anglesTitle: '周邊偏心視角與車子大小',
  contrastTitle: '對比度控制 (Contrast)',
  contrastDesc: '調整底色控制對比，目標物始終為白色',
  contrastStrength: '對比度強度',
  contrastLow: '5% (極低對比/灰底)',
  contrastMid: '50% (中對比)',
  contrastHigh: '100% (高對比/純黑底)',
  eccentricityTitle: '周邊偏心視角 (Eccentricity)',
  eccentricityLow: '5.0° (中央偏近)',
  eccentricityMid: '20.0°',
  eccentricityHigh: '35.0° (周邊極限)',
  vehicleSizeTitle: '車子大小視角 (Vehicle Size)',
  vehicleSizeSmall: '0.8° (精細難)',
  vehicleSizeStandard: '2.5° (標準)',
  vehicleSizeLarge: '5.0° (清晰易)',
  directionsTitle: '刺激呈現方向 (九宮格方位選擇)',
  directionsDesc: '按照空間九宮格方位排列，點擊各方位開關或點擊中央快速全選',
  directionsBadge: '{n}/8 方向啟用',
  centerAll: '全選',
  centerAllActive: '全選中',
  geometryWarning: '當前偏心視角 ({targetAngle}°) 超過螢幕邊界最大視角 ({maxAngle}°)！建議將觀看距離調整為小於 {suggestedDistance} cm，或縮小視角拖動桿。',
  start: '開始',
  cancel: '取消',
  subtestUnavailable: '此裝置無法使用這個 subtest',
  subtests: {
    1: 'Subtest 1 處理速度',
    2: 'Subtest 2 分散注意力',
    3: 'Subtest 3 選擇性注意力',
  },
  instructions: {
    1: '辨認中央目標是汽車或卡車。',
    2: '辨認中央車輛，並指出周邊目標方向。',
    3: '在干擾物中辨認中央車輛，並指出周邊目標方向。',
  },
  modes: {
    instruction: { label: '說明', description: '只顯示練習說明，不計分。' },
    practice: { label: '練習', description: '以固定速度進行 5 題練習並顯示回饋。' },
    formal: { label: '紀錄練習', description: '進入 adaptive 練習並儲存結果。' },
  },
  directions: ['上', '右上', '右', '右下', '下', '左下', '左', '左上'],
};

export function GetPeripheralAttentionZhRuleSections(subtestTitle: string): PeripheralAttentionRuleSection[] {
  return [
    {
      title: '任務目標',
      description: `完成「${subtestTitle}」，辨識中央目標，必要時同時判斷周邊目標方向。`,
      items: [
        '每題先看中央刺激，判斷中央車輛是汽車或卡車。',
        '分散注意或選擇性注意題型中，還要回報周邊目標所在方向。',
        '練習模式會提供回饋；正式模式會穩定後提前停止，或跑到設定的最大題數。',
      ],
    },
    {
      title: '成績計算',
      description: '結算會記錄正確率、處理速度、方向反應與本次實際題數。',
    },
  ];
}

// Backward-compatibility exports
export function GetUfovZhRuleSections(subtestTitle: string): PeripheralAttentionRuleSection[] {
  return GetPeripheralAttentionZhRuleSections(subtestTitle);
}
