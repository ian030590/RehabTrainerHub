import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { PatternSettings } from '../settings';
import { PatternBoard } from '../PatternBoard';
import { StartTour } from '../runtime/tour';
import { GetPatternTutorialSteps } from './tutorialSteps';

const sampleBoard = [{ cell: 0, color: 0, shape: 2 }, { cell: 4, color: 3, shape: 0 }, { cell: 5, color: 1, shape: 3 }];

// The scene matches the training stage so each spotlight lands on the real control positions.
export function PatternTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: PatternSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetPatternTutorialSteps(lang), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="pattern-stage pattern-memory-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="pattern-hud" aria-hidden="true">
      <p className="pattern-progress-label">{en ? `Trial 1 of ${settings.trials}` : `第 1 題，共 ${settings.trials} 題`}</p>
      <p className="pattern-load">{en ? `${settings.startLoad} shapes` : `${settings.startLoad} 個圖形`}</p>
      <div className="pattern-progress-track"><div className="pattern-progress-fill" /></div>
      <span className="btn btn-ghost pattern-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <div className="pattern-board-area" aria-hidden="true"><PatternBoard items={sampleBoard} step="study" en={en} /></div>
    <div className="pattern-controls" aria-hidden="true">
      <p className="pattern-prompt">{en ? 'Remember the board.' : '記住這個畫面。'}</p>
      <div className="pattern-answers">
        <span className="pattern-answer">{en ? 'Same' : '一樣'}<small>{en ? 'F or ←' : 'F 或 ←'}</small></span>
        <span className="pattern-answer">{en ? 'Changed' : '有變'}<small>{en ? 'J or →' : 'J 或 →'}</small></span>
      </div>
    </div>
    {active && finished && <section className="training-panel pattern-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
