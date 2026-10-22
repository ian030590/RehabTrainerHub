export function GetBlinkTutorialSteps(lang: string) {
  return lang === 'en' ? [
    { target: '.blink-stimulus', title: 'Watch the fast stream', text: 'Each round, a stream of letters flashes in the middle of the screen. Two digits are hidden in it. Keep your eyes on the middle and remember both digits.', place: 'bottom' },
    { target: '.blink-keypad', title: 'Give the two digits in order', text: 'When the stream ends, tap the first digit, then the second. Number keys work too. If you are not sure, take a guess.', place: 'top' },
    { target: '.blink-hud', title: 'Progress and stop', text: 'The bar shows how many rounds are left. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.blink-stimulus', title: '看快速閃過的字', text: '每回會有一串字母在畫面中央快速閃過，裡面夾著兩個數字。眼睛盯著中央，記住這兩個數字。', place: 'bottom' },
    { target: '.blink-keypad', title: '依序回答兩個數字', text: '字串結束後，先點第一個數字，再點第二個數字，也可以按鍵盤數字鍵。沒把握也猜一個。', place: 'top' },
    { target: '.blink-hud', title: '進度與停止', text: '上方顯示還剩幾回。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
