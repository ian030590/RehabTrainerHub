export function GetMinesweeperTutorialSteps(lang: string, mines: number) {
  const en = lang === 'en';
  return en ? [
    { target: '.ms-cell[data-tutorial="move"]', title: 'Open a cell', text: 'Tap a covered cell to open it. The first cell you open is never a mine, and an area with no mines around it opens all at once. With a keyboard, move with the arrow keys and press Enter.', place: 'bottom' },
    { target: '.ms-cell[data-tutorial="number"]', title: 'Number clues', text: `A number is how many mines touch that cell, corners included. There are ${mines} mines. Open every safe cell to finish; opening a mine ends the game.`, place: 'bottom' },
    { target: '.ms-flag-mode', title: 'Flags', text: 'Turn on flag mode, then tap a cell to place or remove a flag. A right click or the F key does the same. A flagged cell will not open. The counter at the top shows flags and mines.', place: 'top' },
    { target: '.ms-zoom', title: 'Zoom', text: 'Use − and + to zoom the board; the percentage button goes back to 100%. On a phone, pinch with two fingers; on a computer, use the mouse wheel. Scroll to see the rest of a zoomed board.', place: 'top' },
    { target: '.ms-stop', title: 'Stop', text: 'There is no time limit; the clock shows the time so far. Stop or Escape ends the game without saving.', place: 'bottom' },
  ] : [
    { target: '.ms-cell[data-tutorial="move"]', title: '打開格子', text: '點一下蓋著的格子就會打開。第一格一定不是地雷，周圍沒有地雷的空白區會一起打開。用鍵盤時以方向鍵移動，按 Enter 打開。', place: 'bottom' },
    { target: '.ms-cell[data-tutorial="number"]', title: '數字線索', text: `數字是這格周圍 8 格裡的地雷數，斜角也算。這盤有 ${mines} 顆地雷。打開所有安全格就完成；打開地雷，這局就結束。`, place: 'bottom' },
    { target: '.ms-flag-mode', title: '插旗', text: '打開標記模式後，點格子會插旗或拔旗；按右鍵或鍵盤 F 鍵也可以。插旗的格子不會被打開。上方會顯示旗數與地雷數。', place: 'top' },
    { target: '.ms-zoom', title: '縮放', text: '按 − 和 + 縮放棋盤，按中間的百分比回到 100%。手機可用雙指縮放，電腦可用滑鼠滾輪。放大後捲動就能看到其他地方。', place: 'top' },
    { target: '.ms-stop', title: '停止', text: '這局不限時，上方顯示目前用時。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
