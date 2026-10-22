export function GetFlankerTutorialSteps(lang: string, stimulus: 'arrows' | 'letters') {
  const arrows = stimulus === 'arrows';
  return lang === 'en' ? [
    { target: '.flanker-row', title: 'Only the middle one counts', text: arrows
      ? 'A row of five arrows appears. Answer the direction of the middle arrow. The arrows on each side sometimes point the same way and sometimes the other way.'
      : 'A row of five letters appears. Answer whether the middle letter is F or H. The letters on each side sometimes match it and sometimes do not.', place: 'bottom' },
    { target: '.flanker-pads', title: 'Two answer buttons', text: arrows
      ? 'Left: tap the left button, F or the left arrow key. Right: tap the right button, J or the right arrow key. Here the middle arrow points right, so the answer is Right.'
      : 'F: tap the left button or press F. H: tap the right button or press H. Here the middle letter is H, so the answer is H.', place: 'top' },
    { target: '.flanker-hud', title: 'Practice, progress and stop', text: 'Practice items come first and are not counted. Each answer shows right or wrong for a moment. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.flanker-row', title: '只看中間那一個', text: arrows
      ? '畫面會出現一排五個箭頭，回答中間箭頭的方向。兩側箭頭有時方向相同，有時相反。'
      : '畫面會出現一排五個字母，回答中間的字母是 F 還是 H。兩側字母有時相同，有時不同。', place: 'bottom' },
    { target: '.flanker-pads', title: '兩個作答按鈕', text: arrows
      ? '向左：按左邊按鈕、F 或左方向鍵；向右：按右邊按鈕、J 或右方向鍵。這裡中間箭頭指向右，所以要按「右」。'
      : 'F：按左邊按鈕或 F 鍵；H：按右邊按鈕或 H 鍵。這裡中間的字母是 H，所以要按「H」。', place: 'top' },
    { target: '.flanker-hud', title: '練習、進度與停止', text: '先做練習題，不列入成果。每次作答後會短暫顯示對錯。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
