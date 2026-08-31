import { zh as motorZh } from '../../motor/i18n/zh';

export const zh = {
  ...motorZh,
  'app.loading': '載入口腔練習...',
  'nav.brand': '口腔練習',
  'nav.logoAlt': '口腔練習圖示',
  'nav.comprehension': '理解訓練',
  'nav.oral': '口腔訓練',
  'nav.downloadScores': '下載紀錄',
  'nav.noScores': '目前沒有可下載的訓練紀錄。',
  'nav.scoresDownloadError': '無法讀取訓練紀錄，請稍後再試。',
  'mouth.oral.title': '口腔訓練',
  'mouth.oral.subtitle': '完成臉部與舌頭校正後，以舌頭方向進行互動練習。',
  'mouth.comprehension.title': '理解訓練',
  'mouth.comprehension.subtitle': '理解訓練模組正在規劃中。',
  'mouth.comprehension.body': '這個入口已準備好，之後會加入聽覺理解、詞語理解與日常情境理解練習。',
} as const;

export type TranslationKey = keyof typeof zh;
