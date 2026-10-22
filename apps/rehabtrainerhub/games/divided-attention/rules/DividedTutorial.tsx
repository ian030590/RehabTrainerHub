import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { DividedSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetDividedTutorialSteps } from './tutorialSteps';

// The scene matches the training stage so each spotlight lands on the real control positions.
export function DividedTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: DividedSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetDividedTutorialSteps(lang), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  const minutes = `${Math.floor(settings.durationSec / 60)}:${String(settings.durationSec % 60).padStart(2, '0')}`;
  return <section className="divided-stage divided-attention-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="divided-hud" aria-hidden="true">
      <p className="divided-progress-label">{en ? `${minutes} left` : `剩 ${minutes}`}</p>
      <div className="divided-progress-track"><div className="divided-progress-fill" /></div>
      <span className="btn btn-ghost divided-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <div className="divided-field" aria-hidden="true">
      <div className="divided-target divided-target-centered" data-on="true"><span className="divided-zone" /><span className="divided-dot" /></div>
    </div>
    <div className="divided-math" aria-hidden="true" data-state="problem">
      <p className="divided-equation">3 + 4 = ?</p>
      <div className="divided-options">{[6, 7, 8].map((value, index) => <span key={value} className="divided-option">{value}<small>{index + 1}</small></span>)}</div>
    </div>
    {active && finished && <section className="training-panel divided-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
