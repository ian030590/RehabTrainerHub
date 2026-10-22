export function GetSlidingTutorialSteps(lang: string, timeLimitSec: number, last: number) {
  const minutes = timeLimitSec / 60;
  return lang === 'en' ? [
    { target: '.sp-tile[data-tutorial="move"]', title: 'Tap a tile beside the gap', text: 'Tap a tile directly above, below, left or right of the gap and it slides into the gap. With a keyboard, move between tiles with the arrow keys and press Enter.', place: 'bottom' },
    { target: '.sp-goal', title: 'Put the numbers in order', text: `Arrange the tiles 1 to ${last} from left to right, top to bottom, with the gap in the bottom-right corner. A tap on a tile that is not beside the gap is counted.`, place: 'bottom' },
    { target: '.sp-clock', title: 'Time', text: timeLimitSec ? `You have ${minutes} minute${minutes === 1 ? '' : 's'}. The clock counts down; if the tiles are not in order when it reaches zero, the game ends.` : 'There is no time limit. The clock shows the time so far.', place: 'bottom' },
    { target: '.sp-stop', title: 'Stop', text: 'Stop or Escape ends the game without saving.', place: 'bottom' },
  ] : [
    { target: '.sp-tile[data-tutorial="move"]', title: '點空格旁的方塊', text: '點空格上下左右相鄰的方塊，它會滑進空格。用鍵盤時以方向鍵在方塊間移動、按 Enter。', place: 'bottom' },
    { target: '.sp-goal', title: '把數字排回順序', text: `由左到右、由上到下排成 1 到 ${last}，空格留在右下角。點到不在空格旁的方塊會記一次。`, place: 'bottom' },
    { target: '.sp-clock', title: '時間', text: timeLimitSec ? `限時 ${minutes} 分鐘，時間會倒數；時間到時還沒排好，這局就結束。` : '不限時，這裡顯示目前用時。', place: 'bottom' },
    { target: '.sp-stop', title: '停止', text: '按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
