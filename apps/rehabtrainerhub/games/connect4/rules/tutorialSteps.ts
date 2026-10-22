export function GetConnect4TutorialSteps(lang: string) {
  return lang === 'en' ? [
    { target: '.c4-column[data-tutorial="move"]', title: 'Tap a column', text: 'Your discs are blue with a ring; the computer\'s are rust red. Tap any column and your disc drops to its lowest empty slot. With a keyboard, pick a column with the left and right arrows and press Enter.', place: 'bottom' },
    { target: '.c4-goal', title: '4 in a row wins', text: 'Rows, columns and diagonals all count. The game also ends if the computer makes 4 in a row first, or if all 42 slots fill with no line.', place: 'bottom' },
    { target: '.c4-turn', title: 'Taking turns', text: 'About 1 second after your move, the computer drops its disc. Taps during its turn do nothing. A tap on a full column is counted.', place: 'bottom' },
    { target: '.c4-stop', title: 'Time and stop', text: 'The bar shows the time so far. Stop or Escape ends the game without saving.', place: 'bottom' },
  ] : [
    { target: '.c4-column[data-tutorial="move"]', title: '點一欄投入棋子', text: '你的棋子是藍色帶圈，電腦是紅褐色。點任一欄，棋子會落到該欄最下面的空位；用鍵盤時以左右鍵選欄、按 Enter 投入。', place: 'bottom' },
    { target: '.c4-goal', title: '連成 4 個獲勝', text: '橫、直、斜都算。電腦先連成 4 個，或 42 格都下滿沒人連成，這局也會結束。', place: 'bottom' },
    { target: '.c4-turn', title: '輪流下棋', text: '你投入後約 1 秒，電腦會投入它的棋子。電腦下棋時點棋盤不會有反應；點到已滿的欄位會記一次。', place: 'bottom' },
    { target: '.c4-stop', title: '時間與停止', text: '上方顯示目前用時。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
