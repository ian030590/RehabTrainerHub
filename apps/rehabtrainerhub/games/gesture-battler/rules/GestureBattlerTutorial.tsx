import { useEffect, useState, type ReactNode } from 'react';
import { useT } from '../i18n/useT';
import { GetGestureTutorialSteps } from './tutorialSteps';
import { StartTour } from '../runtime/tour';

export function GestureBattlerTutorial({ onStart, onBack, summaryItems, active }: {
  onStart: () => void; onBack: () => void;
  active: boolean;
  summaryItems: readonly { label: ReactNode; value: ReactNode }[];
}) {
  const { lang, t } = useT();
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetGestureTutorialSteps(lang), {
      lang, onBack, onEvent: () => setFinished(true),
    });
  }, [lang, onBack, active]);

  return active && finished ? <section className="training-panel gesture-tutorial-ready">
      <div className="training-config">
        <header className="training-config-header"><h2>{t('training.gesture.title')}</h2></header>
        <div className="training-config-body">
          {summaryItems.map((item, index) => <p key={index}>{item.label}：<strong>{item.value}</strong></p>)}
          <p>{lang === 'en' ? 'Allow camera access, then calibrate your hand before the battle.' : '接下來請允許相機權限，完成手勢校正後才進入對戰。'}</p>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button type="button" className="btn btn-primary" onClick={onStart}>{t('training.start')}</button>
          <button type="button" className="btn btn-ghost" onClick={onBack}>{lang === 'en' ? 'Back to settings' : '返回設定'}</button>
        </div></footer>
      </div>
    </section> : null;
}
