import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { SlidingPuzzleSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetSlidingTutorialSteps } from './tutorialSteps';
import { CreateSlidingPuzzle, slidingConfig } from '../logic/slidingPuzzle';
import { FormatRemaining, SlidingBoard, TileStyle } from '../SlidingBoard';

// The scene matches the training stage so each spotlight lands on the real control positions.
export function SlidingTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: SlidingPuzzleSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const size = (slidingConfig[settings.difficulty] ?? slidingConfig.medium).size;
  const last = size * size - 1;
  // One step from solved: the highlighted tile below the gap finishes the demo board.
  const tiles = useMemo(() => CreateSlidingPuzzle(size, 1, () => 0), [size]);
  const tutorialIndex = size * size - 1;
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetSlidingTutorialSteps(lang, settings.timeLimitSec, last), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack, settings.timeLimitSec, last]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="sp-stage sliding-puzzle-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="sp-hud" aria-hidden="true">
      <p className="sp-goal">{en ? `Order 1 to ${last}` : `排成 1 到 ${last}`}</p>
      <p className="sp-moves">{en ? 'Moves' : '步數'} 0</p>
      <p className="sp-clock">{settings.timeLimitSec ? FormatRemaining(settings.timeLimitSec * 1000, en) : `0.0 ${en ? 's' : '秒'}`}</p>
      <span className="btn btn-ghost sp-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <p className="sp-feedback" aria-hidden="true" />
    <div className="sp-board-slot" aria-hidden="true">
      <SlidingBoard size={size}>
        {tiles.map((tile, index) => tile !== 0 && <span key={tile} className="sp-tile" style={TileStyle(index, size)} data-tile={tile}
          data-tutorial={index === tutorialIndex ? 'move' : undefined}>{tile}</span>)}
      </SlidingBoard>
    </div>
    {active && finished && <section className="training-panel sp-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
