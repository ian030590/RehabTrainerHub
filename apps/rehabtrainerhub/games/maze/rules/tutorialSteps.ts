export function GetMazeTutorialSteps(lang: string, timeLimitSec: number) {
  const minutes = timeLimitSec / 60;
  return lang === 'en' ? [
    { target: '.mz-player', title: 'This is you', text: 'The blue circle is where you are. Each move takes you one cell: use the arrow keys, the direction buttons, or tap a connected cell next to you.', place: 'bottom' },
    { target: '.mz-goal', title: 'Reach the goal', text: 'The green diamond is the goal. Walls block the way. Walking into a wall, or tapping a cell that does not touch yours, is counted.', place: 'bottom' },
    { target: '.mz-dpad', title: 'Direction buttons', text: 'Each press moves you one cell in that direction.', place: 'top' },
    { target: '.mz-clock', title: 'Time', text: timeLimitSec ? `You have ${minutes} minute${minutes === 1 ? '' : 's'}. The clock counts down; if you have not reached the goal when it reaches zero, the game ends.` : 'There is no time limit. The clock shows the time so far.', place: 'bottom' },
    { target: '.mz-stop', title: 'Stop', text: 'Stop or Escape ends the game without saving.', place: 'bottom' },
  ] : [
    { target: '.mz-player', title: '這是你', text: '藍色圓點是你的位置。每次走一格：用方向鍵、方向按鈕，或點你旁邊相通的格子。', place: 'bottom' },
    { target: '.mz-goal', title: '走到終點', text: '綠色菱形是終點。牆會擋路；撞牆或點到不在你旁邊的格子會記一次。', place: 'bottom' },
    { target: '.mz-dpad', title: '方向按鈕', text: '每按一次，往那個方向走一格。', place: 'top' },
    { target: '.mz-clock', title: '時間', text: timeLimitSec ? `限時 ${minutes} 分鐘，時間會倒數；時間到時還沒走到終點，這局就結束。` : '不限時，這裡顯示目前用時。', place: 'bottom' },
    { target: '.mz-stop', title: '停止', text: '按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
