import type { TimingMode } from '../settings';
import { taskCopy } from '../taskCopy';

export function GetTimingTutorialSteps(lang: string, mode: TimingMode) {
  const en = lang === 'en';
  const copy = taskCopy[en ? 'en' : 'zh'];
  const tasks = mode === 'mixed' ? (['reproduce', 'compare', 'estimate'] as const) : [mode];
  const answers = tasks.map(task => `${copy[task].title}${en ? ': ' : '：'}${copy[task].text}`).join(en ? ' ' : '');
  return en ? [
    { target: '.time-lamp', title: 'Watch how long the dot stays on', text: 'Each trial starts with this dot lighting up. Do not count out loud or tap along; just get a feel for the length.', place: 'bottom' },
    { target: '.time-controls', title: mode === 'mixed' ? 'Three kinds of answer, in blocks' : copy[tasks[0]].title, text: answers, place: 'top' },
    { target: '.time-hud', title: 'Progress and stop', text: 'The bar shows how many trials are left. Stop or Escape ends the session without saving.', place: 'bottom' },
  ] : [
    { target: '.time-lamp', title: '注意圓點亮多久', text: '每題一開始，這個圓點會亮一段時間。不要出聲數數或打拍子，憑感覺記住長短。', place: 'bottom' },
    { target: '.time-controls', title: mode === 'mixed' ? '三種作答方式，分段進行' : copy[tasks[0]].title, text: answers, place: 'top' },
    { target: '.time-hud', title: '進度與停止', text: '上方顯示還剩幾題。按「停止」或 Esc 會結束，這次紀錄不保存。', place: 'bottom' },
  ];
}
