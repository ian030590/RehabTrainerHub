import type { HartCharacterSet } from '../settings';

export function GetHartTutorialSteps(lang: string, characterSet: HartCharacterSet = 'english') {
  const chinese = characterSet === 'chinese';
  return lang === 'en' ? [
    { target: '.hart-chart-grid', title: chinese ? 'Find the character' : 'Find the letter', text: `The chart has 10 rows and 10 columns. Count from the top left to find the requested ${chinese ? 'character' : 'letter'}.`, place: 'bottom' as const },
    { target: '.hart-decoder-panel', title: 'Decode the coordinates', text: `Each field shows [column, row]. For [3,2], count 3 columns from the left, then 2 rows down. ${chinese ? 'Type the character with a Chinese input method' : 'Type the letter'}; a correct entry moves to the next field. Complete all fields, then choose View Results.`, place: 'top' as const },
    { target: '.hart-topbar-controls', title: 'Use the tools', text: `Change the font size, toggle hints, or drag the decoder to an edge (arrow keys also work). The QR code opens the same chart on another screen. ${chinese ? 'Reset Characters' : 'Reset Letters'} starts a new chart and timer. Escape stops without saving.`, place: 'bottom' as const },
  ] : [
    { target: '.hart-chart-grid', title: chinese ? '找到指定的字' : '找到指定字母', text: `${chinese ? '字表' : '字母表'}有 10 列、10 欄。從左上角開始數，找出指定位置的${chinese ? '字' : '字母'}。`, place: 'bottom' as const },
    { target: '.hart-decoder-panel', title: '依座標解開暗號', text: `輸入框顯示［欄,列］。例如［3,2］從左邊數到第 3 欄，再往下數到第 2 列。${chinese ? '用輸入法打出正確的字' : '輸入正確字母'}後會跳到下一格；全部完成後按「查看成績」。`, place: 'top' as const },
    { target: '.hart-topbar-controls', title: '使用輔助工具', text: `可調整字體、開關提示，或拖曳解碼器到邊緣（也可用方向鍵）。QR 碼可在另一個螢幕開啟相同${chinese ? '字表' : '字母表'}。「${chinese ? '重置字表' : '重置字母'}」會換表並重新計時；Escape 可停止且不保存。`, place: 'bottom' as const },
  ];
}
