export function GetDigitSpanTutorialSteps(lang: string) {
  return lang === 'en' ? [
    { target: '.digit-span-display', title: 'Digits one at a time', text: 'First you see how many digits are coming. Then the digits appear here one by one. Remember them in order without writing them down.', place: 'bottom' },
    { target: '.digit-span-keypad', title: 'Enter them on the keypad', text: 'After the last digit the keypad opens. Tap the digits, or type them on the keyboard. Delete removes the last digit, Clear removes them all, and Submit (or Enter) sends your answer.', place: 'top' },
    { target: '.digit-span-entry', title: 'Check your answer', text: 'What you have entered shows here before you submit. There is no time limit for typing.', place: 'bottom' },
    { target: '.digit-span-direction', title: 'Forward, then reverse', text: 'In the first half enter the digits in the same order. In the second half enter them in reverse, last digit first. Each half starts at 3 digits and grows by one after a correct answer.', place: 'bottom' },
    { target: '.digit-span-progress-track', title: 'Rests and stop', text: 'Each part starts with its rule, so you can rest. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.digit-span-display', title: '數字一個一個出現', text: '先顯示這題有幾個數字，接著數字會在這裡一個一個出現。請記住順序，不要抄寫。', place: 'bottom' },
    { target: '.digit-span-keypad', title: '用數字鍵輸入', text: '最後一個數字消失後，鍵盤就可以使用。點數字或用鍵盤輸入；「刪除」去掉最後一個，「清除」全部重來，「送出」（或 Enter）交出答案。', place: 'top' },
    { target: '.digit-span-entry', title: '確認你的答案', text: '輸入的數字會顯示在這裡，確認後再送出。輸入沒有時間限制。', place: 'bottom' },
    { target: '.digit-span-direction', title: '先順向，再逆向', text: '前一半照出現順序輸入，後一半倒過來輸入（最後一個先輸入）。兩段都從 3 個數字開始，答對就多一個。', place: 'bottom' },
    { target: '.digit-span-progress-track', title: '休息與停止', text: '每段開始前會顯示規則，可以先休息。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
