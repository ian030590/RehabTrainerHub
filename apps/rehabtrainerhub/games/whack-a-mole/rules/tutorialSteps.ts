export function GetWhackTutorialSteps(lang: string, durationSec: number, targetMs: number) {
  const seconds = (targetMs / 1000).toFixed(2).replace(/0$/, '');
  return lang === 'en' ? [
    { target: '.wm-hole[data-tutorial="move"]', title: 'Tap the mole', text: `A mole pops up from one hole at a time and stays up for ${seconds} s. Tap it before it ducks back down. With a keyboard, move with the arrow keys and press Enter.`, place: 'bottom' },
    { target: '.wm-hits', title: 'Hits and misses', text: 'Tapping the mole is a hit and shows a star. A mole that ducks down, or a tap on another hole while a mole is up, is a miss. Taps while no mole is up do not count.', place: 'bottom' },
    { target: '.wm-clock', title: 'Time', text: `The game runs for ${durationSec} seconds. The clock counts down.`, place: 'bottom' },
    { target: '.wm-stop', title: 'Stop', text: 'Stop or Escape ends the game without saving.', place: 'bottom' },
  ] : [
    { target: '.wm-hole[data-tutorial="move"]', title: '點地鼠', text: `地鼠一次從一個洞冒出來，停留 ${seconds} 秒；趁牠躲回去前點牠。用鍵盤時以方向鍵移動、按 Enter。`, place: 'bottom' },
    { target: '.wm-hits', title: '打中與漏掉', text: '點到地鼠算打中，會出現星星；地鼠躲回去，或地鼠出來時點了別的洞，都算漏掉。沒有地鼠時點洞不計分。', place: 'bottom' },
    { target: '.wm-clock', title: '時間', text: `這局進行 ${durationSec} 秒，時間會倒數。`, place: 'bottom' },
    { target: '.wm-stop', title: '停止', text: '按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
