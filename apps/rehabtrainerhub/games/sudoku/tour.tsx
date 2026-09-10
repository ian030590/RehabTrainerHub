import { EndTour, IsTourActive, StartTour, type TourStep } from '@rehab-trainer/ui/tour';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import '@rehab-trainer/ui/tour/toutour.css';

type Bilingual = { zh: string; en: string };
type GameTourCopy = { title: Bilingual; goal: Bilingual; stimulus: Bilingual; response: Bilingual };

const copy: GameTourCopy = {
  "title": {
    "zh": "數獨",
    "en": "Sudoku"
  },
  "goal": {
    "zh": "利用行、列與宮的限制填入每個數字。",
    "en": "Use row, column, and box constraints to fill every number."
  },
  "stimulus": {
    "zh": "部分格子已有數字，其餘格子需要推理。",
    "en": "Some cells are filled while the rest require deduction."
  },
  "response": {
    "zh": "選擇空格並填入不重複的數字。",
    "en": "Select an empty cell and enter a number without repeats."
  }
};

export function GameTour({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const completedRef = useRef(false);
  const [complete, setComplete] = useState(false);
  const completionEvent = 'rehab-trainer:game-tour-complete:sudoku';

  useEffect(() => {
    mountedRef.current = true;
    const completeTour = () => {
      if (!mountedRef.current || completedRef.current) return;
      completedRef.current = true;
      setComplete(true);
      window.dispatchEvent(new Event(completionEvent));
    };
    const target = () => rootRef.current?.querySelector<HTMLElement>("button,input") ?? rootRef.current;
    const steps: TourStep[] = [
      { target, title: copy.title, text: copy.goal, icon: 'flag', place: 'bottom' },
      { target, title: copy.stimulus, text: copy.stimulus, icon: 'visibility', place: 'bottom' },
      { target, title: copy.response, text: copy.response, icon: 'touch_app', place: 'top' },
    ];
    const started = StartTour(steps, {
      lang: () => document.documentElement.lang || 'zh-TW',
      storageKey: 'rehab-tour-sudoku',
      labels: {
        next: { zh: '下一步 / Next', en: 'Next / 下一步' },
        prev: { zh: '上一步 / Back', en: 'Back / 上一步' },
        done: { zh: '開始遊戲 / Start game', en: 'Start game / 開始遊戲' },
        skip: { zh: '略過導覽 / Skip tour', en: 'Skip tour / 略過導覽' },
      },
      onEvent: (name) => {
        if (name === 'tour_done' || name === 'tour_skip') completeTour();
      },
    });
    if (!started) completeTour();
    return () => {
      mountedRef.current = false;
      if (IsTourActive()) EndTour(false);
    };
  }, [completionEvent]);

  return (
    <div ref={rootRef} data-game-tour="sudoku" inert={!complete || undefined} aria-label={"數獨 / Sudoku"}>
      {children}
    </div>
  );
}
