import { useEffect, useRef } from 'react';
import { useT } from '../i18n/useT';
import { StartTour } from '../runtime/tour';
import { GetMotorTutorialSteps } from './tutorialSteps';

export function MotorTutorial({ active, onBack, onFinish }: { active: boolean; onBack: () => void; onFinish: () => void }) {
  const finishRef = useRef(onFinish); finishRef.current = onFinish;
  const { lang } = useT();
  useEffect(() => {
    if (!active) return;
    return StartTour(GetMotorTutorialSteps(lang), { lang, onBack, onEvent: () => finishRef.current() });
  }, [active, lang, onBack]);
  return null;
}
