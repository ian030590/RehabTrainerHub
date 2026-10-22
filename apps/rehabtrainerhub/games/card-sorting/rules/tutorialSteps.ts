export function GetSortingTutorialSteps(lang: string, runLength: number) {
  return lang === 'en' ? [
    { target: '.sort-current-card', title: 'This is the card to sort', text: 'Put it on one of the four cards above. It can match by colour, by shape or by number of shapes, but you are not told which.', place: 'top' },
    { target: '.sort-keys', title: 'Work the rule out from the feedback', text: `Tap a card above, or press 1 to 4. After each card you see Correct or Wrong; use that to find the rule. After ${runLength} correct in a row the rule changes without warning, so switch to another way of matching.`, place: 'bottom' },
    { target: '.sort-hud', title: 'Progress and stop', text: 'The bar shows how many cards you have used. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.sort-current-card', title: '這是要分類的卡片', text: '把它放到上面四張卡片的其中一張。可以依顏色、形狀或圖形數量配對，但不會告訴你要用哪一種。', place: 'top' },
    { target: '.sort-keys', title: '從回饋找出規則', text: `點上面的卡片，或按 1 到 4。每放一張會顯示「對」或「不對」，靠它找出目前的規則。連續答對 ${runLength} 張後，規則會不預告地改變，這時要換一種配對方式。`, place: 'bottom' },
    { target: '.sort-hud', title: '進度與停止', text: '上方顯示已用了幾張卡片。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
