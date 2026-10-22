import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { MazeSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetMazeTutorialSteps } from './tutorialSteps';
import { CreateMaze, CreateRandom, mazeSizes } from '../logic/maze';
import { FormatRemaining, MazeBoard } from '../MazeBoard';
import { DirectionPad } from '../DirectionPad';

// A fixed seed keeps the demo maze the same each time the tutorial opens.
const demoSeed = 20261023;

// The scene matches the training stage so each spotlight lands on the real control positions.
export function MazeTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: MazeSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const size = mazeSizes[settings.difficulty] ?? mazeSizes.medium;
  const maze = useMemo(() => CreateMaze(size, CreateRandom(demoSeed)), [size]);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetMazeTutorialSteps(lang, settings.timeLimitSec), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack, settings.timeLimitSec]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="mz-stage maze-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="mz-hud" aria-hidden="true">
      <p className="mz-hint"><span className="mz-goal-icon" />{en ? 'Reach the green goal' : '走到綠色終點'}</p>
      <p className="mz-moves">{en ? 'Moves' : '步數'} 0</p>
      <p className="mz-clock">{settings.timeLimitSec ? FormatRemaining(settings.timeLimitSec * 1000, en) : `0.0 ${en ? 's' : '秒'}`}</p>
      <span className="btn btn-ghost mz-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <p className="mz-feedback" aria-hidden="true" />
    <div className="mz-play" aria-hidden="true">
      <MazeBoard maze={maze} current={maze.start} />
      <DirectionPad en={en} inert />
    </div>
    {active && finished && <section className="training-panel mz-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
