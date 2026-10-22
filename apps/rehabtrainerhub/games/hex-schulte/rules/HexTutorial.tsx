import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { HexSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetHexTutorialSteps } from './tutorialSteps';
import { CreateHexBoard, CreateRandom } from '../logic/hexBoard';
import { HexBoard } from '../HexBoard';

// The scene matches the training stage so each spotlight lands on the real control positions.
export function HexTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: HexSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const rings = settings.rings || 2;
  const cells = CreateHexBoard(rings, CreateRandom(rings * 31));
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetHexTutorialSteps(lang, settings), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, settings, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="hex-stage hex-schulte-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="hex-hud" aria-hidden="true">
      <p className="hex-round">{en ? `Round 1 of ${settings.rounds}` : `第 1 回合，共 ${settings.rounds} 回合`}</p>
      <p className="hex-next">{en ? 'Find' : '下一個'} <strong>1</strong></p>
      <p className="hex-clock">0.0 {en ? 's' : '秒'}</p>
      <span className="btn btn-ghost hex-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <p className="hex-feedback" aria-hidden="true" />
    <HexBoard rings={rings} cells={cells} start={1} label="" centerLabel="" foundLabel="" />
    {active && finished && <section className="training-panel hex-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
