import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { MemoryMatchSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetMemoryTutorialSteps } from './tutorialSteps';
import { CreateDeck, CreateRandom, memoryConfig } from '../logic/memoryMatch';
import { CardBoard, CardFaces, FormatRemaining } from '../CardBoard';

// A fixed seed keeps the demo board the same each time the tutorial opens.
const demoSeed = 20261023;

// The scene matches the training stage so each spotlight lands on the real control positions.
export function MemoryTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: MemoryMatchSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const { rows, cols, pairs } = memoryConfig[settings.difficulty] ?? memoryConfig.medium;
  const deck = useMemo(() => CreateDeck(pairs, CreateRandom(demoSeed)), [pairs]);
  // The demo shows one found pair, so the check mark the tutorial mentions is on the board.
  const shown = deck.at(-1);
  const tutorialIndex = deck.findIndex(value => value !== shown);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetMemoryTutorialSteps(lang, settings.timeLimitSec, pairs), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack, settings.timeLimitSec, pairs]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="mm-stage memory-match-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="mm-hud" aria-hidden="true">
      <p className="mm-pairs">{en ? 'Pairs' : '配對'} <strong>1 / {pairs}</strong></p>
      <p className="mm-moves">{en ? 'Moves' : '步數'} 1</p>
      <p className="mm-clock">{settings.timeLimitSec ? FormatRemaining(settings.timeLimitSec * 1000, en) : `0.0 ${en ? 's' : '秒'}`}</p>
      <span className="btn btn-ghost mm-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <p className="mm-feedback" aria-hidden="true" />
    <div className="mm-board-slot" aria-hidden="true">
      <CardBoard rows={rows} cols={cols}>
        {deck.map((value, index) => <span key={index} className="mm-card" data-state={value === shown ? 'matched' : 'down'}
          data-tutorial={index === tutorialIndex ? 'move' : undefined}><CardFaces value={value} /></span>)}
      </CardBoard>
    </div>
    {active && finished && <section className="training-panel mm-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
