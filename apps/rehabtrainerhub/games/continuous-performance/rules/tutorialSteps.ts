import type { CptVariant } from '../settings';

export function GetCptTutorialSteps(lang: string, variant: CptVariant) {
  const ax = variant === 'ax';
  return lang === 'en' ? [
    { target: '.cpt-stimulus', title: 'Watch the letters', text: 'Letters appear one at a time in the middle of the screen, each for a moment, with a short gap between them. Most of them are not targets.', place: 'bottom' },
    { target: '.cpt-response-pad', title: ax ? 'Press only for X right after A' : 'Press only for X', text: ax
      ? 'Press this button or the Space bar when an X comes straight after an A. An A followed by another letter, or an X after any other letter, gets no press.'
      : 'Press this button or the Space bar each time X appears. Let every other letter go by. You can still press during the gap after the letter.', place: 'top' },
    { target: '.cpt-hud', title: 'Progress and stop', text: 'The bar shows how many letters are left. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.cpt-stimulus', title: '看字母', text: '字母會一個接一個出現在畫面中央，每個只停一下，中間有短暫空白。大部分字母都不是目標。', place: 'bottom' },
    { target: '.cpt-response-pad', title: ax ? '只有 A 後面緊接 X 才按' : '只有看到 X 才按', text: ax
      ? 'A 之後緊接著出現 X 時，按這個按鈕或空白鍵。A 後面接別的字母，或別的字母後面出現 X，都不要按。'
      : '每次出現 X 就按這個按鈕或空白鍵，其他字母都不要按。字母消失後的空白時間內按也算。', place: 'top' },
    { target: '.cpt-hud', title: '進度與停止', text: '上方顯示還剩多少個字母。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
