export function GetLetterMemoryTutorialSteps(lang: string, exposureMs: number) {
  return lang === 'en' ? [
    { target: '.lm-letter', title: 'Letters one at a time', text: `After you press Start, letters appear here, ${exposureMs} ms each. Sequences have 5 to 11 letters, so you cannot tell when one will end.`, place: 'bottom' },
    { target: '.lm-entry', title: 'Only the last four', text: 'Keep the latest four letters in mind and drop older ones. If F J K N F L appears, the answer is K N F L. Saying the four to yourself as they change helps.', place: 'bottom' },
    { target: '.lm-keypad', title: 'Type them on the keypad', text: 'After the last letter, tap the letters in order or type them on the keyboard. ⌫ removes the last one, Clear removes them all.', place: 'top' },
    { target: '.lm-submit', title: 'Submit', text: 'Submit (or Enter) opens once four letters are in. There is no time limit; the time from the last letter to Submit is recorded.', place: 'top' },
    { target: '.lm-hud', title: 'Practice, progress and stop', text: 'Two practice sequences come first and show the right answer. They are not counted. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.lm-letter', title: '字母一個一個出現', text: `按「開始」後，字母會在這裡一個一個出現，每個 ${exposureMs} 毫秒。每題 5 到 11 個字母，看不出什麼時候結束。`, place: 'bottom' },
    { target: '.lm-entry', title: '只記最後 4 個', text: '一直記住最新的 4 個字母，舊的就放掉。例如出現 F J K N F L，答案是 K N F L。邊看邊在心裡默念最新的 4 個會比較好記。', place: 'bottom' },
    { target: '.lm-keypad', title: '用字母鍵輸入', text: '最後一個字母結束後，照順序點字母，或用鍵盤輸入。「⌫」去掉最後一個，「清除」全部重來。', place: 'top' },
    { target: '.lm-submit', title: '送出答案', text: '輸入 4 個字母後才能送出（也可按 Enter）。作答沒有時間限制，但會記錄從最後一個字母到送出的時間。', place: 'top' },
    { target: '.lm-hud', title: '練習、進度與停止', text: '先做 2 題練習，會顯示正確答案，不列入成果。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
