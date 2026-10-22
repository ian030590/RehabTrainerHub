export function GetNumberLetterTutorialSteps(lang: string) {
  return lang === 'en' ? [
    { target: '.number-letter-pair', title: 'A letter and a number', text: 'Each item is a letter and a number, such as G9, in one of the four boxes. Where it appears tells you what to judge.', place: 'bottom' },
    { target: '.number-letter-half-top', title: 'Top half: the number', text: 'In either top box, judge the number: odd (3, 5, 7, 9) or even (2, 4, 6, 8). Ignore the letter.', place: 'bottom' },
    { target: '.number-letter-half-bottom', title: 'Bottom half: the letter', text: 'In either bottom box, judge the letter: a vowel (A, E, I, U) or a consonant (G, K, M, R). Ignore the number.', place: 'top' },
    { target: '.number-letter-pads', title: 'Two answers', text: 'Left (Z or the left arrow) is odd or consonant. Right (M or the right arrow) is even or vowel. Answer as quickly and accurately as you can.', place: 'top' },
    { target: '.number-letter-progress-track', title: 'Parts, rests and stop', text: 'After practice come three parts: numbers only, letters only, then items moving clockwise so the rule keeps changing. Each part starts with its rule. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.number-letter-pair', title: '一個字母加一個數字', text: '每題是一個字母加一個數字，例如 G9，出現在四格中的一格。出現的位置決定你要判斷什麼。', place: 'bottom' },
    { target: '.number-letter-half-top', title: '上半部：看數字', text: '出現在上面兩格時，判斷數字是奇數（3、5、7、9）還是偶數（2、4、6、8），不用管字母。', place: 'bottom' },
    { target: '.number-letter-half-bottom', title: '下半部：看字母', text: '出現在下面兩格時，判斷字母是母音（A、E、I、U）還是子音（G、K、M、R），不用管數字。', place: 'top' },
    { target: '.number-letter-pads', title: '兩個答案', text: '左邊（Z 或 ←）是奇數或子音，右邊（M 或 →）是偶數或母音。請又快又準地作答。', place: 'top' },
    { target: '.number-letter-progress-track', title: '分段、休息與停止', text: '練習之後有三段：只有數字題、只有字母題，最後組合會順時針輪流出現，規則一直切換。每段開始前會顯示規則。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
