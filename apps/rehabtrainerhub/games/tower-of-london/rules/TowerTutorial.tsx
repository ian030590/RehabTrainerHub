import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { TowerSettings } from '../settings';
import { practiceProblem, startBoard } from '../logic/towerOfLondon';
import { BallLabel, countedTotal, TowerBoard } from '../TowerBoard';
import { StartTour } from '../runtime/tour';
import { GetTowerTutorialSteps } from './tutorialSteps';

// The scene matches the training stage so each spotlight lands on the real control positions.
export function TowerTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: TowerSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetTowerTutorialSteps(lang), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  // The scene shows the practice problem with the red ball lifted from the first peg.
  const board = [[1], startBoard[1], []];
  return <section className="tower-stage tower-of-london-tutorial" data-state="play" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="tower-hud" aria-hidden="true">
      <p className="tower-progress-label">{settings.practice ? (en ? 'Practice' : '練習') : (en ? `Problem 1 of ${countedTotal}` : `第 1／${countedTotal} 題`)}</p>
      <p className="tower-timer">{en ? `${settings.problemLimitMs / 1000} s left` : `剩 ${settings.problemLimitMs / 1000} 秒`}</p>
      <div className="tower-progress-track"><div className="tower-progress-fill" /></div>
      <span className="btn btn-ghost tower-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <p className="tower-message" aria-hidden="true">{en ? 'Make your board match the target' : '把你的盤面排成目標的樣子'}</p>
    <div className="tower-boards" aria-hidden="true">
      <section className="tower-panel tower-panel-target">
        <h2 className="tower-panel-title">{en ? 'Target' : '目標'}</h2>
        <TowerBoard board={practiceProblem.target} en={en} label="" />
      </section>
      <section className="tower-panel tower-panel-yours">
        <h2 className="tower-panel-title">{en ? 'Your board' : '你的盤面'}</h2>
        <TowerBoard board={board} en={en} label="" />
      </section>
    </div>
    <div className="tower-status" aria-hidden="true">
      <div className="tower-hand"><p className="tower-hand-label">{en ? 'In your hand' : '手上的球'}</p>
        <span className="tower-hand-slot"><span className="tower-ball tower-ball-2">{BallLabel(2, en)}</span></span></div>
      <p className="tower-moves">{en ? 'Moves: 1' : '已移動 1 步'}<span className="tower-minimum">{en ? 'Fewest possible: 1' : '這題最少 1 步'}</span></p>
    </div>
    {active && finished && <section className="training-panel tower-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
