export function GetMotorTutorialSteps(lang: 'zh' | 'en') {
  const en = lang === 'en';
  return [
    { target: '.motor-cortex-target', title: en ? 'Follow the target' : '跟隨目標', place: 'bottom', text: en ? 'Bounce, vertical and horizontal paths move continuously. Random targets move after a successful hold. Speed and size adapt to your streak and time in target.' : '反彈、垂直與水平路徑持續移動；隨機目標在成功維持後換位置。速度及大小會依連續成功與目標內時間比例調整。' },
    { target: '.motor-cortex-hand-cursor', title: en ? 'Move the hand cursor' : '移動手部游標', place: 'top', text: en ? 'Your palm controls this mirrored cursor. Put the selected hand in view and move it into the target circle. The camera starts only after confirmation.' : '手掌位置控制鏡像游標。把指定的手放入畫面，移動游標進入目標圓；確認開始後才啟用相機。' },
    { target: '.motor-cortex-hold-meter', title: en ? 'Keep a steady hold' : '穩定維持', place: 'top', text: en ? 'Fill the bar while staying inside the target. Leaving the target or losing hand tracking interrupts the hold; successful and interrupted holds are both recorded.' : '游標停在目標內會累積進度；離開目標或失去追蹤會中斷維持。成功與中斷事件都會完整記錄。' },
    { target: '.motor-cortex-hud', title: en ? 'Read your session progress' : '查看活動進度', place: 'bottom', text: en ? 'See remaining time, cumulative time in target, hand tracking availability, completed holds and adaptive level. Results include statistics, a chart and all events.' : '上方顯示剩餘時間、累計目標內比例、手部可追蹤率、完成次數與自適應級別。結算提供統計、圖表及完整事件明細。' },
    { target: '.motor-cortex-camera', title: en ? 'Hand landmark preview' : '手部座標預覽', place: 'top', text: en ? 'MediaPipe processes the camera on this device. The game receives only hand coordinates. No video is uploaded; tracking stops on completion, cancellation or exit.' : 'MediaPipe 在本機分析相機。遊戲只收到手部座標，不上傳影像；完成、取消或離開會停止追蹤。' },
  ];
}
