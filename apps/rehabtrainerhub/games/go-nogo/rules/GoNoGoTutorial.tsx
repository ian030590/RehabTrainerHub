import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { GoNoGoSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetGoNoGoTutorialSteps } from './tutorialSteps';

// The scene matches the training stage so each spotlight lands on the real control positions.
// It shows a square in this session's press color.
export function GoNoGoTutorial({ active, ready, title, settings, summaryItems, onStart, onBack, goColor = 'blue' }: {
  active: boolean; ready: boolean; title: string; settings: GoNoGoSettings; goColor?: 'orange' | 'blue';
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const holdColor = goColor === 'orange' ? 'blue' : 'orange';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetGoNoGoTutorialSteps(lang, goColor), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack, goColor]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="go-nogo-stage go-nogo-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="go-nogo-hud" aria-hidden="true">
      <p className="go-nogo-progress-label">{settings.practice ? (en ? 'Practice 1 of 10' : '練習 1／10') : (en ? `Square 1 of ${settings.rounds}` : `第 1 個，共 ${settings.rounds} 個`)}</p>
      <div className="go-nogo-progress-track"><div className="go-nogo-progress-fill" /></div>
      <span className="btn btn-ghost go-nogo-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <div className="go-nogo-stimulus-area" data-state="target" aria-hidden="true">
      <p className="go-nogo-legend">
        <span className="go-nogo-legend-item"><span className="go-nogo-swatch" data-color={goColor} />{en ? 'Press' : '要按'}</span>
        <span className="go-nogo-legend-item"><span className="go-nogo-swatch" data-color={holdColor} />{en ? 'Hold back' : '不要按'}</span>
      </p>
      <span className="go-nogo-stimulus" data-color={goColor} />
    </div>
    <div className="go-nogo-pad" aria-hidden="true">{en ? 'Press' : '按'}<small>{en ? 'or Space bar' : '或空白鍵'}</small></div>
    {active && finished && <section className="training-panel go-nogo-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
