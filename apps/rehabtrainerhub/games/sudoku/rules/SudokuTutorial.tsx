import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { SudokuSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetSudokuTutorialSteps } from './tutorialSteps';
import { CreateNumberGrid, CreateRandom } from '../logic/numberGrid';
import { CellEdges, FormatRemaining, NumberBoard, RuleText } from '../NumberBoard';

// A fixed seed keeps the demo board the same each time the tutorial opens.
const demoSeed = 20261023;

// The scene matches the training stage so each spotlight lands on the real control positions.
export function SudokuTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: SudokuSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const grid = useMemo(() => CreateNumberGrid(settings.difficulty, CreateRandom(demoSeed)), [settings.difficulty]);
  const tutorialIndex = grid.givens.indexOf(false);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetSudokuTutorialSteps(lang, settings.timeLimitSec, grid.kind, grid.maxValue), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack, settings.timeLimitSec, grid]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="sk-stage sudoku-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="sk-hud" aria-hidden="true">
      <p className="sk-rule">{RuleText(grid.kind, en)}</p>
      <p className="sk-moves">{en ? 'Entries' : '填寫'} 0</p>
      <p className="sk-clock">{settings.timeLimitSec ? FormatRemaining(settings.timeLimitSec * 1000, en) : `0.0 ${en ? 's' : '秒'}`}</p>
      <span className="btn btn-ghost sk-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <p className="sk-feedback" aria-hidden="true" />
    <div className="sk-board-slot" aria-hidden="true">
      <NumberBoard size={grid.size}>
        {grid.values.map((value, index) => <span key={index} className="sk-cell" data-index={index} data-given={grid.givens[index] ? 'true' : undefined}
          data-tutorial={index === tutorialIndex ? 'move' : undefined} {...CellEdges(index, grid.size, grid.kind)}>{value || ''}</span>)}
      </NumberBoard>
    </div>
    {active && finished && <section className="training-panel sk-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
