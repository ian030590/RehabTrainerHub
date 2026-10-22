import { boardSpecs } from '../logic/ticTacToe';
import type { TicTacToeSettings } from '../settings';

export function GetTicTacToeTutorialSteps(lang: string, settings: TicTacToeSettings) {
  const { winLength } = boardSpecs[settings.difficulty] ?? boardSpecs.medium;
  return lang === 'en' ? [
    { target: '.ttt-cell[data-tutorial="move"]', title: 'Tap an empty cell', text: 'You are X and the computer is O. Tap any empty cell to place your X. With a keyboard, move with the arrow keys and press Enter.', place: 'bottom' },
    { target: '.ttt-goal', title: `${winLength} in a row wins`, text: `Rows, columns and diagonals all count. The game also ends if the computer makes ${winLength} in a row first, or if the board fills with no line.`, place: 'bottom' },
    { target: '.ttt-turn', title: 'Taking turns', text: 'About 1 second after your move, the computer places its O. Taps during its turn do nothing. A tap on a cell that already has a mark is counted.', place: 'bottom' },
    { target: '.ttt-stop', title: 'Time and stop', text: 'The bar shows the time so far. Stop or Escape ends the game without saving.', place: 'bottom' },
  ] : [
    { target: '.ttt-cell[data-tutorial="move"]', title: '點空格下棋', text: '你是 X，電腦是 O。點任何空格放下你的 X；用鍵盤時以方向鍵移動、按 Enter 下棋。', place: 'bottom' },
    { target: '.ttt-goal', title: `連成 ${winLength} 個獲勝`, text: `橫、直、斜都算。電腦先連成 ${winLength} 個，或棋盤下滿都沒人連成，這局也會結束。`, place: 'bottom' },
    { target: '.ttt-turn', title: '輪流下棋', text: '你下完約 1 秒後，電腦會放下 O。電腦下棋時點棋盤不會有反應；點到已有棋子的格子會記一次。', place: 'bottom' },
    { target: '.ttt-stop', title: '時間與停止', text: '上方顯示目前用時。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
