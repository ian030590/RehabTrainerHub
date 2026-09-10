import { EndTour, IsTourActive, StartTour, type TourStep } from '@rehab-trainer/ui/tour';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import '@rehab-trainer/ui/tour/toutour.css';

type Bilingual = { zh: string; en: string };
type GameTourCopy = { title: Bilingual; goal: Bilingual; stimulus: Bilingual; response: Bilingual };

const copy: GameTourCopy = {
  "title": {
    "zh": "點與箱",
    "en": "Dots and Boxes"
  },
  "goal": {
    "zh": "補上一條邊，完成更多方格並取得分數。",
    "en": "Draw edges to complete more boxes and score points."
  },
  "stimulus": {
    "zh": "點陣之間的空邊可被選取，最後一條邊會完成方格。",
    "en": "Open edges connect the dots; the final edge completes a box."
  },
  "response": {
    "zh": "選擇要補上的水平或垂直邊。",
    "en": "Select the horizontal or vertical edge to draw."
  }
};

export function GameTour({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const completedRef = useRef(false);
  const [complete, setComplete] = useState(false);
  const completionEvent = 'rehab-trainer:game-tour-complete:dots-and-boxes';

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
      storageKey: 'rehab-tour-dots-and-boxes',
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
    <div ref={rootRef} data-game-tour="dots-and-boxes" inert={!complete || undefined} aria-label={"點與箱 / Dots and Boxes"}>
      {children}
    </div>
  );
}
