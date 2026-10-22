import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { StopSignalSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { KeyGuide, ShapeIcon, StopStar } from '../shapes';
import { GetStopSignalTutorialSteps } from './tutorialSteps';

// The scene matches the training stage so each spotlight lands on the real control positions.
// It shows a shape with the star and this session's key guide.
export function StopSignalTutorial({ active, ready, title, settings, summaryItems, onStart, onBack, keyMap = ['left', 'right', 'left', 'right'] }: {
  active: boolean; ready: boolean; title: string; settings: StopSignalSettings; keyMap?: ('left' | 'right')[];
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetStopSignalTutorialSteps(lang), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="stop-signal-stage stop-signal-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="stop-signal-hud" aria-hidden="true">
      <p className="stop-signal-progress-label">{settings.practice ? (en ? 'Practice 1 of 12' : '練習 1／12') : (en ? `Block 1 of ${settings.rounds / 50} · 1/50` : `第 1 組（共 ${settings.rounds / 50} 組）· 1／50`)}</p>
      <div className="stop-signal-progress-track"><div className="stop-signal-progress-fill" /></div>
      <span className="btn btn-ghost stop-signal-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <div className="stop-signal-stimulus-area" data-state="target" data-signal="on" aria-hidden="true">
      <span className="stop-signal-stimulus" data-shape="0"><StopStar /><ShapeIcon shape={0} /></span>
    </div>
    <div className="stop-signal-pads" aria-hidden="true">
      {(['left', 'right'] as const).map(side => <div key={side} className={`stop-signal-pad stop-signal-pad-${side}`}>
        <KeyGuide keyMap={keyMap} side={side} /><span>{side === 'left' ? (en ? 'Left' : '左') : (en ? 'Right' : '右')}</span><small>{side === 'left' ? 'Z' : 'M'}</small></div>)}
    </div>
    {active && finished && <section className="training-panel stop-signal-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
