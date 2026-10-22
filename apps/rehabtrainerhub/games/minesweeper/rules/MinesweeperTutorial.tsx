import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { MinesweeperSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetMinesweeperTutorialSteps } from './tutorialSteps';
import { boardSizes, CreateRandom, mineDensity, MineField } from '../logic/minesweeper';
import { CellFace, CellState, FormatElapsed, MineBoard, MineCounter, ZoomControls } from '../MineBoard';

const demoSeed = 20261023;

// Fixed seeds give the same half-played demo board each time: some cells open, one number to point at, one flag.
function CreateDemoField(settings: MinesweeperSettings) {
  const difficulty = settings.difficulty in mineDensity ? settings.difficulty : 'medium';
  const boardSize = settings.boardSize in boardSizes ? settings.boardSize : 'medium';
  let demo = null;
  for (let seed = demoSeed; seed < demoSeed + 50; seed++) {
    const field = new MineField(difficulty, boardSize, CreateRandom(seed), 0);
    const center = Math.floor(field.size / 2) * field.size + Math.floor(field.size / 2);
    field.open(center, 0);
    const number = field.cells.findIndex(cell => cell.open && cell.adjacent > 0);
    const covered = field.cells.findIndex((cell, index) => !cell.open && !cell.mine && field.neighbors(index).some(near => field.cells[near].open));
    const flag = number < 0 ? undefined : field.neighbors(number).find(near => field.cells[near].mine);
    demo = { field, number, covered };
    if (field.outcome || number < 0 || covered < 0 || flag === undefined) continue;
    field.toggleFlag(flag, 0);
    break;
  }
  return demo as { field: MineField; number: number; covered: number };
}

// The scene matches the training stage so each spotlight lands on the real control positions.
export function MinesweeperTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: MinesweeperSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const { field, number, covered } = useMemo(() => CreateDemoField(settings), [settings]);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetMinesweeperTutorialSteps(lang, field.mineCount), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack, field]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="ms-stage minesweeper-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="ms-hud" aria-hidden="true">
      <MineCounter flags={field.flags} mines={field.mineCount} en={en} />
      <p className="ms-clock">{FormatElapsed(0, en)}</p>
      <span className="btn btn-ghost ms-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <p className="ms-feedback" aria-hidden="true" />
    <div className="ms-board-slot" aria-hidden="true">
      <MineBoard size={field.size} zoom={1}>
        {field.cells.map((cell, index) => <span key={index} className="ms-cell" data-index={index} data-state={CellState(cell)}
          data-count={cell.open && !cell.mine ? cell.adjacent : undefined}
          data-tutorial={index === covered ? 'move' : index === number ? 'number' : undefined}><CellFace cell={cell} /></span>)}
      </MineBoard>
    </div>
    <footer className="ms-tools" aria-hidden="true">
      <ZoomControls zoom={1} en={en} inert />
      <span className="btn ms-flag-mode">{en ? 'Flag mode' : '標記模式'}</span>
    </footer>
    {active && finished && <section className="training-panel ms-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
