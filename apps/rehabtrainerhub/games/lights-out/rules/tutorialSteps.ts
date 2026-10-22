export function GetLightsOutTutorialSteps(lang: string, timeLimitSec: number) {
  const minutes = timeLimitSec / 60;
  return lang === 'en' ? [
    { target: '.lo-cell[data-tutorial="move"]', title: 'Tap a cell', text: 'Lit cells are yellow with a bright bulb; dark cells are empty. A tap flips that cell and the cells directly above, below, left and right of it. With a keyboard, move with the arrow keys and press Enter.', place: 'bottom' },
    { target: '.lo-left', title: 'Turn every light off', text: 'This shows how many lights are still on. The board was scrambled from all dark, so every board can be solved. Each tap counts as one move.', place: 'bottom' },
    { target: '.lo-clock', title: 'Time', text: timeLimitSec ? `You have ${minutes} minute${minutes === 1 ? '' : 's'}. The clock counts down; if lights are still on when it reaches zero, the game ends.` : 'There is no time limit. The clock shows the time so far.', place: 'bottom' },
    { target: '.lo-stop', title: 'Stop', text: 'Stop or Escape ends the game without saving.', place: 'bottom' },
  ] : [
    { target: '.lo-cell[data-tutorial="move"]', title: '點一格切換亮滅', text: '亮的格子是黃色、中間有亮點；暗的格子是空的。點一格，這格和它上下左右相鄰的格子都會切換亮滅；用鍵盤時以方向鍵移動、按 Enter。', place: 'bottom' },
    { target: '.lo-left', title: '讓燈全部熄滅', text: '這裡顯示還亮著幾盞燈。題目是從全暗的棋盤打亂而來，每一題都解得開。每點一次記一步。', place: 'bottom' },
    { target: '.lo-clock', title: '時間', text: timeLimitSec ? `限時 ${minutes} 分鐘，時間會倒數；時間到時還有燈亮著，這局就結束。` : '不限時，這裡顯示目前用時。', place: 'bottom' },
    { target: '.lo-stop', title: '停止', text: '按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
