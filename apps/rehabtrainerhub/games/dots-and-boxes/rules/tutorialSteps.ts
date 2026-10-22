export function GetDotsTutorialSteps(lang: string) {
  return lang === 'en' ? [
    { target: '.db-line[data-tutorial="move"]', title: 'Tap between two dots', text: 'Tap the space between two neighboring dots to draw a line there. With a keyboard, move between lines with the arrow keys and press Enter.', place: 'bottom' },
    { target: '.db-score', title: 'Close a box, draw again', text: 'Drawing the fourth side of a box makes it yours, and you draw another line. Your boxes show a blue ring; the computer\'s show a rust dot. When every line is drawn, more boxes wins.', place: 'bottom' },
    { target: '.db-turn', title: 'Taking turns', text: 'If your line closes no box, the computer draws about 1 second later. It also draws again after closing a box. A tap on a line that is already drawn is counted.', place: 'bottom' },
    { target: '.db-stop', title: 'Time and stop', text: 'The bar shows the time so far. Stop or Escape ends the game without saving.', place: 'bottom' },
  ] : [
    { target: '.db-line[data-tutorial="move"]', title: '點兩點之間畫線', text: '點相鄰兩點之間的位置，就會在那裡畫一條線；用鍵盤時以方向鍵在線之間移動、按 Enter 畫線。', place: 'bottom' },
    { target: '.db-score', title: '完成方格再畫一次', text: '畫上方格的第四條邊，這一格就歸你，並且可以再畫一條。你的方格有藍色圓圈，電腦的是紅褐色圓點。所有線都畫完時，方格多的一方獲勝。', place: 'bottom' },
    { target: '.db-turn', title: '輪流畫線', text: '你畫的線沒有完成方格時，約 1 秒後換電腦畫。電腦完成方格也會再畫一次。點到已經畫好的線會記一次。', place: 'bottom' },
    { target: '.db-stop', title: '時間與停止', text: '上方顯示目前用時。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
