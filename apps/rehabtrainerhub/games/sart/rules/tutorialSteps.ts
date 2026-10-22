export function GetSartTutorialSteps(lang: string, noGoDigit: number) {
  return lang === 'en' ? [
    { target: '.sart-stimulus', title: 'Watch the digits', text: 'Digits from 1 to 9 appear one at a time at a steady pace. Each one shows briefly, then a circled cross covers it.', place: 'bottom' },
    { target: '.sart-response-pad', title: `Press for every digit except ${noGoDigit}`, text: `Press this button or the Space bar for each digit. When ${noGoDigit} appears, do not press. Respond quickly, but holding back on ${noGoDigit} matters just as much.`, place: 'top' },
    { target: '.sart-hud', title: 'Progress and stop', text: 'The bar shows how many digits are left. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.sart-stimulus', title: '看數字', text: '1 到 9 的數字會以固定節奏一個接一個出現，每個只停一下，接著被圓圈叉號蓋住。', place: 'bottom' },
    { target: '.sart-response-pad', title: `除了 ${noGoDigit}，每個都要按`, text: `每出現一個數字，就按這個按鈕或空白鍵。出現 ${noGoDigit} 時不要按。要按得快，也要在 ${noGoDigit} 出現時忍住。`, place: 'top' },
    { target: '.sart-hud', title: '進度與停止', text: '上方顯示還剩多少個數字。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
