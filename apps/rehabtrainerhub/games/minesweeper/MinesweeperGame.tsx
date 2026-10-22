import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useT } from './i18n/useT';
import { boardSizeOptions, defaultSettings, difficulties, ValidateSettings, type BoardSize, type Difficulty, type MinesweeperSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { MinesweeperTutorial } from './rules/MinesweeperTutorial';
import { boardSizes, CalculateMineCount, ClampZoom, CreateRandom, mineDensity, MineField, zoomRange } from './logic/minesweeper';
import { CellFace, CellLabel, CellState, FormatElapsed, MineBoard, MineCounter, MoveCellFocus, ZoomControls } from './MineBoard';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayFailureSound, PlayGameEndSound, PlayMidiMusic, PlaySuccessSound, PrepareAudioFeedback, SetSoundEnabled, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

type Phase = 'menu' | 'rules' | 'running' | 'results';
const outcomeHoldMs = 1600;
const wheelZoomFactor = 1.1;

export function MinesweeperGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<MinesweeperSettings>({ ...defaultSettings });
  useEffect(() => { SetSoundEnabled(settings.soundEnabled); }, [settings.soundEnabled]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [score, setScore] = useState<ReturnType<typeof BuildGameScore> | null>(null);
  const [flagMode, setFlagMode] = useState(false);
  const [flaggedTap, setFlaggedTap] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [focusCell, setFocusCell] = useState(0);
  const [, setVersion] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const clockRef = useRef<HTMLParagraphElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const fieldRef = useRef<MineField | null>(null);
  const zoomRef = useRef(1);
  const zoomAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const startedAtRef = useRef(0);
  const endedAtRef = useRef<number | null>(null);
  const timerRef = useRef(0);
  const generationRef = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => OnSavedSettings(saved => {
    const restored = RestoreSettings(saved, defaultSettings, ValidateSettings);
    if (restored && phaseRef.current === 'menu') setSettings(restored);
  }), []);
  const stopRuntime = useCallback(() => {
    generationRef.current++;
    fieldRef.current = null;
    window.clearTimeout(timerRef.current);
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
  }, []);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setScore(null); setPhase('menu'); };
    const keys = (event: KeyboardEvent) => {
      if (phaseRef.current === 'running' && event.key === 'Escape') { event.preventDefault(); exit(); }
    };
    const pagehide = () => { stopRuntime(); if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined); };
    window.addEventListener('game:saved', saved);
    window.addEventListener('game:configure', configure);
    window.addEventListener('keydown', keys, true);
    window.addEventListener('pagehide', pagehide);
    return () => {
      window.removeEventListener('game:saved', saved);
      window.removeEventListener('game:configure', configure);
      window.removeEventListener('keydown', keys, true);
      window.removeEventListener('pagehide', pagehide);
      pagehide();
    };
  }, [exit, stopRuntime]);
  useEffect(() => {
    if (phase !== 'menu') return;
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, [phase]);

  const finish = useCallback((field: MineField) => {
    const result = BuildGameScore(field, (endedAtRef.current ?? performance.now()) - startedAtRef.current);
    jsPsychLifecycleRef.current?.finish({ outcome: field.outcome, moves: result.summary.moves, revealedSafe: result.summary.revealedSafe });
    fieldRef.current = null;
    setScore(result);
    setSaveState(IsHubGame() ? 'saving' : 'local');
    SendGameResult({ ...settings }, result.summary, result.rounds);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setPhase('results');
  }, [settings]);
  // The final board stays on screen briefly so the player sees it before the results.
  const end = useCallback((field: MineField) => {
    endedAtRef.current = performance.now();
    PlayGameEndSound(field.outcome === 'Victory' ? 'Victory' : 'Defeat');
    setVersion(version => version + 1);
    const generation = generationRef.current;
    timerRef.current = window.setTimeout(() => { if (generation === generationRef.current) finish(field); }, outcomeHoldMs);
  }, [finish]);
  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (phase !== 'running' || !host) return;
    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:minesweeper', onStart: () => {
      startedAtRef.current = performance.now();
      endedAtRef.current = null;
      const field = new MineField(settings.difficulty, settings.boardSize, CreateRandom(Date.now()), startedAtRef.current);
      fieldRef.current = field;
      setFlagMode(false);
      setFlaggedTap(false);
      zoomRef.current = 1;
      setZoom(1);
      setFocusCell(Math.floor(field.size / 2) * field.size + Math.floor(field.size / 2));
      setVersion(version => version + 1);
    } });
    return () => {
      fieldRef.current = null;
      lifecycle.dispose();
      if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null;
    };
  }, [phase, settings.difficulty, settings.boardSize]);
  // The visible clock reads the start time, so it never drifts from the recorded duration.
  useEffect(() => {
    if (phase !== 'running') return;
    const timer = window.setInterval(() => {
      if (!clockRef.current || !fieldRef.current || endedAtRef.current !== null) return;
      clockRef.current.textContent = FormatElapsed(performance.now() - startedAtRef.current, en);
    }, 250);
    return () => window.clearInterval(timer);
  }, [phase, en]);

  // Zooming keeps the middle of the visible board in place.
  const applyZoom = useCallback((value: number) => {
    const next = ClampZoom(value);
    if (next === zoomRef.current) return;
    const area = areaRef.current;
    if (area) zoomAnchorRef.current = { x: (area.scrollLeft + area.clientWidth / 2) / area.scrollWidth, y: (area.scrollTop + area.clientHeight / 2) / area.scrollHeight };
    zoomRef.current = next;
    setZoom(next);
  }, []);
  useLayoutEffect(() => {
    const area = areaRef.current, anchor = zoomAnchorRef.current;
    zoomAnchorRef.current = null;
    if (!area || !anchor) return;
    area.scrollLeft = anchor.x * area.scrollWidth - area.clientWidth / 2;
    area.scrollTop = anchor.y * area.scrollHeight - area.clientHeight / 2;
  }, [zoom]);
  // The wheel and a two-finger pinch zoom the board, as in the original game; one finger still scrolls it.
  useEffect(() => {
    const area = areaRef.current;
    if (phase !== 'running' || !area) return;
    let pinch: { distance: number; zoom: number } | null = null;
    const spread = (touches: TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const wheel = (event: WheelEvent) => {
      if (!event.deltaY) return;
      event.preventDefault();
      applyZoom(zoomRef.current * (event.deltaY < 0 ? wheelZoomFactor : 1 / wheelZoomFactor));
    };
    const touchStart = (event: TouchEvent) => { pinch = event.touches.length === 2 ? { distance: spread(event.touches), zoom: zoomRef.current } : null; };
    const touchMove = (event: TouchEvent) => { if (pinch && pinch.distance > 0 && event.touches.length === 2) applyZoom(pinch.zoom * spread(event.touches) / pinch.distance); };
    const touchEnd = (event: TouchEvent) => { if (event.touches.length < 2) pinch = null; };
    area.addEventListener('wheel', wheel, { passive: false });
    area.addEventListener('touchstart', touchStart, { passive: true });
    area.addEventListener('touchmove', touchMove, { passive: true });
    area.addEventListener('touchend', touchEnd);
    area.addEventListener('touchcancel', touchEnd);
    return () => {
      area.removeEventListener('wheel', wheel);
      area.removeEventListener('touchstart', touchStart);
      area.removeEventListener('touchmove', touchMove);
      area.removeEventListener('touchend', touchEnd);
      area.removeEventListener('touchcancel', touchEnd);
    };
  }, [phase, applyZoom]);

  // Taps, right clicks and keys all go through here.
  const act = (index: number, flag: boolean) => {
    const field = fieldRef.current;
    if (phaseRef.current !== 'running' || !field || field.outcome) return;
    const now = performance.now();
    setFocusCell(index);
    if (flag) {
      if (field.toggleFlag(index, now).accepted) { setFlaggedTap(false); setVersion(version => version + 1); }
      return;
    }
    if (field.cells[index].flagged) { setFlaggedTap(true); return; }
    const result = field.open(index, now);
    if (!result.accepted) return;
    setFlaggedTap(false);
    setVersion(version => version + 1);
    if (result.result === 'safe' && !result.solved) PlaySuccessSound();
    if (result.result === 'mine') PlayFailureSound();
    if (field.outcome) end(field);
  };
  const boardKeys = (event: ReactKeyboardEvent<HTMLDivElement>, field: MineField) => {
    if (MoveCellFocus(event, field.size) || event.key.toLowerCase() !== 'f') return;
    const index = Number((event.target as HTMLElement).closest<HTMLElement>('.ms-cell')?.dataset.index);
    if (Number.isNaN(index)) return;
    event.preventDefault();
    act(index, true);
  };

  const confirmSettings = () => {
    if (!formRef.current?.reportValidity() || !ValidateSettings(settings)) return;
    SaveGameSettings(settings);
    setPhase('rules');
  };
  const startTraining = async () => {
    if (phaseRef.current !== 'rules' || !ValidateSettings(settings)) return;
    const generation = generationRef.current;
    SetSoundEnabled(settings.soundEnabled);
    PrepareAudioFeedback();
    try { await rootRef.current?.requestFullscreen?.(); } catch { /* Windowed play remains available. */ }
    if (generation !== generationRef.current || phaseRef.current !== 'rules') {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      return;
    }
    SendGameEvent('active');
    setPhase('running');
  };

  const densityLabel = (difficulty: Difficulty) => `${Math.round(mineDensity[difficulty] * 100)}%`;
  const sizeLabel = (boardSize: BoardSize, difficulty: Difficulty) => {
    const size = boardSizes[boardSize], mines = CalculateMineCount(size, size, mineDensity[difficulty]);
    return en ? `${size} × ${size} (${mines} mines)` : `${size} × ${size}（${mines} 顆地雷）`;
  };
  const onOff = (value: boolean) => value ? (en ? 'On' : '開啟') : (en ? 'Off' : '關閉');
  const summaryItems = [
    { label: en ? 'Mine density' : '地雷密度', value: densityLabel(settings.difficulty) },
    { label: en ? 'Board size' : '盤面大小', value: sizeLabel(settings.boardSize, settings.difficulty) },
    { label: en ? 'Sound feedback' : '聲音回饋', value: onOff(settings.soundEnabled) },
  ];
  const seconds = (value: number) => `${value.toFixed(1)} ${en ? 's' : '秒'}`;
  const ms = (value: number | null) => value === null ? (en ? 'N/A' : '無') : `${(value / 1000).toFixed(1)} ${en ? 's' : '秒'}`;
  const field = fieldRef.current;
  const feedback = field?.outcome === 'Victory' ? (en ? 'All safe cells are open' : '安全格全部打開了')
    : field?.outcome === 'Defeat' ? (en ? 'That cell was a mine' : '踩到地雷了')
      : flaggedTap ? (en ? 'This cell has a flag. Remove the flag to open it.' : '這格插了旗，拔旗後才能打開。')
        : flagMode ? (en ? 'Flag mode: a tap places or removes a flag.' : '標記模式：點格子插旗或拔旗。') : '';
  const runningSize = boardSizes[settings.boardSize];
  const summary = score?.summary;
  return <div ref={rootRef} className="minesweeper-game-root">
    <div ref={jsPsychHostRef} className="ms-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <MinesweeperTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog minesweeper-phase-menu" aria-labelledby="ms-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="ms-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            <label>{en ? 'Mine density' : '地雷密度'}<select name="difficulty" value={settings.difficulty}
              onChange={event => setSettings({ ...settings, difficulty: event.target.value as Difficulty })}>
              {difficulties.map(difficulty => <option key={difficulty} value={difficulty}>{densityLabel(difficulty)}</option>)}
            </select>
              <small className="training-setting-description">{en ? 'More mines leave fewer cells you can work out for sure.' : '地雷越多，能確定安全的格子越少。'}</small></label>
            <label>{en ? 'Board size' : '盤面大小'}<select name="boardSize" value={settings.boardSize}
              onChange={event => setSettings({ ...settings, boardSize: event.target.value as BoardSize })}>
              {boardSizeOptions.map(boardSize => <option key={boardSize} value={boardSize}>{sizeLabel(boardSize, settings.difficulty)}</option>)}
            </select>
              <small className="training-setting-description">{en ? 'Zoom large boards with − and +, two fingers, or the mouse wheel.' : '大盤面可用 − ＋、雙指或滑鼠滾輪縮放。'}</small></label>
            <label className="ms-checkbox"><input name="soundEnabled" type="checkbox" checked={settings.soundEnabled}
              onChange={event => setSettings({ ...settings, soundEnabled: event.target.checked })} />{en ? 'Sound feedback' : '聲音回饋'}
              <small className="training-setting-description">{en ? 'A short sound when a safe cell opens, when a mine opens, and at the end of the game.' : '打開安全格、打開地雷與結束時播放提示音。'}</small></label>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="ms-stage ms-running" aria-label={title}>
      <header className="ms-hud">
        <MineCounter flags={field?.flags ?? 0} mines={field?.mineCount ?? CalculateMineCount(runningSize, runningSize, mineDensity[settings.difficulty])} en={en} />
        <p ref={clockRef} className="ms-clock">{FormatElapsed(0, en)}</p>
        <button type="button" className="btn btn-ghost ms-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <p className={`ms-feedback${field?.outcome ? ' ms-outcome' : ''}`} role="status" data-outcome={field?.outcome ?? undefined}>{feedback}</p>
      <div className="ms-board-slot">
        <MineBoard size={field?.size ?? runningSize} zoom={zoom} areaRef={areaRef} state={field?.outcome ? 'over' : 'running'}
          label={en ? 'Minesweeper board' : '踩地雷棋盤'} onKeyDown={event => { if (field) boardKeys(event, field); }}>
          {field?.cells.map((cell, index) => <button type="button" key={index} className="ms-cell" data-index={index} data-state={CellState(cell)}
            data-count={cell.open && !cell.mine ? cell.adjacent : undefined} data-exploded={index === field.explodedIndex ? 'true' : undefined}
            tabIndex={index === focusCell ? 0 : -1} onFocus={() => setFocusCell(index)} aria-label={CellLabel(cell, index, field.size, en)}
            onClick={() => act(index, flagMode)} onContextMenu={event => { event.preventDefault(); act(index, true); }}><CellFace cell={cell} /></button>)}
        </MineBoard>
      </div>
      <footer className="ms-tools">
        <ZoomControls zoom={zoom} en={en} onStep={direction => applyZoom(zoomRef.current + direction * zoomRange.step)} onReset={() => applyZoom(1)} />
        <button type="button" className={`btn ms-flag-mode${flagMode ? ' btn-primary' : ''}`} aria-pressed={flagMode}
          onClick={() => setFlagMode(mode => !mode)}>{flagMode ? (en ? 'Flag mode on' : '標記模式中') : (en ? 'Flag mode' : '標記模式')}</button>
      </footer>
    </main>}
    {phase === 'results' && score && summary && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Result' : '結果'}</p><strong>{summary.completed ? (en ? 'Cleared' : '完成') : (en ? 'Hit a mine' : '踩到地雷')}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Safe cells opened' : '打開的安全格'}</p><strong>{summary.revealedSafe} / {summary.safeCells}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Total time' : '總用時'}</p><strong>{seconds(summary.duration)}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Flags on mines' : '插在地雷上的旗'}</dt><dd>{summary.correctFlags}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Flags on safe cells' : '插在安全格上的旗'}</dt><dd>{summary.incorrectFlags}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Actions' : '操作次數'}</dt><dd>{summary.moves}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Mean time per action' : '平均每次操作時間'}</dt><dd>{ms(summary.meanThinkMs)}</dd></div>
      </dl></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}
