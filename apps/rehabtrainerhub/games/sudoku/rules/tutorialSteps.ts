import type { PuzzleKind } from '../logic/numberGrid';
import { RuleText } from '../NumberBoard';

export function GetSudokuTutorialSteps(lang: string, timeLimitSec: number, kind: PuzzleKind, maxValue: number) {
  const minutes = timeLimitSec / 60;
  const en = lang === 'en';
  return en ? [
    { target: '.sk-cell[data-tutorial="move"]', title: 'Tap a blank cell', text: `Numbers on gray are given and cannot change. Each tap on a blank cell shows the next number, 1, 2, 3 and so on; a tap after ${maxValue} clears it. With a keyboard, move with the arrow keys, type a number, and press Backspace to clear.`, place: 'bottom' },
    { target: '.sk-rule', title: 'The rule', text: `${RuleText(kind, true)}. When every cell is filled but something breaks the rule, it is counted; find the cells to change.`, place: 'bottom' },
    { target: '.sk-clock', title: 'Time', text: timeLimitSec ? `You have ${minutes} minute${minutes === 1 ? '' : 's'}. The clock counts down; if the board is not finished when it reaches zero, the game ends.` : 'There is no time limit. The clock shows the time so far.', place: 'bottom' },
    { target: '.sk-stop', title: 'Stop', text: 'Stop or Escape ends the game without saving.', place: 'bottom' },
  ] : [
    { target: '.sk-cell[data-tutorial="move"]', title: '點空格填數字', text: `灰底的數字是題目給的，不能改。點空格會依序換成 1、2、3…，超過 ${maxValue} 再點一次就清空。用鍵盤時以方向鍵移動，按數字鍵直接填入，按 Backspace 清除。`, place: 'bottom' },
    { target: '.sk-rule', title: '規則', text: `${RuleText(kind, false)}。格子都填滿但有不符合規則的地方時會記一次，請找出要改的格子。`, place: 'bottom' },
    { target: '.sk-clock', title: '時間', text: timeLimitSec ? `限時 ${minutes} 分鐘，時間會倒數；時間到時還沒完成，這局就結束。` : '不限時，這裡顯示目前用時。', place: 'bottom' },
    { target: '.sk-stop', title: '停止', text: '按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
