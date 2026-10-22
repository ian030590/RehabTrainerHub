import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { WhackAMoleSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetWhackTutorialSteps } from './tutorialSteps';
import { whackConfig } from '../logic/whackAMole';
import { FormatRemaining, HoleBoard, HoleContents } from '../HoleBoard';

// The scene matches the training stage so each spotlight lands on the real control positions.
export function WhackTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: WhackAMoleSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const { gridSize, targetMs } = whackConfig[settings.difficulty] ?? whackConfig.medium;
  // The demo mole is up near the middle of the board.
  const moleIndex = Math.floor(gridSize / 2) * gridSize + Math.floor((gridSize - 1) / 2);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetWhackTutorialSteps(lang, settings.durationSec, targetMs), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack, settings.durationSec, targetMs]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="wm-stage whack-a-mole-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="wm-hud" aria-hidden="true">
      <p className="wm-hits">{en ? 'Hits' : '打中'} <strong>0</strong></p>
      <p className="wm-misses">{en ? 'Misses' : '漏掉'} 0</p>
      <p className="wm-clock">{FormatRemaining(settings.durationSec * 1000, en)}</p>
      <span className="btn btn-ghost wm-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <p className="wm-feedback" aria-hidden="true" />
    <div className="wm-board-slot" aria-hidden="true">
      <HoleBoard size={gridSize}>
        {Array.from({ length: gridSize * gridSize }, (_, index) => <span key={index} className="wm-hole" data-up={index === moleIndex ? 'true' : undefined}
          data-tutorial={index === moleIndex ? 'move' : undefined}><HoleContents /></span>)}
      </HoleBoard>
    </div>
    {active && finished && <section className="training-panel wm-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
