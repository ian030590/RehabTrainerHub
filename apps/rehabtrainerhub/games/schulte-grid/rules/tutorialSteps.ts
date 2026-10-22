import type { SchulteSettings } from '../settings';

export function GetSchulteTutorialSteps(lang: string, settings: SchulteSettings) {
  const last = settings.gridSize * settings.gridSize;
  const [first, end] = settings.order === 'ascending' ? [1, last] : [last, 1];
  return lang === 'en' ? [
    { target: '.schulte-cell[data-start="true"]', title: `Start at ${first}`, text: `Tap the numbers in order, from ${first} to ${end}, as fast as you can. ${settings.markFound ? 'Each number you find fades.' : 'Numbers you find do not change, so keep track of where you are.'}`, place: 'bottom' },
    { target: '.schulte-next', title: 'Number to find', text: 'This shows the next number. A wrong tap is not penalised, but it is counted.', place: 'bottom' },
    { target: '.schulte-hud', title: 'Round, time and stop', text: 'The bar shows the round and the time so far. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.schulte-cell[data-start="true"]', title: `從 ${first} 開始`, text: `依序點數字，從 ${first} 點到 ${end}，越快越好。${settings.markFound ? '找到的數字會變淡。' : '找到的數字不會有標示，要自己記住找到哪裡。'}`, place: 'bottom' },
    { target: '.schulte-next', title: '下一個要找的數字', text: '這裡顯示下一個要點的數字。點錯不會扣分，但會記下次數。', place: 'bottom' },
    { target: '.schulte-hud', title: '回合、時間與停止', text: '上方顯示目前回合與用時。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
