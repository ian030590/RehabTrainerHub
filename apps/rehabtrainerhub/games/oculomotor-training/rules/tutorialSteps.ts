export function GetOculomotorTutorialSteps(language: 'zh' | 'en', module: string) {
  const en = language === 'en';
  const instruction = en ? {
    vor: 'Keep looking at the central target as its color and number change.',
    pursuit: 'Follow the target moving from the center toward the selected screen edges.',
    saccade: 'Look toward the target as it jumps between positions in the three by three grid.',
    fixation: 'Follow the target to the edge, then keep looking at it during the hold.',
  } : {
    vor: '持續看著中央目標，目標的顏色與數字會依設定間隔變化。',
    pursuit: '跟隨目標，從中央往選定的螢幕邊緣移動。',
    saccade: '目標會在九宮格位置跳動，請將視線移向新的目標位置。',
    fixation: '跟隨目標移向邊緣，停留期間持續看著目標。',
  };
  return [
    { target: '.oculomotor-preview-target', title: en ? 'Watch the target' : '觀看目標', text: instruction[module as keyof typeof instruction], place: 'bottom' },
    { target: '.oculomotor-preview-directions', title: en ? 'Movement directions' : '移動方位', text: en ? 'Highlighted arrows are the selected directions. Central target recognition stays at the center. Timing and target size follow your settings.' : '亮起的箭頭是本次選定方位。中央目標辨識固定在中央；速度、時間與大小依本次設定。', place: 'top' },
    { target: '.oculomotor-preview-calibration', title: en ? 'Camera and calibration' : '相機與校正', text: en ? 'For WebGazer, allow camera access, keep your head still, complete nine points twice each and five validation points. Confirm physical screen size and viewing distance. No tracking skips camera and leaves gaze metrics missing.' : '使用 WebGazer 時先同意相機，頭部保持穩定，完成九點各兩次校正與五點驗證。請確認螢幕實際尺寸與觀看距離。不記錄模式不啟用相機，眼動指標保持缺測。', place: 'bottom' },
    { target: '.oculomotor-preview-stop', title: en ? 'Finish and results' : '結束與成果', text: en ? 'The activity ends at the set duration or evaluation target count. Escape ends the current activity. Results retain target count, timing and gaze quality; CSV storage can be retried.' : '達到設定時間或評估目標數後結束；Esc 可結束當次活動。成果保留目標數、時間與眼動品質，CSV 保存失敗可重試。', place: 'top' },
  ];
}
