import { EndTour, IsTourActive, StartTour, type TourStep } from '@rehab-trainer/ui/tour';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import '@rehab-trainer/ui/tour/toutour.css';

type Bilingual = { zh: string; en: string };
type GameTourCopy = { title: Bilingual; goal: Bilingual; stimulus: Bilingual; response: Bilingual };

const copy: GameTourCopy = {
  "title": {
    "zh": "數字廣度記憶",
    "en": "Digit Span Memory"
  },
  "goal": {
    "zh": "記住依序出現的數字並照順序重現。",
    "en": "Remember the digits in order and reproduce the sequence."
  },
  "stimulus": {
    "zh": "數字會逐一短暫出現，長度可能逐回增加。",
    "en": "Digits appear briefly one at a time and may grow longer each round."
  },
  "response": {
    "zh": "按相同順序輸入剛才看到的數字。",
    "en": "Enter the digits in the same order you saw them."
  }
};

export function GameTour({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const completedRef = useRef(false);
  const [complete, setComplete] = useState(false);
  const completionEvent = 'rehab-trainer:game-tour-complete:digit-span';

  useEffect(() => {
    mountedRef.current = true;
    const completeTour = () => {
      if (!mountedRef.current || completedRef.current) return;
      completedRef.current = true;
      setComplete(true);
      window.dispatchEvent(new Event(completionEvent));
    };
    const target = () => rootRef.current?.querySelector<HTMLElement>("input,button") ?? rootRef.current;
    const steps: TourStep[] = [
      { target, title: copy.title, text: copy.goal, icon: 'flag', place: 'bottom' },
      { target, title: copy.stimulus, text: copy.stimulus, icon: 'visibility', place: 'bottom' },
      { target, title: copy.response, text: copy.response, icon: 'touch_app', place: 'top' },
    ];
    const started = StartTour(steps, {
      lang: () => document.documentElement.lang || 'zh-TW',
      storageKey: 'rehab-tour-digit-span',
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
    <div ref={rootRef} data-game-tour="digit-span" inert={!complete || undefined} aria-label={"數字廣度記憶 / Digit Span Memory"}>
      {children}
    </div>
  );
}
