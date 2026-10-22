export function GetPlusMinusTutorialSteps(lang: string) {
  return lang === 'en' ? [
    { target: '.pm-number', title: 'One number at a time', text: 'A two-digit number appears here. Work out the answer with the current rule and enter it. The next number comes right after you submit.', place: 'bottom' },
    { target: '.pm-rule', title: 'Three lists, three rules', text: 'First list: add 3 to every number. Second list: subtract 3. Third list: add 3 and subtract 3 in turn, starting with add. For 27, 13, 40 the answers are 30, 10, 43.', place: 'bottom' },
    { target: '.pm-keypad', title: 'Enter the answer', text: 'Tap the keys or type on the keyboard. ⌫ removes the last digit. Answers have up to 3 digits.', place: 'top' },
    { target: '.pm-submit', title: 'Submit', text: 'Submit or Enter sends the answer. Go as quickly and accurately as you can; the time for every number is recorded.', place: 'top' },
    { target: '.pm-hud', title: 'Practice, progress and stop', text: 'First you copy 15 numbers to get used to the keys. They are not counted. Each list starts with its rule, so you can rest. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.pm-number', title: '數字一個一個出現', text: '這裡會出現一個二位數。依照目前的規則算出答案並輸入，送出後下一個數字馬上出現。', place: 'bottom' },
    { target: '.pm-rule', title: '三段、三種規則', text: '第一段每個數字加 3，第二段每個減 3，第三段加 3、減 3 輪流，第一個先加。例如 27、13、40，要答 30、10、43。', place: 'bottom' },
    { target: '.pm-keypad', title: '輸入答案', text: '點數字鍵，或用鍵盤輸入。「⌫」去掉最後一位。答案最多 3 位數。', place: 'top' },
    { target: '.pm-submit', title: '送出', text: '按「送出」或 Enter 交出答案。盡量又快又正確，每個數字的時間都會記錄。', place: 'top' },
    { target: '.pm-hud', title: '練習、進度與停止', text: '先照抄 15 個數字熟悉按鍵，不列入成果。每段開始前會顯示規則，可以先休息。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
