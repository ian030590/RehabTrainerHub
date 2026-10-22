import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { SimonSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetSimonTutorialSteps } from './tutorialSteps';

// The scene matches the training stage so each spotlight lands on the real control positions.
// It shows a circle on the right, the case where position and answer disagree.
export function SimonTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: SimonSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetSimonTutorialSteps(lang), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="simon-stage simon-task-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="simon-hud" aria-hidden="true">
      <p className="simon-progress-label">{en ? `Shape 1 of ${settings.trials}` : `第 1 個，共 ${settings.trials} 個`}</p>
      <div className="simon-progress-track"><div className="simon-progress-fill" /></div>
      <span className="btn btn-ghost simon-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <div className="simon-stimulus-area" data-state="shape" aria-hidden="true">
      <p className="simon-fixation">+</p>
      <span className="simon-stimulus" data-shape="circle" data-side="right" />
      <p className="simon-rule-reminder">{en ? 'Circle: left. Square: right.' : '圓形按左，方形按右'}</p>
    </div>
    <div className="simon-pads" aria-hidden="true">
      <div className="simon-pad simon-pad-left"><span className="simon-pad-mark" data-shape="circle" />{en ? 'Left' : '左'}<small>F / ←</small></div>
      <div className="simon-pad simon-pad-right"><span className="simon-pad-mark" data-shape="square" />{en ? 'Right' : '右'}<small>J / →</small></div>
    </div>
    {active && finished && <section className="training-panel simon-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
