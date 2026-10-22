export function GetGoNoGoTutorialSteps(lang: string, goColor: 'orange' | 'blue') {
  const press = lang === 'en' ? goColor : goColor === 'orange' ? '橘色' : '藍色';
  const hold = lang === 'en' ? (goColor === 'orange' ? 'blue' : 'orange') : goColor === 'orange' ? '藍色' : '橘色';
  return lang === 'en' ? [
    { target: '.go-nogo-stimulus', title: 'Watch the square', text: `Orange and blue squares appear one at a time. This session you press for ${press} and hold back on ${hold}. Most squares are ${press}.`, place: 'bottom' },
    { target: '.go-nogo-pad', title: 'Press quickly, but not on every square', text: `Tap this button or press the Space bar as soon as a ${press} square appears. When a ${hold} square appears, do nothing.`, place: 'top' },
    { target: '.go-nogo-hud', title: 'Practice, progress and stop', text: 'Practice squares come first and show right or wrong. The counted squares give no feedback. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.go-nogo-stimulus', title: '注意色塊', text: `橘色和藍色方塊會一個一個出現。這次看到${press}要按，看到${hold}不要按。大多數方塊是${press}。`, place: 'bottom' },
    { target: '.go-nogo-pad', title: '快速按下，但不是每個都按', text: `出現${press}方塊時，盡快點這個按鈕或按空白鍵；出現${hold}方塊時，什麼都不要做。`, place: 'top' },
    { target: '.go-nogo-hud', title: '練習、進度與停止', text: '先做練習，會提示對錯；正式色塊不再提示。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
