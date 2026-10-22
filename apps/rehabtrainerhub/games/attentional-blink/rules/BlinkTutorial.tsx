import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { BlinkSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetBlinkTutorialSteps } from './tutorialSteps';

const digits = [2, 3, 4, 5, 6, 7, 8, 9];

// The scene matches the training stage so each spotlight lands on the real control positions.
export function BlinkTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: BlinkSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetBlinkTutorialSteps(lang), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="blink-stage attentional-blink-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="blink-hud" aria-hidden="true">
      <p className="blink-progress-label">{en ? `Round 1 of ${settings.trials}` : `第 1 回，共 ${settings.trials} 回`}</p>
      <div className="blink-progress-track"><div className="blink-progress-fill" /></div>
      <span className="btn btn-ghost blink-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <div className="blink-stimulus-area" aria-hidden="true"><p className="blink-stimulus">7</p></div>
    <div className="blink-answer" aria-hidden="true">
      <p className="blink-prompt">{en ? 'What was the first digit?' : '第一個數字是？'}</p>
      <div className="blink-keypad">{digits.map(digit => <span key={digit} className="blink-key">{digit}</span>)}</div>
    </div>
    {active && finished && <section className="training-panel blink-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
