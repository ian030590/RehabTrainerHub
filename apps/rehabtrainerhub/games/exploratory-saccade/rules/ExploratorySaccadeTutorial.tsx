import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import { SymbolPx, ViewingDistanceCm, type SaccadeSettings } from '../settings';
import { StartTour } from '../runtime/tour';
import { GenerateScreen } from '../logic/screens';
import type { ScreenState } from '../logic/screenRun';
import { RunningView } from '../RunningView';

export function ExploratorySaccadeTutorial({ active, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; title: string; settings: SaccadeSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT(), en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const [state, setState] = useState<ScreenState>({ phase: 'search', screen: null, found: [], missed: [] });
  const fieldRef = useRef<HTMLDivElement>(null), confirmationRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const update = () => {
      const { width, height } = field.getBoundingClientRect();
      try {
        const screen = GenerateScreen(settings, { width, height, symbolPx: SymbolPx(window.screen.width, settings.symbolSizeDeg) }, 61, 0, null);
        setState({ phase: 'search', screen, found: [], missed: [] });
      } catch { setState({ phase: 'search', screen: null, found: [], missed: [] }); }
    };
    update();
    const observer = new ResizeObserver(update); observer.observe(field);
    return () => observer.disconnect();
  }, [settings]);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    const steps = en ? [
      { target: '.saccade-target', title: 'Find every copy of this digit', text: 'The target digit changes each screen. Look across the whole field for every copy of the requested digit.', place: 'bottom' },
      { target: '.saccade-item[data-target="true"]', title: 'Move over or tap a target', text: 'Move the mouse over a target, or tap it with a finger or pen. It turns red, is underlined and beeps once. Tapping a different symbol counts as a false click.', place: 'bottom' },
      { target: '.saccade-hud', title: 'Start each screen from the centre', text: 'Each screen begins with a central Start button. Only search time counts. A time limit outlines missed targets. Stop or Escape exits without saving.', place: 'bottom' },
    ] : [
      { target: '.saccade-target', title: '找出每一個指定數字', text: '每個畫面的目標數字都會更換。請查看整個畫面，找出所有相同的數字。', place: 'bottom' },
      { target: '.saccade-item[data-target="true"]', title: '移入或點按目標', text: '以滑鼠移到目標上，或用手指、觸控筆點按。找到後會變紅、加底線並響一聲，不會重複計次。點按其他符號算一次誤點。', place: 'bottom' },
      { target: '.saccade-hud', title: '每個畫面從中央開始', text: '每個畫面先按中央的開始鈕，等待時不計時。時間上限到時，外框會標示漏找的目標。練習時間用完後，完成目前這個畫面才結束。按停止或 Esc 離開，本次不保存。', place: 'bottom' },
    ];
    return StartTour(steps, { lang, onEvent: () => setFinished(true), onBack });
  }, [active, lang, en, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <>
    <div className="saccade-tutorial-scene" inert>
      <RunningView state={state} en={en} remainingMs={settings.practiceMinutes * 60000} fieldRef={fieldRef}
        onStart={() => undefined} onStop={() => undefined} onInteract={() => undefined} tutorial />
    </div>
    {active && finished && <section className="training-panel saccade-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
        <div className="training-config-body"><section className="training-setting">
          <h3>{en ? 'Confirm settings' : '確認設定'}</h3>
          <p className="saccade-distance">{en ? `Keep your eyes about ${ViewingDistanceCm(settings.screenWidthCm)} cm from the screen.` : `請坐在距離螢幕約 ${ViewingDistanceCm(settings.screenWidthCm)} 公分處。`}</p>
          <div className="training-config-summary">{summaryItems.map(item => <p className="training-config-summary-item" key={item.label}><strong>{item.label}：</strong>{item.value}</p>)}</div>
        </section></div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button type="button" className="btn btn-primary" onClick={onStart}>{en ? 'Start Training' : '開始訓練'}</button>
          <button type="button" className="btn btn-ghost" onClick={onBack}>{en ? 'Back to settings' : '返回設定'}</button>
        </div></footer>
      </div>
    </section>}
  </>;
}
