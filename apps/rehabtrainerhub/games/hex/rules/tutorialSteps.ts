export function GetHexTutorialSteps(lang: string) {
  return lang === 'en' ? [
    { target: '.hx-cell[data-tutorial="move"]', title: 'Tap an empty cell', text: 'Your cells are blue with a ring; the computer\'s are rust red. Tap any empty cell to claim it. With a keyboard, move with the arrow keys and press Enter.', place: 'bottom' },
    { target: '.hx-edge-player', title: 'Join your two blue edges', text: 'Each cell touches the six around it. Build a chain of touching blue cells from this solid blue edge to the one opposite. The computer builds its chain between the two dashed rust edges.', place: 'bottom' },
    { target: '.hx-turn', title: 'Taking turns', text: 'About 1 second after your move, the computer claims a cell. Taps during its turn do nothing. A tap on a cell that is already taken is counted.', place: 'bottom' },
    { target: '.hx-stop', title: 'Time and stop', text: 'The bar shows the time so far. Stop or Escape ends the game without saving.', place: 'bottom' },
  ] : [
    { target: '.hx-cell[data-tutorial="move"]', title: '點空格下棋', text: '你的棋子是藍色帶圈，電腦是紅褐色。點任何空格放下你的棋子；用鍵盤時以方向鍵移動、按 Enter 下棋。', place: 'bottom' },
    { target: '.hx-edge-player', title: '接通兩條藍色邊', text: '每一格與周圍六格相鄰。用相連的藍色格子，從這條藍色實線邊連到對面那條。電腦要連接兩條紅褐色虛線邊。', place: 'bottom' },
    { target: '.hx-turn', title: '輪流下棋', text: '你下完約 1 秒後，電腦會下一步。電腦下棋時點棋盤不會有反應；點到已有棋子的格子會記一次。', place: 'bottom' },
    { target: '.hx-stop', title: '時間與停止', text: '上方顯示目前用時。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
