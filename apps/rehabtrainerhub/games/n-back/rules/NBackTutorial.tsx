import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { NBackSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetNBackTutorialSteps } from './tutorialSteps';

// The scene matches the training stage so each spotlight lands on the real control positions.
export function NBackTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: NBackSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetNBackTutorialSteps(lang), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="n-back-stage n-back-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="n-back-hud" aria-hidden="true">
      <p className="n-back-progress-label">{settings.practice ? (en ? 'Practice 1 of 25' : '練習 1／25') : (en ? `Block 1 of ${settings.rounds / 50} · 1/50` : `第 1 組（共 ${settings.rounds / 50} 組）· 1／50`)}</p>
      <p className="n-back-rule">{en ? '1 back' : '比對前 1 個'}</p>
      <div className="n-back-progress-track"><div className="n-back-progress-fill" /></div>
      <span className="btn btn-ghost n-back-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <div className="n-back-stimulus-area" data-state="target" aria-hidden="true"><p className="n-back-letter">G</p></div>
    <div className="n-back-pads" aria-hidden="true">
      <div className="n-back-pad n-back-pad-same">{en ? 'Same' : '相同'}<small>← / F</small></div>
      <div className="n-back-pad n-back-pad-different">{en ? 'Different' : '不同'}<small>↓ / J</small></div>
    </div>
    {active && finished && <section className="training-panel n-back-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
