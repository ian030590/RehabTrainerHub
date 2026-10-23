import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import { StartTour } from '../runtime/tour';
import { GetUfovTutorialSteps } from './tutorialSteps';
import { DirectionPad, TriangleIcon, VehicleChoices, VehicleIcon } from '../AnswerPad';

// Ring slots as the canvas lays them out: 8, 16 and 24 places at one, two and three thirds of the outer radius.
const ringSlots = [8, 16, 24].flatMap((count, ring) => Array.from({ length: count }, (_, index) => {
  const angle = (-90 + index * 360 / count) * Math.PI / 180;
  const radius = 40 * (ring + 1) / 3;
  return { key: `${ring}-${index}`, target: ring === 2 && index === 3, left: 50 + Math.cos(angle) * radius, top: 50 + Math.sin(angle) * radius };
}));

// The scene matches the training stage so each spotlight lands on the real control positions.
export function UfovTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: { subtestId?: unknown };
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const activity = settings.subtestId === 2 || settings.subtestId === 3 ? settings.subtestId : 1;
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetUfovTutorialSteps(lang, activity), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, activity, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="ufov-stage ufov-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="ufov-hud" aria-hidden="true">
      <p className="ufov-progress">{en ? 'Trial 1' : '第 1 題'}</p>
      <span className="btn btn-ghost ufov-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <div className="ufov-preview-scene" aria-hidden="true">
      <div className="ufov-preview-field">
        {activity !== 1 && <div className="ufov-preview-outer">
          {ringSlots.filter(slot => slot.target || activity === 3).map(slot => <span key={slot.key} className="ufov-preview-slot"
            style={{ left: `${slot.left}%`, top: `${slot.top}%` }}>{slot.target ? <VehicleIcon vehicle="car" /> : <TriangleIcon />}</span>)}
        </div>}
        <div className="ufov-preview-center"><VehicleIcon vehicle="truck" /></div>
      </div>
      <div className="ufov-preview-answers">
        <VehicleChoices lang={lang} className="ufov-preview-choices" />
        {activity !== 1 && <DirectionPad lang={lang} className="ufov-preview-directions" />}
      </div>
    </div>
    {active && finished && <section className="training-panel ufov-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
