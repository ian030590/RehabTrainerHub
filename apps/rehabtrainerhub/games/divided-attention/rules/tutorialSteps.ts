export function GetDividedTutorialSteps(lang: string) {
  return lang === 'en' ? [
    { target: '.divided-target', title: 'Stay on the moving dot', text: 'The dot drifts around the box. Keep the mouse or a finger inside the dashed ring; the ring turns solid while you are on it. Arrow keys move a crosshair instead.', place: 'bottom' },
    { target: '.divided-math', title: 'Answer the sums at the same time', text: 'A sum appears here every few seconds. Tap an answer or press 1, 2 or 3. On a phone, keep one finger on the dot and tap with the other hand. A sum left unanswered disappears after a few seconds.', place: 'top' },
    { target: '.divided-hud', title: 'Time left and stop', text: 'The bar shows the time left. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.divided-target', title: '跟住移動的圓點', text: '圓點會在框內四處移動。用滑鼠或手指停在虛線圈裡，圈變成實線就是跟住了。也可以用方向鍵移動十字準星。', place: 'bottom' },
    { target: '.divided-math', title: '同時回答算式', text: '每隔幾秒這裡會出現一道算式，點選答案或按 1、2、3。手機上可以一手跟住圓點，另一手點答案。幾秒內沒回答，算式會自動消失。', place: 'top' },
    { target: '.divided-hud', title: '剩餘時間與停止', text: '上方顯示剩下的時間。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
