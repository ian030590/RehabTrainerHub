import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { PlusMinusSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetPlusMinusTutorialSteps } from './tutorialSteps';
import { NumberPad, RuleLabel } from '../NumberPad';

// The scene matches the training stage so each spotlight lands on the real control positions.
// It shows the first number of the alternating list, 27, with the answer 30 typed in.
export function PlusMinusTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: PlusMinusSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetPlusMinusTutorialSteps(lang), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="pm-stage plus-minus-tutorial" data-state="tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="pm-hud" aria-hidden="true">
      <p className="pm-progress-label">{en ? `1 of ${settings.itemsPerList}` : `1／${settings.itemsPerList}`}</p>
      <p className="pm-rule">{RuleLabel(2, en)}</p>
      <div className="pm-progress-track"><div className="pm-progress-fill" /></div>
      <span className="btn btn-ghost pm-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <div className="pm-display" aria-hidden="true"><p className="pm-number">27</p></div>
    <div className="pm-answer-area" aria-hidden="true">
      <p className="pm-entry" data-filled>30</p>
      <NumberPad en={en} active={false} full={false} empty={false} inert />
    </div>
    {active && finished && <section className="training-panel pm-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
