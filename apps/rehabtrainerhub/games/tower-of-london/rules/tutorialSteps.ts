export function GetTowerTutorialSteps(lang: string) {
  return lang === 'en' ? [
    { target: '.tower-panel-target .tower-panel-title', title: 'The target', text: 'The target board shows how the three balls should end up. It never changes. Each ball carries its first letter: G green, R red, B blue.', place: 'bottom' },
    { target: '.tower-panel-yours .tower-panel-title', title: 'Your board', text: 'Your board starts the same every time. The first peg holds 3 balls, the second 2 and the third 1. Only the top ball on a peg can move.', place: 'bottom' },
    { target: '.tower-hand', title: 'Pick up, then place', text: 'Tap a peg (or press 1, 2 or 3) to lift its top ball into your hand, then tap another peg to drop it there. An empty peg gives nothing and a full peg takes nothing.', place: 'top' },
    { target: '.tower-moves', title: 'Use the fewest moves', text: 'Each ball you lift counts as one move. This line shows your moves and the fewest the problem needs. Plan first, then move.', place: 'top' },
    { target: '.tower-timer', title: 'Time and rests', text: 'Each problem has a time limit. When your board matches the target, the problem ends. Before each problem you can rest. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.tower-panel-target .tower-panel-title', title: '目標盤面', text: '目標盤面顯示三顆球最後要排成的樣子，不會變動。每顆球上寫著顏色：綠、紅、藍。', place: 'bottom' },
    { target: '.tower-panel-yours .tower-panel-title', title: '你的盤面', text: '你的盤面每題都從相同位置開始。第一根柱子可放 3 顆、第二根 2 顆、第三根 1 顆，只能移動最上面的球。', place: 'bottom' },
    { target: '.tower-hand', title: '先拿起，再放下', text: '點一根柱子（或按 1、2、3）把最上面的球拿到手上，再點另一根柱子放下。空柱子拿不到球，滿的柱子放不下。', place: 'top' },
    { target: '.tower-moves', title: '用最少步數完成', text: '每拿起一顆球算一步。這裡顯示已移動幾步，以及這題最少需要幾步。先想好再動手。', place: 'top' },
    { target: '.tower-timer', title: '時限與休息', text: '每題有時間限制，盤面和目標一樣就完成這題。每題開始前可以先休息。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
