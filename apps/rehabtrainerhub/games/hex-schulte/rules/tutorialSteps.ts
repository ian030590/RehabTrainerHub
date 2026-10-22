import type { HexSettings } from '../settings';

export function GetHexTutorialSteps(lang: string, settings: HexSettings) {
  const last = 3 * settings.rings * (settings.rings + 1);
  const center = settings.centerChecks;
  return lang === 'en' ? [
    { target: '.hex-center', title: 'Keep your eyes here', text: `Look at the centre mark the whole time and find the numbers with the edge of your vision. ${center ? 'When the centre lights up, tap it.' : 'Centre checks are off for this session.'}`, place: 'bottom' },
    { target: '.hex-cell[data-start="true"]', title: 'Tap 1 to ' + last, text: `Tap the numbers in order, from 1 to ${last}. Found numbers fade. A wrong tap is counted but not penalised.`, place: 'bottom' },
    { target: '.hex-hud', title: 'Round, time and stop', text: 'The bar shows the round, the next number and the time so far. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.hex-center', title: '眼睛看中央', text: `整個回合都看著中央記號，用眼角餘光找數字。${center ? '中央亮起時，點一下中央。' : '這次沒有開啟中央提示。'}`, place: 'bottom' },
    { target: '.hex-cell[data-start="true"]', title: `從 1 點到 ${last}`, text: `依序點數字，從 1 點到 ${last}。找到的數字會變淡；點錯會記下次數，但不扣分。`, place: 'bottom' },
    { target: '.hex-hud', title: '回合、時間與停止', text: '上方顯示目前回合、下一個數字與用時。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
