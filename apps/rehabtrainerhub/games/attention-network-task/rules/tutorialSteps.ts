export function GetAntTutorialSteps(lang: string) {
  return lang === 'en' ? [
    { target: '.ant-slot-center', title: 'Keep your eyes on the cross', text: 'Look at the centre cross the whole time. Just before the arrows, a star sometimes flashes: in the centre, above and below, or where the arrows are about to appear.', place: 'bottom' },
    { target: '.ant-row-up', title: 'Only the middle arrow counts', text: 'A row of five then appears above or below the cross. Judge only the middle arrow. The others can be plain bars, arrows pointing the same way, or arrows pointing the other way.', place: 'bottom' },
    { target: '.ant-pads', title: 'Answer left or right', text: 'Tap a button, or press the left or right arrow key (F and J also work). Answer quickly and accurately.', place: 'top' },
    { target: '.ant-hud', title: 'Practice, blocks and stop', text: 'Practice comes first and shows right or wrong. Counted items come in blocks of 48 with a rest after each. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.ant-slot-center', title: '一直注視中央十字', text: '請全程看著中央的十字。箭頭出現前，有時會短暫閃現星號：在中央、上下各一個，或在箭頭即將出現的位置。', place: 'bottom' },
    { target: '.ant-row-up', title: '只看中間的箭頭', text: '接著一排五個符號會出現在十字上方或下方。只判斷最中間的箭頭；兩側可能是橫線、同方向箭頭或反方向箭頭。', place: 'bottom' },
    { target: '.ant-pads', title: '按左或按右', text: '點按鈕，或按鍵盤左右方向鍵（F、J 也可以）。請又快又正確。', place: 'top' },
    { target: '.ant-hud', title: '練習、分組與停止', text: '先做練習，會提示對錯；正式題目每 48 題一組，組間可休息。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
