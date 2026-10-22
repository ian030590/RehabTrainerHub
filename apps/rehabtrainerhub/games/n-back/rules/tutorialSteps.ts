export function GetNBackTutorialSteps(lang: string) {
  return lang === 'en' ? [
    { target: '.n-back-letter', title: 'One letter at a time', text: 'Letters appear one by one, in upper or lower case. Each block tells you how far back to compare: with "2 back" you compare each letter with the one two places earlier. Case does not matter.', place: 'bottom' },
    { target: '.n-back-rule', title: 'The rule stays here', text: 'This shows the rule for the current block. One block has no comparing: answer "Same" for every t or T. Practice uses 1 back.', place: 'bottom' },
    { target: '.n-back-pads', title: 'Same or different', text: 'Tap "Same" (left arrow or F) when the letter matches, otherwise "Different" (down arrow or J). Answer every letter.', place: 'top' },
    { target: '.n-back-progress-track', title: 'Blocks, rests and stop', text: 'Practice comes first and shows right or wrong. Before each block a screen shows its rule, so you can rest. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.n-back-letter', title: '字母一個一個出現', text: '字母會依序出現，有大寫也有小寫。每組會告訴你要比對前幾個：例如「前 2 個」就是和兩個之前出現的字母比較，不分大小寫。', place: 'bottom' },
    { target: '.n-back-rule', title: '規則一直顯示在這裡', text: '這裡顯示這一組的規則。其中一組不用比對：看到 t 或 T 就按「相同」。練習是比對前 1 個。', place: 'bottom' },
    { target: '.n-back-pads', title: '相同或不同', text: '字母相同就按「相同」（← 或 F），不同就按「不同」（↓ 或 J）。每個字母都要回答。', place: 'top' },
    { target: '.n-back-progress-track', title: '分組、休息與停止', text: '先做練習，會提示對錯。每組開始前會顯示該組規則，可以先休息。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
