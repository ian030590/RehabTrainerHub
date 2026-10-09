import { useEffect, useState, type ReactNode } from 'react';
import { useT } from '../i18n/useT';
import { GetGestureTutorialSteps } from './tutorialSteps';
import { StartTour } from '../runtime/tour';

export function GestureBattlerTutorial({ onStart, onBack, summaryItems, active, enemyMaxHp }: {
  onStart: () => void; onBack: () => void;
  active: boolean; enemyMaxHp: number;
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

  return <div className="gesture-tutorial">
    <section className="gesture-camera-tutorial" aria-label={t('gesture.camera.preview')}>
      <p>{lang === 'en' ? 'Camera · MediaPipe' : '相機 · MediaPipe'}</p>
      <svg viewBox="0 0 80 80" aria-hidden="true"><path d="M25 66V39c0-7 8-7 8 0V18c0-6 8-6 8 0v19-24c0-6 8-6 8 0v24-17c0-6 8-6 8 0v28l5-9c4-6 11-1 8 5L58 68Z" /></svg>
    </section>
    <section className="gesture-calibration-tutorial">
      <h3>{lang === 'en' ? 'Calibrate' : '手勢校正'}</h3>
      <p>{lang === 'en' ? 'Fist → Open hand → 1–5' : '握拳 → 張手 → 1–5'}</p>
    </section>
    <section className="gesture-enemy-tutorial">
      <h3>{t('gesture.enemy.name')}</h3>
      <p>HP · {enemyMaxHp} / {enemyMaxHp}</p>
      <div className="gesture-tutorial-hp" aria-hidden="true" />
    </section>
    <section className="gesture-moves-tutorial">
      <h3>{t('gesture.combat.moves')}</h3>
      <ol><li>1 · {t('gesture.move.water')}</li><li>2 · {t('gesture.move.strike')}</li>
        <li>3 · {t('gesture.move.leaf')}</li><li>4 · {t('gesture.move.spark')}</li>
        <li>5 · {t('gesture.move.thunder')}</li></ol>
      <p>{lang === 'en' ? 'Hold → Cast' : '穩定維持 → 施放'}</p>
    </section>
    {finished && <section className="training-panel gesture-tutorial-ready">
      <div className="training-config">
        <header className="training-config-header"><h2>{t('training.gesture.title')}</h2></header>
        <div className="training-config-body">
          {summaryItems.map((item, index) => <p key={index}>{item.label}：<strong>{item.value}</strong></p>)}
          <p>{lang === 'en' ? 'Allow camera access, then calibrate your hand before the battle.' : '接下來請允許相機權限，完成手勢校正後才進入對戰。'}</p>
        </div>
        <div className="config-actions training-config-navigation-buttons">
          <button type="button" className="btn btn-primary" onClick={onStart}>{t('training.start')}</button>
          <button type="button" className="btn btn-ghost" onClick={onBack}>{lang === 'en' ? 'Back to settings' : '返回設定'}</button>
        </div>
      </div>
    </section>}
  </div>;
}
