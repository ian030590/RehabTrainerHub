import { EndTour, IsTourActive, StartTour, type TourStep } from '@rehab-trainer/ui/tour';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import '@rehab-trainer/ui/tour/toutour.css';

type Bilingual = { zh: string; en: string };
type GameTourCopy = { title: Bilingual; goal: Bilingual; stimulus: Bilingual; response: Bilingual };

const copy: GameTourCopy = {
  "title": {
    "zh": "數字字母切換",
    "en": "Number-Letter"
  },
  "goal": {
    "zh": "在數字與字母判斷規則間切換。",
    "en": "Switch between the number and letter decision rules."
  },
  "stimulus": {
    "zh": "四格刺激含一個數字與一個字母，位置會改變。",
    "en": "A number and a letter appear in one of four positions."
  },
  "response": {
    "zh": "依提示判斷數字奇偶或字母母音／子音。",
    "en": "Follow the cue to judge number parity or letter vowel/consonant status."
  }
};

export function GameTour({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const completedRef = useRef(false);
  const [complete, setComplete] = useState(false);
  const completionEvent = 'rehab-trainer:game-tour-complete:number-letter';

  useEffect(() => {
    mountedRef.current = true;
    const completeTour = () => {
      if (!mountedRef.current || completedRef.current) return;
      completedRef.current = true;
      setComplete(true);
      window.dispatchEvent(new Event(completionEvent));
    };
    const target = () => rootRef.current?.querySelector<HTMLElement>("button") ?? rootRef.current;
    const steps: TourStep[] = [
      { target, title: copy.title, text: copy.goal, icon: 'flag', place: 'bottom' },
      { target, title: copy.stimulus, text: copy.stimulus, icon: 'visibility', place: 'bottom' },
      { target, title: copy.response, text: copy.response, icon: 'touch_app', place: 'top' },
    ];
    const started = StartTour(steps, {
      lang: () => document.documentElement.lang || 'zh-TW',
      storageKey: 'rehab-tour-number-letter',
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
    <div ref={rootRef} data-game-tour="number-letter" inert={!complete || undefined} aria-label={"數字字母切換 / Number-Letter"}>
      {children}
    </div>
  );
}
