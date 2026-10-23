import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import { StartTour } from '../runtime/tour';
import { GetEveryBallTutorialSteps } from './tutorialSteps';
import { copy, levelRules } from '../labels';
import { BallIcon } from '../BallIcon';

// The rule cards and the trial timeline sit on the real stage, so the HUD, camera window and buttons the
// spotlights point at are the ones used during play.
export function EveryBallTutorial({ active, ready, title, settings, summaryItems, onStart, onBack, inputReady = false, status = '' }: {
  active: boolean; ready: boolean; title: string; settings: { difficulty?: unknown; inputMode?: unknown };
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void; inputReady?: boolean; status?: string;
}) {
  const { lang } = useT();
  const labels = copy[lang];
  const level = settings.difficulty === 'hard' ? 3 : settings.difficulty === 'easy' ? 1 : 2;
  const inputMode = settings.inputMode === 'microphone' ? 'microphone' : 'camera';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetEveryBallTutorialSteps(lang, inputMode, level), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, inputMode, lang, level, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(); }, [finished, ready]);
  const seconds = (value: number) => lang === 'en' ? `${value} s` : `${value} 秒`;
  return <section className="every-ball-tutorial" aria-label={lang === 'en' ? 'Game tutorial scene' : '遊戲說明場景'}>
    <div className="every-ball-preview-scene" aria-hidden="true">
      <ul className="every-ball-rule-cards">
        {levelRules[level].map(([ball, action]) => <li key={ball} className={`every-ball-rule-card every-ball-rule-${action}`}>
          <BallIcon ball={ball} /><strong>{labels.ballNames[ball]}</strong><span>{labels.actionNames[action]}</span>
        </li>)}
      </ul>
      <ol className="every-ball-trial-preview">
        <li><span className="every-ball-step-mark every-ball-step-fixation">+</span><strong>{lang === 'en' ? 'Wait' : '等待'}</strong><span>{lang === 'en' ? '1 to 3 s' : '1 到 3 秒'}</span></li>
        <li><span className="every-ball-step-mark"><BallIcon ball="basketball" /></span><strong>{lang === 'en' ? 'Ball' : '球出現'}</strong><span>{seconds(0.9)}</span></li>
        <li><span className="every-ball-step-mark every-ball-step-respond">{labels.actionNames.clap}</span><strong>{lang === 'en' ? 'Respond within' : '反應時限'}</strong><span>{seconds(1.8)}</span></li>
        <li><span className="every-ball-step-mark every-ball-step-feedback"><span className="every-ball-step-correct">✓</span><span className="every-ball-step-wrong">✕</span></span>
          <strong>{lang === 'en' ? 'Feedback' : '回饋'}</strong><span>{seconds(0.55)}</span></li>
      </ol>
    </div>
    {active && finished && <section className="training-panel every-ball-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); onBack(); }
        if (event.key === 'Tab') {
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
          event.preventDefault();
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
        }
      }}>
      <div ref={confirmationRef} className="training-config training-confirmation">
        <header className="training-config-header"><h2>{title}</h2></header>
        <div className="training-config-body"><section className="training-setting"><h3>{labels.confirm}</h3>
          <div className="training-config-summary">{summaryItems.map(item => <p className="training-config-summary-item" key={item.label}><strong>{item.label}：</strong>{item.value}</p>)}</div>
          <p className="every-ball-input-status" role="status">{status || labels.privacy}</p>
        </section></div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button type="button" className="btn btn-primary" disabled={!ready} onClick={onStart}>{inputReady ? labels.start : labels.enable[inputMode]}</button>
          <button type="button" className="btn btn-ghost" onClick={onBack}>{labels.backSettings}</button>
        </div></footer>
      </div>
    </section>}
  </section>;
}
