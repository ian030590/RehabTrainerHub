import { useRef, type RefObject } from 'react';
import type { ScreenState } from './logic/screenRun';

export function RunningView({ state, en, remainingMs, fieldRef, onStart, onStop, onInteract, tutorial = false }: {
  state: ScreenState; en: boolean; remainingMs: number; fieldRef: RefObject<HTMLDivElement | null>;
  onStart: () => void; onStop: () => void;
  onInteract: (id: number, kind: 'pointerover' | 'pointermove' | 'pointerdown' | 'click', pointerType: string, activation?: string) => void;
  tutorial?: boolean;
}) {
  const activationRef = useRef(0);
  const pointerRef = useRef<{ id: number; activation: string } | null>(null);
  const { screen, phase, found, missed } = state;
  const showing = phase !== 'ready';
  const remaining = Math.ceil(remainingMs / 1000);
  return <main className={`saccade-stage ${tutorial ? 'exploratory-saccade-tutorial' : 'saccade-running'}`} aria-label={en ? 'Exploratory Saccade Practice' : '探索掃視練習'}>
    <header className="saccade-hud">
      <p className="saccade-target">{en ? 'Find' : '找出'} <strong>{screen?.target ?? '?'}</strong></p>
      <p className="saccade-found" aria-live="polite">{en ? 'Found' : '已找到'} {found.length} / {screen?.items.filter(item => item.target).length ?? 0}</p>
      <p className="saccade-remaining">{en ? 'Search time left' : '搜尋剩餘'} {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</p>
      <button type="button" className="btn btn-ghost saccade-stop" onClick={onStop}>{en ? 'Stop' : '停止'}</button>
    </header>
    <div ref={fieldRef} className="saccade-field" data-state={phase} data-target={screen?.target}>
      {phase === 'ready' && <button type="button" className="btn btn-primary saccade-start" autoFocus onClick={onStart}>
        {en ? `Start: find every ${screen?.target ?? '?'}` : `開始：找出所有的 ${screen?.target ?? '?'}`}</button>}
      {screen && showing && screen.items.map(item => <button key={item.id} type="button" tabIndex={-1} className="saccade-item"
        data-id={item.id} data-target={item.target} data-found={found.includes(item.id)} data-missed={missed.includes(item.id)}
        aria-label={`${item.symbol}${found.includes(item.id) ? (en ? ', found' : '，已找到') : missed.includes(item.id) ? (en ? ', missed' : '，未找到') : ''}`}
        aria-disabled={phase !== 'search' || found.includes(item.id)}
        style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%`, fontSize: screen.symbolPx, width: Math.max(44, screen.symbolPx), height: Math.max(44, screen.symbolPx) }}
        onPointerMove={event => onInteract(item.id, 'pointermove', event.pointerType)}
        onPointerOver={event => onInteract(item.id, 'pointerover', event.pointerType)}
        onPointerDown={event => {
          const activation = String(++activationRef.current);
          pointerRef.current = { id: item.id, activation };
          onInteract(item.id, 'pointerdown', event.pointerType, activation);
        }}
        onClick={event => {
          const paired = event.detail > 0 && pointerRef.current?.id === item.id ? pointerRef.current.activation : undefined;
          onInteract(item.id, 'click', 'mouse', paired);
          pointerRef.current = null;
        }}>{item.symbol}</button>)}
    </div>
    <p className="saccade-message" role="status">{phase === 'complete' ? (en ? 'All found' : '全部找到')
      : phase === 'missed' ? (en ? 'Outlined digits were missed' : '外框標示未找到的數字') : ''}</p>
  </main>;
}
