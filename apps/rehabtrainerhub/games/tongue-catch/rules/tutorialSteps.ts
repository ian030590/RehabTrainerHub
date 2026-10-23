export function GetTongueTutorialSteps(lang: string) {
  return lang === 'en' ? [
    { target: '.tongue-preview-calibration', title: 'Calibrate three movements first', place: 'bottom',
      text: 'Before play you rest, extend your tongue left, then extend it right. Press Capture movement for each and hold it for about 2 seconds. Left and right are your own left and right; extend only as far as is comfortable.' },
    { target: '.tongue-preview-mouth', title: 'The tongue starts at your mouth', place: 'top',
      text: 'During play the tongue on screen starts where your mouth is in the camera image. Extend your tongue left or right and it grows that way; relax and it pulls back. The camera image is analyzed on this device and never recorded.' },
    { target: '.tongue-preview-apples', title: 'Catch the falling apples', place: 'bottom',
      text: 'Apples fall from the top. Touch one with the extended tongue to catch it; an apple that reaches the bottom is missed. A higher edge target ratio sends more apples to the sides.' },
    { target: '.tongue-hud', title: 'Time and stop', place: 'bottom',
      text: 'The top bar shows the time left and how many apples you caught and missed. The session ends when time runs out. Stop or Escape returns to the settings without saving this session.' },
  ] : [
    { target: '.tongue-preview-calibration', title: '先校正三個動作', place: 'bottom',
      text: '開始前依序做放鬆、舌頭向左、舌頭向右。每個動作按「擷取此動作」後維持約 2 秒。左右以你自己的方向為準，只在舒適、沒有不適的範圍內伸出。' },
    { target: '.tongue-preview-mouth', title: '舌頭從嘴巴伸出', place: 'top',
      text: '遊戲中，畫面上的舌頭從相機畫面裡你嘴巴的位置伸出。舌頭向左或向右伸，畫面上的舌頭就往那邊變長；放鬆時會縮回。相機畫面只在這台裝置上分析，不錄影。' },
    { target: '.tongue-preview-apples', title: '接住掉下來的蘋果', place: 'bottom',
      text: '蘋果會從上方掉下來，讓伸長的舌頭碰到蘋果就算接住；掉到畫面下方算漏接。邊緣目標比例越高，越多蘋果落在兩側。' },
    { target: '.tongue-hud', title: '時間與停止', place: 'bottom',
      text: '上方顯示剩餘時間、接住與漏接數。時間到會自動結束；按「停止」或 Esc 會回到設定，這次紀錄不保存。' },
  ];
}
