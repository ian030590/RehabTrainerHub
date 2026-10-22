export function GetMemoryTutorialSteps(lang: string, timeLimitSec: number, pairs: number) {
  const minutes = timeLimitSec / 60;
  return lang === 'en' ? [
    { target: '.mm-card[data-tutorial="move"]', title: 'Turn over two cards', text: 'Tap a card to see its letter, then tap a second card. Every two cards count as one move. With a keyboard, move with the arrow keys and press Enter.', place: 'bottom' },
    { target: '.mm-pairs', title: `Find all ${pairs} pairs`, text: 'Two cards with the same letter stay face up with a check mark. Two different letters turn back after a moment, so remember where each letter was.', place: 'bottom' },
    { target: '.mm-clock', title: 'Time', text: timeLimitSec ? `You have ${minutes} minute${minutes === 1 ? '' : 's'}. The clock counts down; if pairs are still hidden when it reaches zero, the game ends.` : 'There is no time limit. The clock shows the time so far.', place: 'bottom' },
    { target: '.mm-stop', title: 'Stop', text: 'Stop or Escape ends the game without saving.', place: 'bottom' },
  ] : [
    { target: '.mm-card[data-tutorial="move"]', title: '翻開兩張卡片', text: '點一張卡片看它的字母，再點第二張。每翻兩張記一步。用鍵盤時以方向鍵移動、按 Enter。', place: 'bottom' },
    { target: '.mm-pairs', title: `找出全部 ${pairs} 對`, text: '兩張字母相同，就會留在正面並打勾；字母不同，兩張會在片刻後翻回去，要記住每個字母的位置。', place: 'bottom' },
    { target: '.mm-clock', title: '時間', text: timeLimitSec ? `限時 ${minutes} 分鐘，時間會倒數；時間到時還有卡片沒配對，這局就結束。` : '不限時，這裡顯示目前用時。', place: 'bottom' },
    { target: '.mm-stop', title: '停止', text: '按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
