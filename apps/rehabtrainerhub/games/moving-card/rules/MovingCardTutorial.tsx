import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import { type MovingCardSettings, PixelFromMillimeter } from '../settings';
import { StartTour } from '../runtime/tour';
import { GetMovingCardTutorialSteps } from './tutorialSteps';
import { ChooseMovingCardRotation, CreateMovingCardOptionLayout, GetMovingCardSearchBounds } from '../cardLayout';
import { typography } from '../runtime/theme';

export function MovingCardTutorial({ active, ready, title, settings, summaryItems, onStart, onBack }: {
  active: boolean; ready: boolean; title: string; settings: MovingCardSettings;
  summaryItems: { label: string; value: string }[]; onStart: () => void; onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  const [finished, setFinished] = useState(false);
  const sceneRef = useRef<HTMLElement>(null);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight,
    insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const resize = () => {
      const style = getComputedStyle(scene);
      setViewport({ width: scene.clientWidth, height: scene.clientHeight, insets: {
        top: parseFloat(style.paddingTop) || 0, right: parseFloat(style.paddingRight) || 0,
        bottom: parseFloat(style.paddingBottom) || 0, left: parseFloat(style.paddingLeft) || 0,
      } });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(scene);
    return () => observer.disconnect();
  }, []);
  const { width, height, insets } = viewport;
  const bounds = GetMovingCardSearchBounds(width, height, insets);
  const isCircle = settings.difficulty !== 'easy';
  const layout = useMemo(() => CreateMovingCardOptionLayout(settings.optionCount,
    GetMovingCardSearchBounds(viewport.width, viewport.height, viewport.insets), isCircle), [settings.optionCount, isCircle, viewport]);
  const rotations = useMemo(() => {
    const angles: number[] = [];
    for (const position of layout.positions.slice(0, settings.optionCount)) {
      angles.push(settings.difficulty === 'hard' ? ChooseMovingCardRotation(position, layout.positions, angles, width, height) : 0);
    }
    return angles;
  }, [layout, settings.optionCount, settings.difficulty, width, height]);
  const headerHeight = Math.max(height * 0.08, insets.top + 38);
  const targetX = insets.left + (width - insets.left - insets.right) / 2;
  const headerTextY = Math.max(insets.top + 8, headerHeight / 2 - typography.fontSizeM / 2);
  const compact = width - insets.left - insets.right < 480;
  const targetFontSize = Math.max(16, Math.min(PixelFromMillimeter(settings.targetPhysicalSizeMm, settings.calibrationLengthMm), height * 0.08, width * 0.1));
  const optionFontSize = Math.min(Math.max(12, PixelFromMillimeter(settings.optionPhysicalSizeMm, settings.calibrationLengthMm)), Math.min(layout.width, layout.height) * 0.7);
  useLayoutEffect(() => { window.dispatchEvent(new Event('game:tutorial-layout')); }, [viewport]);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFinished(false);
    if (!active) return;
    return StartTour(GetMovingCardTutorialSteps(lang), { lang,
      onEvent: () => setFinished(true), onBack });
  }, [active, lang, onBack]);
  useEffect(() => { if (finished) confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [finished]);
  return <section ref={sceneRef} className="moving-card-tutorial" aria-label={en ? 'Game tutorial scene' : '遊戲說明場景'}>
    <header className="moving-card-preview-hud" style={{ height: headerHeight, fontFamily: typography.fontFamily, fontSize: typography.fontSizeM }}>
      <p style={{ left: insets.left + 14, top: headerTextY }}>{en ? 'Target: AB' : compact ? '目標: AB' : '找到目標: AB'}</p>
      <p className="moving-card-round" style={{ right: insets.right + 14, top: headerTextY }}>{compact ? '' : en ? 'Round: ' : '回合: '}1 / {settings.rounds}</p>
    </header>
    <p className="moving-card-target" style={{ left: targetX, top: headerHeight + (bounds.y - headerHeight) * 0.42,
      fontFamily: typography.fontFamily, fontSize: targetFontSize }}>AB</p>
    <div className="moving-card-preview-cross" aria-hidden="true" style={{ left: targetX, top: headerHeight + (bounds.y - headerHeight) * 0.78 }} />
    <div className={`moving-card-options moving-card-options-${settings.difficulty}`} style={{ left: bounds.x, top: bounds.y, width: bounds.w, height: bounds.h }}>
      {Array.from({ length: settings.optionCount }, (_, index) => <p className="moving-card-preview-option" key={index}
        style={{ left: layout.positions[index].x - bounds.x, top: layout.positions[index].y - bounds.y,
          width: layout.width, height: layout.height, borderRadius: isCircle ? layout.width / 2 : 4,
          fontFamily: typography.fontFamily, fontSize: optionFontSize,
          transform: `translate(-50%, -50%) rotate(${rotations[index]}rad)` }}>
        {index === 6 || (settings.optionCount <= 6 && index === 0) ? 'AB' : `${String.fromCharCode(65 + index % 26)}${String.fromCharCode(90 - index % 26)}`}
      </p>)}
    </div>
    {active && finished && <section className="training-panel moving-card-tutorial-ready" role="dialog" aria-modal="true" aria-label={title}
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
