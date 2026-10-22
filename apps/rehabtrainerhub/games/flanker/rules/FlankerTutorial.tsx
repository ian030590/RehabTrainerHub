import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { FlankerSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetFlankerTutorialSteps } from './tutorialSteps';

// The scene matches the training stage so each spotlight lands on the real control positions.
// It shows the middle item pointing right with the four flankers pointing left.
export function FlankerTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: FlankerSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const arrows = settings.stimulus === 'arrows';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetFlankerTutorialSteps(lang, settings.stimulus), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack, settings.stimulus]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="flanker-stage flanker-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="flanker-hud" aria-hidden="true">
      <p className="flanker-progress-label">{settings.practice ? (en ? 'Practice 1 of 12' : '練習 1／12') : (en ? `Item 1 of ${settings.rounds}` : `第 1 題，共 ${settings.rounds} 題`)}</p>
      <div className="flanker-progress-track"><div className="flanker-progress-fill" /></div>
      <span className="btn btn-ghost flanker-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <div className="flanker-stimulus-area" data-state="target" aria-hidden="true">
      <p className="flanker-row" data-mode={settings.stimulus}>
        {[0, 1, 2, 3, 4].map(position => <span key={position} className="flanker-item" data-dir={position === 2 ? 'right' : 'left'}>
          <svg className="flanker-arrow" viewBox="0 0 48 48"><path d="M6 24h34M26 10l14 14-14 14" /></svg>
          <span className="flanker-letter">{position === 2 ? 'H' : 'F'}</span></span>)}
      </p>
      <p className="flanker-rule-reminder">{arrows ? (en ? 'The middle arrow points right.' : '中間的箭頭指向右邊') : (en ? 'The middle letter is H.' : '中間的字母是 H')}</p>
    </div>
    <div className="flanker-pads" aria-hidden="true">
      <div className="flanker-pad flanker-pad-left">{arrows ? (en ? 'Left' : '左') : 'F'}<small>{arrows ? 'F / ←' : 'F'}</small></div>
      <div className="flanker-pad flanker-pad-right">{arrows ? (en ? 'Right' : '右') : 'H'}<small>{arrows ? 'J / →' : 'H'}</small></div>
    </div>
    {active && finished && <section className="training-panel flanker-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
