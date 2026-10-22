export function GetReactionTutorialSteps(lang: string, range: string, rounds: number) {
  return lang === 'en' ? [
    { target: '.reaction-time-label', title: 'Red means wait', text: 'Tap the middle of the screen or press Space to start. The screen turns red: wait and do not press yet.', place: 'bottom' },
    { target: '.reaction-time-hint', title: 'Press on green', text: `Red lasts a random ${range}. When it turns green and says Press!, tap or press Space as fast as you can. The screen then shows your time in milliseconds.`, place: 'bottom' },
    { target: '.reaction-time-early', title: 'Too early starts over', text: 'Pressing while it is still red counts as too early and has no time. Tap again to start a new wait.', place: 'bottom' },
    { target: '.reaction-time-progress-label', title: 'When it ends', text: `The session ends after ${rounds} timed presses, or when the time limit runs out if you set one. You decide when to start each try.`, place: 'bottom' },
    { target: '.reaction-time-stop', title: 'Stop', text: 'Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.reaction-time-label', title: '紅色時等待', text: '點畫面中央或按空白鍵開始。畫面變成紅色時請等待，先不要按。', place: 'bottom' },
    { target: '.reaction-time-hint', title: '變綠色立刻按', text: `紅色會隨機維持 ${range}。變成綠色「按！」時，盡快點畫面或按空白鍵，畫面會顯示這次的毫秒數。`, place: 'bottom' },
    { target: '.reaction-time-early', title: '太早要重來', text: '還是紅色就按，算一次「太早」，不計時間。再點一下重新等待。', place: 'bottom' },
    { target: '.reaction-time-progress-label', title: '什麼時候結束', text: `成功按到 ${rounds} 次就結束；有設定時限的話，時間到也會結束。每一次都由你決定何時開始。`, place: 'bottom' },
    { target: '.reaction-time-stop', title: '停止', text: '按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
