import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { AntisaccadeSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetAntisaccadeTutorialSteps } from './tutorialSteps';
import { DirectionName, directionKeys, Slot } from '../Stimulus';

// The scene matches the training stage so each spotlight lands on the real control positions.
// It shows the square on the left and, on the right, the arrow pointing up.
export function AntisaccadeTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: AntisaccadeSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetAntisaccadeTutorialSteps(lang, settings.exposureMs), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack, settings.exposureMs]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="as-stage antisaccade-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="as-hud" aria-hidden="true">
      <p className="as-progress-label">{settings.practice ? (en ? 'Practice 1 of 22' : '練習 1／22') : (en ? `Item 1 of ${settings.rounds}` : `第 1 題，共 ${settings.rounds} 題`)}</p>
      <div className="as-progress-track"><div className="as-progress-fill" /></div>
      <span className="btn btn-ghost as-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <div className="as-field" data-state="tutorial" aria-hidden="true">
      <Slot side="left" show="cue" tutorial="cue" />
      <p className="as-fixation">+</p>
      <Slot side="right" show="arrow" arrow="up" tutorial="arrow" />
    </div>
    <div className="as-pads" aria-hidden="true">
      {(['left', 'up', 'right'] as const).map(direction => <span key={direction} className={`as-pad as-pad-${direction}`}>
        {DirectionName(direction, en)}<small>{directionKeys[direction]}</small></span>)}
    </div>
    {active && finished && <section className="training-panel as-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
