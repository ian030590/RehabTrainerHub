import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { AntSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { ArrowRow } from '../ArrowRow';
import { GetAntTutorialSteps } from './tutorialSteps';

// The scene matches the training stage so each spotlight lands on the real control positions.
// It shows an incongruent row above the cross.
export function AntTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: AntSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetAntTutorialSteps(lang), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="ant-stage attention-network-task-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="ant-hud" aria-hidden="true">
      <p className="ant-progress-label">{settings.practice ? (en ? 'Practice 1 of 24' : '練習 1／24') : (en ? `Block 1 of ${settings.rounds / 48} · 1/48` : `第 1 組（共 ${settings.rounds / 48} 組）· 1／48`)}</p>
      <div className="ant-progress-track"><div className="ant-progress-fill" /></div>
      <span className="btn btn-ghost ant-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <div className="ant-stimulus-area" data-state="target" data-cue="spatial" data-location="up" aria-hidden="true">
      <div className="ant-slot ant-slot-up"><span className="ant-star ant-star-up">*</span><ArrowRow slot="up" kinds={['right', 'right', 'left', 'right', 'right']} /></div>
      <div className="ant-slot ant-slot-center"><span className="ant-fixation">+</span><span className="ant-star ant-star-center">*</span></div>
      <div className="ant-slot ant-slot-down"><span className="ant-star ant-star-down">*</span><ArrowRow slot="down" /></div>
    </div>
    <div className="ant-pads" aria-hidden="true">
      <div className="ant-pad ant-pad-left">{en ? 'Left' : '左'}<small>← / F</small></div>
      <div className="ant-pad ant-pad-right">{en ? 'Right' : '右'}<small>→ / J</small></div>
    </div>
    {active && finished && <section className="training-panel ant-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
