import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import { type MovingCardSettings, PixelFromMillimeter } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetMovingCardTutorialSteps } from './tutorialSteps';

export function MovingCardTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: MovingCardSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetMovingCardTutorialSteps(lang), { lang,
      onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="moving-card-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="moving-card-preview-hud"><p>{en ? 'Target: AB' : '目標：AB'}</p><p className="moving-card-round">{en ? 'Round' : '回合'} 1 / {settings.rounds}</p></header>
    <p className="moving-card-target" style={{ fontSize: Math.min(48, PixelFromMillimeter(settings.targetPhysicalSizeMm, settings.calibrationLengthMm)) }}>AB</p>
    <div className={`moving-card-options moving-card-options-${settings.difficulty}`}>
      {Array.from({ length: settings.optionCount }, (_, index) => <p className="moving-card-preview-option" key={index}
        style={{ fontSize: Math.min(28, PixelFromMillimeter(settings.optionPhysicalSizeMm, settings.calibrationLengthMm)),
          transform: settings.difficulty === 'hard' ? `rotate(${index % 2 ? 18 : -18}deg)` : undefined }}>
        {index === 6 || (settings.optionCount <= 6 && index === 0) ? 'AB' : `${String.fromCharCode(65 + index % 26)}${String.fromCharCode(90 - index % 26)}`}
      </p>)}
    </div>
    {active && finished && <section className="training-panel moving-card-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); onBack(); }
        if (event.key === 'Tab') {
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
          event.preventDefault();
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
        }
      }}>
      <div ref={confirmationRef} className="training-config training-confirmation">
        <header className="training-config-header"><h2>{title}</h2></header>
        <div className="training-config-body"><section className="training-setting"><h3>{en ? 'Confirm settings' : '確認設定'}</h3>
          <div className="training-config-summary">{summaryItems.map(item => <p className="training-config-summary-item" key={item.label}><strong>{item.label}：</strong>{item.value}</p>)}</div>
        </section></div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button type="button" className="btn btn-primary" disabled={!ready} onClick={onStart}>{en ? 'Start Training' : '開始訓練'}</button>
          <button type="button" className="btn btn-ghost" onClick={onBack}>{en ? 'Back to settings' : '返回設定'}</button>
        </div></footer>
      </div>
    </section>}
  </section>;
}
