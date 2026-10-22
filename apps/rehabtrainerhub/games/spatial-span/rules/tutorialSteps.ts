export function GetSpatialSpanTutorialSteps(lang: string) {
  return lang === 'en' ? [
    { target: '.spatial-span-lit', title: 'Squares light one at a time', text: 'First you see how many squares are coming. Then squares on the board light up one after another. Remember the order.', place: 'bottom' },
    { target: '.spatial-span-actions', title: 'Tap them back', text: 'When the last square goes dark, tap the squares in order. Undo removes the last tap, Clear starts again, and Submit (or Enter) sends your answer.', place: 'top' },
    { target: '.spatial-span-entry', title: 'Count your taps', text: 'This shows how many squares you have tapped. There is no time limit for tapping. After a wrong answer, numbers on the board show the right order.', place: 'top' },
    { target: '.spatial-span-direction', title: 'Forward, then reverse', text: 'In the first half tap in the same order. In the second half tap in reverse, last square first. Each half starts at 3 squares and grows by one after a correct answer.', place: 'bottom' },
    { target: '.spatial-span-progress-track', title: 'Rests and stop', text: 'Each part starts with its rule, so you can rest. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.spatial-span-lit', title: '方格一個一個亮起', text: '先顯示這題有幾個方格，接著方格會一個接一個亮起。請記住亮起的順序。', place: 'bottom' },
    { target: '.spatial-span-actions', title: '依序點回去', text: '最後一格暗下後，依順序點方格。「刪除」去掉最後一次點選，「清除」全部重來，「送出」（或 Enter）交出答案。', place: 'top' },
    { target: '.spatial-span-entry', title: '點了幾個', text: '這裡顯示已點幾個方格，點選沒有時間限制。答錯時，方格上會標出正確順序。', place: 'top' },
    { target: '.spatial-span-direction', title: '先順向，再逆向', text: '前一半照亮起順序點，後一半倒過來點（最後亮的先點）。兩段都從 3 個方格開始，答對就多一個。', place: 'bottom' },
    { target: '.spatial-span-progress-track', title: '休息與停止', text: '每段開始前會顯示規則，可以先休息。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
