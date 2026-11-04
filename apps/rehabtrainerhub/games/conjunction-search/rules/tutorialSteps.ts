export function GetSearchTutorialSteps(lang: string) {
  return lang === 'en' ? [
    { target: '.search-target-circle', title: 'Remember the green target', text: 'Find a letter with both the shape and green colour shown in the orange circle. Blue letters of the same shape and green letters of another shape do not count. The example inside the circle does not count.', place: 'bottom' },
    { target: '.search-pads', title: 'Is the target present?', text: 'Present: left pad, F or Left Arrow. Absent: right pad, J or Right Arrow. Missing the time limit counts as wrong. Each answer gives brief text and sound feedback.', place: 'top' },
    { target: '.search-hud', title: 'Three blocks with breaks', text: 'Search 8, 16, then 24 letters. Take a break between blocks and continue when ready. Reach 85% in at least two blocks to pass. Stop or Escape exits without saving.', place: 'bottom' },
  ] : [
    { target: '.search-target-circle', title: '記住綠色目標', text: '在圈外找出字形與顏色都和橘圈內相同的綠色字。同形的藍字、同色的其他字形都不算目標。橘圈內的範例也不算。', place: 'bottom' },
    { target: '.search-pads', title: '圈外有沒有目標？', text: '有：按左邊按鈕、F 或左方向鍵；沒有：按右邊按鈕、J 或右方向鍵。超時算答錯，每題結束會以文字和音效提示對錯。', place: 'top' },
    { target: '.search-hud', title: '三段與休息', text: '依序搜尋 8、16、24 個字，每段之間可休息，準備好再繼續。至少兩段正確率達 85% 就通過。停止或 Esc 會離開，這次紀錄不保存。', place: 'bottom' },
  ];
}
