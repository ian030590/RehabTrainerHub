import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { LetterMemorySettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetLetterMemoryTutorialSteps } from './tutorialSteps';
import { LetterEntry, LetterPad } from '../LetterPad';

// The scene matches the training stage so each spotlight lands on the real control positions.
// It shows the letter L on screen and the example answer K N F L typed in.
export function LetterMemoryTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: LetterMemorySettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetLetterMemoryTutorialSteps(lang, settings.itemExposureMs), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack, settings.itemExposureMs]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="lm-stage letter-memory-tutorial" data-state="tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="lm-hud" aria-hidden="true">
      <p className="lm-progress-label">{settings.practice ? (en ? 'Practice 1 of 2' : '練習 1／2') : (en ? `Item 1 of ${settings.rounds}` : `第 1 題，共 ${settings.rounds} 題`)}</p>
      <div className="lm-progress-track"><div className="lm-progress-fill" /></div>
      <span className="btn btn-ghost lm-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <div className="lm-display" aria-hidden="true"><p className="lm-letter">L</p></div>
    <div className="lm-answer-area" aria-hidden="true">
      <LetterEntry entry={['K', 'N', 'F', 'L']} en={en} />
      <LetterPad en={en} active={false} full inert />
      <footer className="lm-actions"><span className="btn btn-primary lm-submit">{en ? 'Submit' : '送出答案'}</span></footer>
    </div>
    {active && finished && <section className="training-panel lm-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
