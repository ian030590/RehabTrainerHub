export function GetUfovTutorialSteps(lang: string, activity: number) {
  const en = lang === 'en';
  const hud = en
    ? { target: '.ufov-hud', title: 'Progress and stop', text: 'The top left shows the trial number. Stop or Escape ends the session without saving.', place: 'bottom' }
    : { target: '.ufov-hud', title: '進度與停止', text: '左上角顯示第幾題。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' };
  if (activity === 1) return en ? [
    { target: '.ufov-preview-center', title: 'Keep your eyes on the box', text: 'Each trial starts with a box in the center. A vehicle flashes inside it, then a noise pattern covers the screen.', place: 'bottom' },
    { target: '.ufov-preview-choices', title: 'Car or truck', text: 'When the noise clears, choose whether the vehicle in the box was a car or a truck.', place: 'top' },
    hud,
  ] : [
    { target: '.ufov-preview-center', title: '看著中央方框', text: '每一題先出現中央方框。車輛在方框裡閃一下，接著整個畫面被雜訊蓋住。', place: 'bottom' },
    { target: '.ufov-preview-choices', title: '汽車還是卡車', text: '雜訊消失後，點選方框裡出現的是汽車還是卡車。', place: 'top' },
    hud,
  ];
  const outer = activity === 3
    ? en ? { title: 'The car among triangles', text: 'The outer car now hides among many triangles. Ignore the triangles and remember only where the car was.' }
      : { title: '三角形裡的汽車', text: '外圈汽車混在許多三角形之間。三角形不用理會，只記住汽車在哪個方向。' }
    : en ? { title: 'The outer car', text: 'At the same moment, a car flashes on the outer ring in one of eight directions. Keep looking at the center and notice it from the corner of your eye.' }
      : { title: '外圈的汽車', text: '同一瞬間，外圈的 8 個方向之一會閃過一輛汽車。眼睛繼續看中央，用眼角餘光留意它。' };
  return en ? [
    { target: '.ufov-preview-center', title: 'Keep your eyes on the box', text: 'Each trial starts with a box in the center. A vehicle flashes inside it, then a noise pattern covers the screen.', place: 'bottom' },
    { target: '.ufov-preview-outer', ...outer, place: 'bottom' },
    { target: '.ufov-preview-choices', title: 'First, the center vehicle', text: 'When the noise clears, choose whether the vehicle in the box was a car or a truck.', place: 'top' },
    { target: '.ufov-preview-directions', title: 'Then, the direction', text: 'Next, choose the direction where the outer car appeared. A trial counts as correct only when both answers are right.', place: 'top' },
    hud,
  ] : [
    { target: '.ufov-preview-center', title: '看著中央方框', text: '每一題先出現中央方框。車輛在方框裡閃一下，接著整個畫面被雜訊蓋住。', place: 'bottom' },
    { target: '.ufov-preview-outer', ...outer, place: 'bottom' },
    { target: '.ufov-preview-choices', title: '先選中央車輛', text: '雜訊消失後，先點選方框裡出現的是汽車還是卡車。', place: 'top' },
    { target: '.ufov-preview-directions', title: '再選方向', text: '接著點選外圈汽車出現的方向。兩個答案都對，這一題才算答對。', place: 'top' },
    hud,
  ];
}
