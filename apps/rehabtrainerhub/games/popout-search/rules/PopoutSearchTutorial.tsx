import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import { ViewingDistanceCm, type SearchSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetSearchTutorialSteps } from './tutorialSteps';
import { gameDefinition, levels } from '../logic/levels';
import { Glyph } from '../Glyph';

export function PopoutSearchTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: SearchSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const level = levels[(settings.level || 1) - 1];
  const [finished, setFinished] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetSearchTutorialSteps(lang), { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  const distance = ViewingDistanceCm(settings.screenWidthCm || 30);
  return <section className={`search-stage search-tutorial ${gameDefinition.id}-tutorial`} aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="search-hud" aria-hidden="true"><p className="search-progress-label">{en ? `Level ${level.globalLevel}, block 1 (8 letters)` : `等級 ${level.globalLevel}，第 1 段（8 個字）`}</p><span className="btn btn-ghost search-stop">{en ? 'Stop' : '停止'}</span></header>
    <div className="search-field" data-state="target" aria-hidden="true"><div className="search-target-circle"><span className="search-example"><Glyph stimulus={level.target} /></span></div>
      <div className="search-items">{[0, 1, 2, 3, 4, 5, 6, 7].map(i => <span className="search-item" key={i} style={{ left: `${[16, 35, 65, 84][i % 4]}%`, top: `${i < 4 ? 25 : 75}%` }}><Glyph stimulus={i === 1 ? level.target : level.distractors[0]} /></span>)}</div>
    </div>
    <div className="search-pads" aria-hidden="true"><div className="search-pad">{en ? 'Present' : '有'}<small>F / ←</small></div><div className="search-pad">{en ? 'Absent' : '沒有'}<small>J / →</small></div></div>
    {active && finished && <section className="training-panel search-tutorial-ready" role="dialog" aria-modal="true" aria-label={title} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); onBack(); }
      if (event.key === 'Tab') { event.preventDefault(); const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button')); const i = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[(i + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus(); }
    }}><div ref={confirmationRef} className="training-config training-confirmation">
      <header className="training-config-header"><h2>{title}</h2></header>
      <div className="training-config-body"><section className="training-setting"><h3>{en ? 'Confirm settings' : '確認設定'}</h3>
        <p className="search-distance">{en ? `Sit with your eyes about ${distance} cm from the screen.` : `請坐在眼睛距離螢幕約 ${distance} 公分處。`}</p>
        <div className="training-config-summary">{summaryItems.map(item => <p className="training-config-summary-item" key={item.label}><strong>{item.label}：</strong>{item.value}</p>)}</div>
      </section></div>
      <footer className="config-actions"><div className="training-config-navigation-buttons">
        <button type="button" className="btn btn-primary" disabled={!ready} onClick={onStart}>{en ? 'Start Training' : '開始訓練'}</button>
        <button type="button" className="btn btn-ghost" onClick={onBack}>{en ? 'Back to settings' : '返回設定'}</button>
      </div></footer>
    </div></section>}
  </section>;
}
