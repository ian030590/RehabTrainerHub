import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { ReactionSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetReactionTutorialSteps } from './tutorialSteps';

// The scene matches the training stage so each spotlight lands on the real control positions; it shows the red wait.
export function ReactionTutorial({ active, ready, title, settings, range, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: ReactionSettings; range: string;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetReactionTutorialSteps(lang, range, settings.rounds), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack, range, settings.rounds]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="reaction-time-stage reaction-time-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="reaction-time-hud" aria-hidden="true">
      <p className="reaction-time-progress-label">{en ? `Timed: 0 of ${settings.rounds}` : `成功 0／${settings.rounds}`}</p>
      <p className="reaction-time-early">{en ? 'Too early: 0' : '太早 0 次'}</p>
      {settings.timeLimitSec > 0 && <p className="reaction-time-timer">{en ? `${settings.timeLimitSec / 60}:00 left` : `剩 ${settings.timeLimitSec / 60}:00`}</p>}
      <div className="reaction-time-progress-track"><div className="reaction-time-progress-fill" /></div>
      <span className="btn btn-ghost reaction-time-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <div className="reaction-time-panel" data-state="wait" aria-hidden="true">
      <p className="reaction-time-label">{en ? 'Wait…' : '等待…'}</p>
      <p className="reaction-time-hint">{en ? 'Press when it turns green' : '變綠色再按'}</p>
    </div>
    {active && finished && <section className="training-panel reaction-time-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
