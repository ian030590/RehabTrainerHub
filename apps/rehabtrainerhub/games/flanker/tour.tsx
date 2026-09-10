import { EndTour, IsTourActive, StartTour, type TourStep } from '@rehab-trainer/ui/tour';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import '@rehab-trainer/ui/tour/toutour.css';

type Bilingual = { zh: string; en: string };
type GameTourCopy = { title: Bilingual; goal: Bilingual; stimulus: Bilingual; response: Bilingual };

const copy: GameTourCopy = {
  "title": {
    "zh": "側翼干擾選擇",
    "en": "Flanker Selective Attention"
  },
  "goal": {
    "zh": "忽略側翼，只依中央箭頭方向選擇。",
    "en": "Ignore the flankers and choose only the central arrow direction."
  },
  "stimulus": {
    "zh": "中央箭頭周圍有同向或反向側翼箭頭。",
    "en": "The central arrow is surrounded by congruent or conflicting flankers."
  },
  "response": {
    "zh": "只按中央箭頭指向的左右方向。",
    "en": "Press the left or right direction shown by the central arrow."
  }
};

export function GameTour({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const completedRef = useRef(false);
  const [complete, setComplete] = useState(false);
  const completionEvent = 'rehab-trainer:game-tour-complete:flanker';

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
      storageKey: 'rehab-tour-flanker',
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
    <div ref={rootRef} data-game-tour="flanker" inert={!complete || undefined} aria-label={"側翼干擾選擇 / Flanker Selective Attention"}>
      {children}
    </div>
  );
}
