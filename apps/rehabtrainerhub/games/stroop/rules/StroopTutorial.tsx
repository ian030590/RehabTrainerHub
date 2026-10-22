import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { StroopSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetStroopTutorialSteps } from './tutorialSteps';

const swatches = [['red', '紅', 'Red', 'R'], ['green', '綠', 'Green', 'G'], ['blue', '藍', 'Blue', 'B']] as const;

// The scene matches the training stage so each spotlight lands on the real control positions.
// It shows the word for green printed in blue ink, so the right answer is the blue button.
export function StroopTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: StroopSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetStroopTutorialSteps(lang), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="stroop-stage stroop-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="stroop-hud" aria-hidden="true">
      <p className="stroop-progress-label">{settings.practice ? (en ? 'Practice 1 of 24' : '練習 1／24') : (en ? `Item 1 of ${settings.rounds}` : `第 1 題，共 ${settings.rounds} 題`)}</p>
      <div className="stroop-progress-track"><div className="stroop-progress-fill" /></div>
      <span className="btn btn-ghost stroop-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <div className="stroop-stimulus-area" data-state="word" aria-hidden="true">
      <p className="stroop-word" data-ink="blue">{en ? 'GREEN' : '綠'}</p>
      <p className="stroop-rule-reminder">{en ? 'Answer the ink color: blue.' : '回答字的顏色：藍色'}</p>
    </div>
    <div className="stroop-pads" aria-hidden="true">
      {swatches.map(([color, zh, english, key]) => <div key={color} className="stroop-pad" data-color={color}>
        <span className="stroop-pad-swatch" />{en ? english : zh}<small>{key}</small></div>)}
    </div>
    {active && finished && <section className="training-panel stroop-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
