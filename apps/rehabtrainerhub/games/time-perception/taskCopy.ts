import type { TimingTask } from './logic/timing';

// Instructions for each task, shared by the tutorial and the block introductions.
export const taskCopy: Record<'zh' | 'en', Record<TimingTask, { title: string; text: string }>> = {
  zh: {
    reproduce: { title: '重現時間', text: '圓點會亮一段時間。熄滅後，按住下方按鈕（或空白鍵）同樣久再放開。' },
    compare: { title: '比較長短', text: '圓點會先後亮兩次。看完後選出哪一次亮得比較久，可以按 1 或 2。' },
    estimate: { title: '估計秒數', text: '圓點會亮一段時間。熄滅後，選出它大約亮了幾秒，可以按 1 到 5。' },
  },
  en: {
    reproduce: { title: 'Reproduce the time', text: 'The dot lights up for a while. When it goes off, hold the button below (or the Space bar) for the same length of time, then let go.' },
    compare: { title: 'Compare two times', text: 'The dot lights up twice, one after the other. Then choose which time was longer. Keys 1 and 2 work too.' },
    estimate: { title: 'Estimate the seconds', text: 'The dot lights up for a while. When it goes off, choose about how many seconds it was on. Keys 1 to 5 work too.' },
  },
};
