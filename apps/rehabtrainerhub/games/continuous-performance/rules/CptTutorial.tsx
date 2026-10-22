import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { CptSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetCptTutorialSteps } from './tutorialSteps';

// The scene matches the training stage so each spotlight lands on the real control positions.
export function CptTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: CptSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const variant = settings.variant;
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetCptTutorialSteps(lang, variant), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, variant, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="cpt-stage continuous-performance-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="cpt-hud" aria-hidden="true">
      <p className="cpt-progress-label">{en ? `Letter 1 of ${settings.trials}` : `第 1 個，共 ${settings.trials} 個`}</p>
      <div className="cpt-progress-track"><div className="cpt-progress-fill" /></div>
      <span className="btn btn-ghost cpt-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <div className="cpt-stimulus-area" data-state="letter" aria-hidden="true">
      <p className="cpt-stimulus">X</p>
      <p className="cpt-rule-reminder">{variant === 'ax' ? (en ? 'Press for X right after A' : 'A 後面的 X 才按') : (en ? 'Press for X' : '看到 X 才按')}</p>
    </div>
    <div className="cpt-response-pad" aria-hidden="true">{en ? 'Press' : '按'}<small>{en ? 'or Space bar' : '或空白鍵'}</small></div>
    {active && finished && <section className="training-panel cpt-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
