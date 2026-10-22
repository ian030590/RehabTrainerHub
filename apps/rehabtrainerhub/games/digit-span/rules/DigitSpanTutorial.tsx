import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { DigitSpanSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetDigitSpanTutorialSteps } from './tutorialSteps';

// The scene matches the training stage so each spotlight lands on the real control positions.
export function DigitSpanTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: DigitSpanSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetDigitSpanTutorialSteps(lang), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="digit-span-stage digit-span-tutorial" data-state="digit" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="digit-span-hud" aria-hidden="true">
      <p className="digit-span-progress-label">{settings.practice ? (en ? 'Practice 1 of 2' : '練習 1／2') : (en ? `Forward 1 of ${settings.rounds / 2}` : `順向 1／${settings.rounds / 2}`)}</p>
      <p className="digit-span-direction">{en ? 'Forward' : '順向：照順序'}</p>
      <div className="digit-span-progress-track"><div className="digit-span-progress-fill" /></div>
      <span className="btn btn-ghost digit-span-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <div className="digit-span-display-area" aria-hidden="true">
      <p className="digit-span-display">7</p>
      <div className="digit-span-entry"><span className="digit-span-entry-digit">4</span><span className="digit-span-entry-digit">8</span></div>
    </div>
    <div className="digit-span-keypad" aria-hidden="true">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => <span key={digit} className="digit-span-key">{digit}</span>)}
      <span className="digit-span-key digit-span-back">{en ? 'Delete' : '刪除'}</span>
      <span className="digit-span-key digit-span-clear">{en ? 'Clear' : '清除'}</span>
      <span className="digit-span-key digit-span-submit">{en ? 'Submit' : '送出'}</span>
    </div>
    {active && finished && <section className="training-panel digit-span-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
