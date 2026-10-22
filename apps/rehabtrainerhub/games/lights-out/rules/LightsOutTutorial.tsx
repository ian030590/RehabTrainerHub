import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { LightsOutSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetLightsOutTutorialSteps } from './tutorialSteps';
import { lightsConfig, Toggle } from '../logic/lightsOut';
import { FormatRemaining, LightsBoard } from '../LightsBoard';

// The scene matches the training stage so each spotlight lands on the real control positions.
export function LightsOutTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: LightsOutSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const size = (lightsConfig[settings.difficulty] ?? lightsConfig.medium).size;
  const center = Math.floor(size / 2) * size + Math.floor(size / 2);
  // One press at the center lights a plus shape, so the highlighted cell solves the demo board.
  const lights = useMemo(() => {
    const board = Array<boolean>(size * size).fill(false);
    Toggle(board, size, center);
    return board;
  }, [size, center]);
  const lit = lights.filter(Boolean).length;
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetLightsOutTutorialSteps(lang, settings.timeLimitSec), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack, settings.timeLimitSec]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section className="lo-stage lights-out-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="lo-hud" aria-hidden="true">
      <p className="lo-left"><span className="lo-bulb-icon" />{en ? 'Lights on' : '還亮著'} <strong>{lit}</strong></p>
      <p className="lo-moves">{en ? 'Moves' : '步數'} 0</p>
      <p className="lo-clock">{settings.timeLimitSec ? FormatRemaining(settings.timeLimitSec * 1000, en) : `0.0 ${en ? 's' : '秒'}`}</p>
      <span className="btn btn-ghost lo-stop">{en ? 'Stop' : '停止'}</span>
    </header>
    <p className="lo-feedback" aria-hidden="true" />
    <div className="lo-board-slot" aria-hidden="true">
      <LightsBoard size={size}>
        {lights.map((on, index) => <span key={index} className="lo-cell" data-on={on ? 'true' : undefined}
          data-tutorial={index === center ? 'move' : undefined}><span className="lo-bulb" /></span>)}
      </LightsBoard>
    </div>
    {active && finished && <section className="training-panel lo-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
