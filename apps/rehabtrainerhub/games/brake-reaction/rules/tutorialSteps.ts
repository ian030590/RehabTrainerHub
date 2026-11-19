export function GetBrakeTutorialSteps(lang: string, showDistraction: boolean) {
  if (lang === 'en') return [
    { target: '.tutorial-lead-car', title: 'Watch your lane', text: 'Brake as soon as the red brake lights come on ahead in your lane. Keep watching through turn signals, lane changes and lights in other lanes.', place: 'top' },
    { target: '.brake-controls', title: 'Brake button', text: 'Tap or click Brake. Space always brakes, regardless of focus on an answer or other control.', place: 'top' },
    { target: '.road-caption', title: 'Braking too early', text: 'Braking before the lights come on or within the first 100 ms after they light up counts as an early press. Choose Try again to restart the round. That press has no reaction time.', place: 'bottom' },
    { target: '.drive-speed', title: 'Your speed', text: 'The toolbar shows your speed in km/h. The number drops as you slow down.', place: 'bottom' },
    ...(showDistraction ? [
      { target: '.messages', title: 'Messages in the last round', text: 'In round six, click or tap an answer, or use Tab to reach it and press Enter. Keep watching your lane and brake when the lights come on, even if you haven’t answered.', place: 'bottom' },
    ] : []),
    { target: '.tutorial-round', title: 'Six rounds', text: 'After each round, the road stays in view and a card shows what happened. After six rounds, choose View session record to finish.', place: 'bottom' },
    { target: '#stop', title: 'Pause or end', text: 'Select Stop or press Escape during a round to pause. Choose Continue or press Escape again to restart that round. End activity discards the session record.', place: 'bottom' },
  ];

  return [
    { target: '.tutorial-lead-car', title: '看著自己的車道', text: '看到同車道前方的紅色煞車燈亮起，就盡快煞車。看到方向燈、車輛換道或其他車道的車燈時，繼續觀察。', place: 'top' },
    { target: '.brake-controls', title: '煞車按鈕', text: '可以點按「煞車」。不論焦點在答案或其他按鈕上，按空白鍵都會煞車。', place: 'top' },
    { target: '.road-caption', title: '太早煞車', text: '在煞車燈亮起前，或亮起不到 100 毫秒就煞車，會算一次提前點擊。選「再試一次」可重來，這次按鍵不計反應時間。', place: 'bottom' },
    { target: '.drive-speed', title: '車速', text: '工具列顯示車速，單位是公里／小時。減速時，數字會下降。', place: 'bottom' },
    ...(showDistraction ? [
      { target: '.messages', title: '最後一關的訊息', text: '第六關可點選答案，或用 Tab 移到答案再按 Enter。請繼續留意自己的車道，即使還沒回答，看到煞車燈也要按煞車。', place: 'bottom' },
    ] : []),
    { target: '.tutorial-round', title: '共六關', text: '每關結束後，畫面會停在道路上，下方的卡片會顯示單關紀錄。完成六關後，選「查看當次紀錄」結束練習。', place: 'bottom' },
    { target: '#stop', title: '暫停或結束', text: '進行中按「停止」或 Esc 可暫停。選「繼續」或再按 Esc，會重新開始這一關。選「結束活動」就不保存當次紀錄。', place: 'bottom' },
  ];
}
