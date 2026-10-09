export function GetGestureTutorialSteps(lang: 'zh' | 'en') {
  const copy = lang === 'en' ? [
    ['Camera and hand tracking', 'MediaPipe tracks your hand through the camera. Keep your whole hand visible in good light. Camera access is required to play.'],
    ['Calibrate your hand', 'First calibrate a closed fist and an open hand, then gestures 1–5. Stay within a comfortable range; press Start calibration and hold each pose steadily.'],
    ['Choose and charge a move', 'Free mode accepts any calibrated gesture; directed mode requires the prompted number. Hold the gesture for your configured duration to attack. A change or loss of tracking interrupts the hold.'],
    ['Opponent and results', 'Each successful cast removes one HP. When the opponent reaches zero HP, results show casts, interrupted holds, duration and the statistics for every gesture.'],
  ] : [
    ['相機與手部追蹤', 'MediaPipe 透過相機追蹤手部。請在光線充足的環境讓整隻手清楚入鏡；此遊戲需要相機才能操作。'],
    ['校正你的手勢', '先校正握拳與張手，再依序校正數字 1–5。請在舒適的範圍內做出姿勢，按「開始校正」後穩定維持。'],
    ['選招與集氣', '自由模式接受任一已校正手勢；指定模式需要畫面要求的數字。穩定維持設定秒數後施放攻擊；手勢改變或追蹤中斷會重新集氣。'],
    ['對手與當次紀錄', '每次成功施放扣除對手 1 點 HP。HP 歸零後進入結算，顯示成功施放、中斷次數、總時長與每種手勢的統計。'],
  ];
  return ['camera', 'calibration', 'moves', 'enemy'].map((target, index) => ({
    target: `.gesture-${target}-tutorial`, title: copy[index][0], text: copy[index][1],
    place: index === 0 ? 'bottom' : 'top',
  }));
}
