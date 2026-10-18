export function GetHartTutorialSteps(lang: string) {
  return lang === 'en' ? [
    { target: '.hart-chart-grid', title: 'Find the letter', text: 'The chart has 10 rows and 10 columns. Count from the top left to find the requested letter.', place: 'bottom' as const },
    { target: '.hart-decoder-panel', title: 'Decode the coordinates', text: 'Each field shows [row, column]. For [2,3], find row 2, then column 3. Type the letter; a correct entry moves to the next field. Complete all fields, then choose View Results.', place: 'top' as const },
    { target: '.hart-topbar-controls', title: 'Use the tools', text: 'Change the font size, toggle hints, or drag the decoder to an edge (arrow keys also work). The QR code opens the same chart on another screen. Reset Letters starts a new chart and timer. Escape stops without saving.', place: 'bottom' as const },
  ] : [
    { target: '.hart-chart-grid', title: '找到指定字母', text: '字母表有 10 列、10 欄。從左上角開始數，找出指定位置的字母。', place: 'bottom' as const },
    { target: '.hart-decoder-panel', title: '依座標解開暗號', text: '輸入框顯示［列,欄］。例如［2,3］先找第 2 列，再找第 3 欄。輸入正確字母後會跳到下一格；全部完成後按「查看成績」。', place: 'top' as const },
    { target: '.hart-topbar-controls', title: '使用輔助工具', text: '可調整字體、開關提示，或拖曳解碼器到邊緣（也可用方向鍵）。QR 碼可在另一個螢幕開啟相同字母表。「重設字母」會換表並重新計時；Escape 可停止且不保存。', place: 'bottom' as const },
  ];
}
