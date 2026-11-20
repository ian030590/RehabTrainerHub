import type { PeripheralAttentionCanvasPhase } from '../runtime/peripheralAttentionCanvas';
import type { TourStep } from '../runtime/tour';

export type UfovTutorialScene = PeripheralAttentionCanvasPhase | 'vehicle' | 'direction';

export function GetUfovTutorialSteps(lang: string, activity: number): (TourStep & { scene: UfovTutorialScene })[] {
  const en = lang === 'en';
  const steps: ReturnType<typeof GetUfovTutorialSteps> = en ? [
    { scene: 'fixation', target: '.ufov-tutorial-center', title: 'Look at the center box', text: 'Each trial starts with an empty box. Keep your eyes on it.', place: 'bottom' },
    { scene: 'stimulus', target: '.ufov-tutorial-center', title: 'A vehicle flashes in the box', text: 'A car or truck appears briefly inside the box. Remember which one you saw.', place: 'bottom' },
  ] : [
    { scene: 'fixation', target: '.ufov-tutorial-center', title: '看著中央方框', text: '每題一開始會出現空的方框，請把視線留在中央。', place: 'bottom' },
    { scene: 'stimulus', target: '.ufov-tutorial-center', title: '中央車輛閃一下', text: '汽車或卡車會短暫出現在方框裡，記住你看到的是哪一種。', place: 'bottom' },
  ];
  if (activity === 2) steps.push(en
    ? { scene: 'stimulus', target: '.ufov-tutorial-outer', title: 'The outer car', text: 'A car flashes outside the box at the same time. Keep looking at the center and remember its direction.', place: 'bottom' }
    : { scene: 'stimulus', target: '.ufov-tutorial-outer', title: '外圈的汽車', text: '外圈同時會閃過一輛汽車。視線留在中央，用餘光記住它的方向。', place: 'bottom' });
  if (activity === 3) steps.push(en
    ? { scene: 'stimulus', target: '.ufov-tutorial-outer', title: 'The car among triangles', text: 'The outer car flashes among triangles. Keep looking at the center and remember where the car was.', place: 'bottom' }
    : { scene: 'stimulus', target: '.ufov-tutorial-outer', title: '三角形間的汽車', text: '外圈汽車會在三角形之間閃一下。視線留在中央，只記住汽車的方向。', place: 'bottom' });
  steps.push(en
    ? { scene: 'mask', target: '.ufov-tutorial-mask', title: 'Wait for the noise to clear', text: 'A noise pattern covers the screen after the flash. The answer buttons appear when it clears.', place: 'bottom' }
    : { scene: 'mask', target: '.ufov-tutorial-mask', title: '雜訊蓋住畫面後才作答', text: '車輛閃過後，雜訊會蓋住畫面。等雜訊消失，作答按鈕就會出現。', place: 'bottom' });
  steps.push(en
    ? { scene: 'vehicle', target: '.ufov-answer-choices', title: activity === 1 ? 'Car or truck' : 'Choose the center vehicle first', text: 'Two vehicle icons appear. Choose the one you saw inside the box.', place: 'top' }
    : { scene: 'vehicle', target: '.ufov-answer-choices', title: activity === 1 ? '汽車還是卡車' : '先選中央車輛', text: '畫面出現兩個車輛圖案，請選出剛才在方框裡看到的那一種。', place: 'top' });
  if (activity !== 1) steps.push(en
    ? { scene: 'direction', target: '.ufov-axis-button[data-tutorial-target]', title: 'Choose the outer car’s direction', text: 'The numbers appear around the center box. Choose the one in the direction where the car flashed. Both answers must be right to score a correct trial.', place: 'bottom' }
    : { scene: 'direction', target: '.ufov-axis-button[data-tutorial-target]', title: '選外圈汽車的方向', text: '中央方框周圍出現數字。請選擇汽車閃過的方向，兩個答案都正確才算答對。', place: 'bottom' });
  steps.push(en
    ? { scene: 'fixation', target: '.ufov-tutorial .ufov-stop', title: 'Pause the activity', text: 'Stop stays in the top right throughout the activity. Press it or Escape to pause, then choose whether to continue or end the session.', place: 'bottom' }
    : { scene: 'fixation', target: '.ufov-tutorial .ufov-stop', title: '暫停活動', text: '活動期間右上角會保留「停止」按鈕。按下它或 Esc 可暫停，再選擇繼續或結束活動。', place: 'bottom' });
  return steps;
}
