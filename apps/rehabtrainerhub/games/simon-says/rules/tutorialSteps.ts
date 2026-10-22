export function GetSimonTutorialSteps(lang: string, targetLength: number, lives: number) {
  return lang === 'en' ? [
    { target: '.ss-pad[data-tutorial="move"]', title: 'Watch the pads light up', text: 'The pads light up one at a time. A lit pad turns bright with a white ring. Each pad also has its own shape and number.', place: 'bottom' },
    { target: '.ss-status', title: 'Repeat the order', text: `When this says Your turn, tap the pads in the same order. With a keyboard, press 1 to 4. Each correct repeat adds one pad; repeat ${targetLength} pads to finish.`, place: 'bottom' },
    { target: '.ss-lives', title: `${lives} ${lives === 1 ? 'life' : 'lives'}`, text: 'A wrong pad costs one life and the same order plays again. The game ends when no lives are left.', place: 'bottom' },
    { target: '.ss-stop', title: 'Stop', text: 'Stop or Escape ends the game without saving.', place: 'bottom' },
  ] : [
    { target: '.ss-pad[data-tutorial="move"]', title: '看按鈕依序亮起', text: '按鈕會一個一個亮起，亮起時變亮並加上白框。每個按鈕也有自己的形狀和數字。', place: 'bottom' },
    { target: '.ss-status', title: '照順序重複', text: `這裡顯示「換你」時，照同樣的順序點按鈕；用鍵盤時按 1 到 4。每答對一次會多加一個，重複到 ${targetLength} 個就完成。`, place: 'bottom' },
    { target: '.ss-lives', title: `${lives} 條生命`, text: '點錯會少一條生命，並重播同一個順序；生命用完，這局就結束。', place: 'bottom' },
    { target: '.ss-stop', title: '停止', text: '按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
