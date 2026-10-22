export function GetStopSignalTutorialSteps(lang: string) {
  return lang === 'en' ? [
    { target: '.stop-signal-stimulus', title: 'Shape, and sometimes a star', text: 'One shape appears at a time. Two shapes go with the left button and two with the right. Sometimes a red star appears around the shape: then hold back and press nothing.', place: 'bottom' },
    { target: '.stop-signal-pads', title: 'Left or right', text: 'Tap a button, or press Z for left and M for right. During practice the buttons show their shapes. Press quickly; the star can come late, so you will not always manage to stop.', place: 'top' },
    { target: '.stop-signal-hud', title: 'Blocks, rests and stop', text: 'Practice comes first and shows right or wrong. Counted shapes come in blocks of 50 with a rest after each. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.stop-signal-stimulus', title: '形狀，有時加上星形', text: '形狀會一個一個出現，其中兩個形狀按左、兩個按右。有時形狀周圍會出現紅色星形，這時請停住，什麼都不要按。', place: 'bottom' },
    { target: '.stop-signal-pads', title: '按左或按右', text: '點按鈕，或用 Z 鍵按左、M 鍵按右。練習時按鈕上會顯示對應形狀。請快速按下；星形可能較晚出現，不一定每次都停得住。', place: 'top' },
    { target: '.stop-signal-hud', title: '分組、休息與停止', text: '先做練習，會提示對錯；正式形狀每 50 個一組，組間可休息。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
