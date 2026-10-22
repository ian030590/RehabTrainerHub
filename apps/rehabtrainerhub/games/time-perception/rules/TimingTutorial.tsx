import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { TimingSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetTimingTutorialSteps } from './tutorialSteps';

// The scene matches the training stage so each spotlight lands on the real control positions.
export function TimingTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: TimingSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const mode = settings.mode;
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetTimingTutorialSteps(lang, mode), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, mode, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  const first = mode === 'mixed' ? 'reproduce' : mode;
  return <section className="time-stage time-perception-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="time-hud" aria-hidden="true">
      <p className="time-progress-label">{en ? `Trial 1 of ${settings.trials}` : `第 1 題，共 ${settings.trials} 題`}</p>
      <div className="time-progress-track"><div className="time-progress-fill" /></div>
      <span className="btn btn-ghost time-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <div className="time-lamp-area" aria-hidden="true"><span className="time-lamp" data-on="true" /></div>
    <div className="time-controls" aria-hidden="true">
      <p className="time-prompt">{en ? 'Watch the dot.' : '注意圓點亮多久。'}</p>
      {first === 'reproduce' && <span className="time-hold">{en ? 'Hold for the same time' : '按住同樣久'}<small>{en ? 'or hold the Space bar' : '或按住空白鍵'}</small></span>}
      {first === 'compare' && <div className="time-choices" data-count="2">
        <span className="time-choice">{en ? 'First was longer' : '第一次較長'}</span><span className="time-choice">{en ? 'Second was longer' : '第二次較長'}</span></div>}
      {first === 'estimate' && <div className="time-choices" data-count="5">{[1, 2, 3, 4, 5].map(second => <span key={second} className="time-choice">{en ? `${second} s` : `${second} 秒`}</span>)}</div>}
    </div>
    {active && finished && <section className="training-panel time-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
