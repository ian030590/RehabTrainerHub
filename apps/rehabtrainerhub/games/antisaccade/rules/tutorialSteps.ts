export function GetAntisaccadeTutorialSteps(lang: string, exposureMs: number) {
  return lang === 'en' ? [
    { target: '.as-slot[data-tutorial="cue"]', title: 'Look away from the square', text: 'After a cross in the middle, a black square flashes on one side. Do not look at it. Look to the other side right away.', place: 'bottom' },
    { target: '.as-slot[data-tutorial="arrow"]', title: 'Catch the arrow', text: `An arrow appears on the side away from the square for ${exposureMs} ms, then a pattern covers it. Answer which way it pointed: left, up or right.`, place: 'bottom' },
    { target: '.as-pads', title: 'Three answer buttons', text: 'Tap a button or press the left, up or right arrow key. You can still answer while the pattern is showing, for 1 second. Here the arrow points up, so the answer is Up.', place: 'top' },
    { target: '.as-hud', title: 'Practice, progress and stop', text: 'Practice items come first, show right or wrong, and are not counted. Counted items show no feedback. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.as-slot[data-tutorial="cue"]', title: '不要看方塊', text: '中間先出現十字，接著一側會閃出黑色方塊。不要看它，馬上看向另一側。', place: 'bottom' },
    { target: '.as-slot[data-tutorial="arrow"]', title: '看清楚箭頭', text: `方塊的另一側會出現箭頭，只停留 ${exposureMs} 毫秒，接著被花紋蓋住。回答箭頭指向左、上還是右。`, place: 'bottom' },
    { target: '.as-pads', title: '三個作答按鈕', text: '按按鈕，或按鍵盤的左、上、右方向鍵。花紋出現的 1 秒內還可以作答。這裡箭頭指向上，所以要按「上」。', place: 'top' },
    { target: '.as-hud', title: '練習、進度與停止', text: '先做練習題，會提示對錯，不列入成果。正式題不提示對錯。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
