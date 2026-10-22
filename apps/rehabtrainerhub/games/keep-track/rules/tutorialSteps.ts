export function GetKeepTrackTutorialSteps(lang: string, exposureMs: number) {
  return lang === 'en' ? [
    { target: '.kt-answer', title: 'The categories to track', text: 'Each block starts by listing 3 to 5 target categories here. They stay on screen for the whole block. Press "Got them, start" when you are ready.', place: 'top' },
    { target: '.kt-word', title: 'Words one at a time', text: `Words from all six categories appear here, ${exposureMs} ms each. For each target category, keep only its latest word in mind. Ignore the other categories.`, place: 'bottom' },
    { target: '.kt-row[data-tutorial="example"]', title: 'Pick the last one', text: 'Example: Animals showed Fish, then later Bird, so the answer is Bird. After the last word, pick one word in every target category.', place: 'top' },
    { target: '.kt-submit', title: 'Submit', text: 'Submit opens once every category has a pick. There is no time limit; the time from the last word to Submit is recorded.', place: 'top' },
    { target: '.kt-hud', title: 'Practice, progress and stop', text: 'A practice block comes first and shows the right answers. It is not counted. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.kt-answer', title: '這組要記的類別', text: '每組開始時，這裡會列出 3 到 5 個要記的類別，整組都留在畫面上。準備好就按「記住了，開始」。', place: 'top' },
    { target: '.kt-word', title: '詞一個一個出現', text: `六個類別的詞會輪流出現在這裡，每個 ${exposureMs} 毫秒。每個要記的類別，只記住它最新出現的那個詞，其他類別不用管。`, place: 'bottom' },
    { target: '.kt-row[data-tutorial="example"]', title: '選最後出現的', text: '例如動物先出現「魚」，後來又出現「鳥」，答案就是「鳥」。最後一個詞結束後，每個要記的類別各選一個。', place: 'top' },
    { target: '.kt-submit', title: '送出答案', text: '每個類別都選好後才能送出。作答沒有時間限制，但會記錄從最後一個詞到送出的時間。', place: 'top' },
    { target: '.kt-hud', title: '練習、進度與停止', text: '先做 1 組練習，送出後會顯示正確答案，不列入成果。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
