export function GetPatternTutorialSteps(lang: string) {
  return lang === 'en' ? [
    { target: '.pattern-board', title: 'Remember the board', text: 'Coloured shapes appear in some of the nine squares for a moment. After a short blank, the board comes back.', place: 'bottom' },
    { target: '.pattern-answers', title: 'Same or changed?', text: 'Either nothing changed, or one shape changed its colour, its shape or its place. Choose Same (F or ←) or Changed (J or →). There is no time limit for answering.', place: 'top' },
    { target: '.pattern-hud', title: 'Shapes, progress and stop', text: 'The number of shapes rises after two right answers in a row and drops after a miss. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.pattern-board', title: '記住這個畫面', text: '九個格子中會短暫出現幾個彩色圖形。空白一下之後，畫面會再出現一次。', place: 'bottom' },
    { target: '.pattern-answers', title: '一樣還是有變？', text: '第二次的畫面可能完全一樣，也可能有一個圖形換了顏色、形狀或位置。選「一樣」（F 或 ←）或「有變」（J 或 →），作答沒有時間限制。', place: 'top' },
    { target: '.pattern-hud', title: '圖形數、進度與停止', text: '連續答對兩題會多一個圖形，答錯會少一個。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
