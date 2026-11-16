import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, difficulties, ValidateSettings, type Difficulty, type HexSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { HexTutorial } from './rules/HexTutorial';
import { boardSizes, HexMatch, type Cell, type Outcome } from './logic/hex';
import { CellStyle, HexBoard, MoveHexFocus } from './HexBoard';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayFailureSound, PlayGameEndSound, PlayMidiMusic, PrepareAudioFeedback, SetSoundEnabled, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';
import { PauseClock } from './logic/pauseClock';

type Phase = 'menu' | 'rules' | 'running' | 'results';
const computerDelayMs = 1000;
const outcomeHoldMs = 1600;

export function HexGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  const [paused, setPaused] = useState(false);
  const [fullscreenInterrupted, setFullscreenInterrupted] = useState(false);
  const endingRef = useRef(false);
  const pausedRef = useRef(false);
  const pauseClockRef = useRef<PauseClock | null>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const stopRef = useRef<HTMLButtonElement>(null);
  const restoreStopRef = useRef(false);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (phase === 'running' && !paused && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase, paused]);
  useEffect(() => { if (paused) continueRef.current?.focus(); else if (restoreStopRef.current) { restoreStopRef.current = false; stopRef.current?.focus(); } }, [paused]);
  useEffect(() => { if (phase === 'results') resultHeadingRef.current?.focus(); }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<HexSettings>({ ...defaultSettings });
  useEffect(() => { SetSoundEnabled(settings.soundEnabled); }, [settings.soundEnabled]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [score, setScore] = useState<ReturnType<typeof BuildGameScore> | null>(null);
  const [filledTap, setFilledTap] = useState(false);
  const [focusCell, setFocusCell] = useState(0);
  const [, setVersion] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const clockRef = useRef<HTMLParagraphElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const matchRef = useRef<HexMatch | null>(null);
  const startedAtRef = useRef(0);
  const endedAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<PauseClock['set']>>(null);
  const generationRef = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => OnSavedSettings(saved => {
    const restored = RestoreSettings(saved, defaultSettings, ValidateSettings);
    if (restored && phaseRef.current === 'menu') setSettings(restored);
  }), []);
  const stopRuntime = useCallback(() => {
    endingRef.current = true;
    pausedRef.current = false;
    setPaused(false);
    pauseClockRef.current?.stop();
    pauseClockRef.current = null;
    generationRef.current++;
    matchRef.current = null;
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
  }, []);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const pause = useCallback(() => {
    if (pausedRef.current) return;
    setFullscreenInterrupted(false);
    pausedRef.current = true;
    pauseClockRef.current?.pause();
    StopMidiMusic();
    setPaused(true);
  }, []);
  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    restoreStopRef.current = true;
    pauseClockRef.current?.resume();
    setPaused(false);
  }, []);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setScore(null); setPhase('menu'); };
    const fullscreenChanged = () => { if (phaseRef.current === 'running' && !endingRef.current && !document.fullscreenElement) { pause(); setFullscreenInterrupted(true); } };
    const keys = (event: KeyboardEvent) => {
      if (phaseRef.current === 'running' && event.key === 'Escape') { event.preventDefault(); if (!event.repeat) { if (pausedRef.current) resume(); else pause(); } }
    };
    const pagehide = () => { stopRuntime(); if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined); };
    window.addEventListener('game:saved', saved);
    window.addEventListener('game:configure', configure);
    window.addEventListener('keydown', keys, true);
    window.addEventListener('pagehide', pagehide);
    document.addEventListener('fullscreenchange', fullscreenChanged);
    return () => {
      window.removeEventListener('game:saved', saved);
      window.removeEventListener('game:configure', configure);
      window.removeEventListener('keydown', keys, true);
      window.removeEventListener('pagehide', pagehide);
      document.removeEventListener('fullscreenchange', fullscreenChanged);
      pagehide();
    };
  }, [pause, resume, stopRuntime]);
  useEffect(() => {
    if (phase !== 'menu') return;
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, [phase]);

  const finish = useCallback((match: HexMatch) => {
    endingRef.current = true;
    const result = BuildGameScore(match, (endedAtRef.current ?? pauseClockRef.current!.now()) - startedAtRef.current);
    jsPsychLifecycleRef.current?.finish({ outcome: match.outcome, moves: result.summary.moves, errors: result.summary.errors });
    matchRef.current = null;
    setScore(result);
    setSaveState(IsHubGame() ? 'saving' : 'local');
    SendGameResult({ ...settings }, result.summary, result.rounds);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setPhase('results');
  }, [settings]);
  // The final board stays on screen briefly so the player sees the winning chain before the results.
  const end = useCallback((match: HexMatch, outcome: Outcome) => {
    endedAtRef.current = pauseClockRef.current!.now();
    PlayGameEndSound(outcome);
    setVersion(version => version + 1);
    const generation = generationRef.current;
    timerRef.current = pauseClockRef.current!.set(() => { if (generation === generationRef.current) finish(match); }, outcomeHoldMs);
  }, [finish]);
  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (phase !== 'running' || !host) return;
    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    const clock = new PauseClock({ now: () => performance.now(), set: (callback, ms) => window.setTimeout(callback, ms), clear: timer => window.clearTimeout(timer) });
    pauseClockRef.current = clock;
    if (pausedRef.current) clock.pause();
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:hex', onStart: () => {
      startedAtRef.current = clock.now();
      endedAtRef.current = null;
      matchRef.current = new HexMatch(settings.difficulty, startedAtRef.current);
      setFilledTap(false);
      setFocusCell(Math.floor(matchRef.current.board.length / 2));
      setVersion(version => version + 1);
    } });
    return () => {
      matchRef.current = null;
      clock.stop();
      if (pauseClockRef.current === clock) pauseClockRef.current = null;
      lifecycle.dispose();
      if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null;
    };
  }, [phase, settings.difficulty]);
  // The visible clock reads the match start time, so it never drifts from the recorded duration.
  useEffect(() => {
    if (phase !== 'running' || paused) return;
    const timer = window.setInterval(() => {
      if (clockRef.current && matchRef.current && endedAtRef.current === null) {
        clockRef.current.textContent = `${((pauseClockRef.current!.now() - startedAtRef.current) / 1000).toFixed(1)} ${en ? 's' : '秒'}`;
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase, en, paused]);

  const tapCell = (index: number) => {
    const match = matchRef.current;
    if (phaseRef.current !== 'running' || pausedRef.current || !match || match.turn !== 'player') return;
    const outcome = match.play(index, pauseClockRef.current!.now());
    if (!outcome.accepted) {
      PlayFailureSound();
      setFilledTap(true);
      setVersion(version => version + 1);
      return;
    }
    setFilledTap(false);
    setVersion(version => version + 1);
    if (outcome.outcome) { end(match, outcome.outcome); return; }
    const generation = generationRef.current;
    timerRef.current = pauseClockRef.current!.set(() => {
      if (generation !== generationRef.current || matchRef.current !== match) return;
      const reply = match.computerTurn(pauseClockRef.current!.now());
      setVersion(version => version + 1);
      if (reply.outcome) end(match, reply.outcome);
    }, computerDelayMs);
  };

  const confirmSettings = () => {
    if (!formRef.current?.reportValidity() || !ValidateSettings(settings)) return;
    SaveGameSettings(settings);
    setPhase('rules');
  };
  const startTraining = async () => {
    if (phaseRef.current !== 'rules' || !ValidateSettings(settings)) return;
    endingRef.current = false;
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

  const sizeLabel = (difficulty: Difficulty) => `${boardSizes[difficulty]} × ${boardSizes[difficulty]}`;
  const onOff = (value: boolean) => value ? (en ? 'On' : '開啟') : (en ? 'Off' : '關閉');
  const summaryItems = [
    { label: en ? 'Board size' : '棋盤大小', value: sizeLabel(settings.difficulty) },
    { label: en ? 'Sound feedback' : '聲音回饋', value: onOff(settings.soundEnabled) },
  ];
  const seconds = (value: number | null) => value === null ? (en ? 'N/A' : '無') : `${value.toFixed(1)} ${en ? 's' : '秒'}`;
  const ms = (value: number | null) => value === null ? (en ? 'N/A' : '無') : `${(value / 1000).toFixed(1)} ${en ? 's' : '秒'}`;
  const outcomeLabel = (outcome: Outcome) => outcome === 'Victory' ? (en ? 'You joined your two blue edges' : '你接通了兩條藍色邊')
    : outcome === 'Defeat' ? (en ? 'The computer joined its two edges' : '電腦接通了它的兩條邊') : (en ? 'Draw: the board is full' : '平手，棋盤已下滿');
  const match = matchRef.current;
  const cellLabel = (index: number, size: number, mark: Cell) => {
    const position = en ? `Row ${Math.floor(index / size) + 1}, column ${index % size + 1}` : `第 ${Math.floor(index / size) + 1} 列第 ${index % size + 1} 欄`;
    const owner = mark === 'P' ? (en ? 'yours' : '你的') : mark === 'A' ? (en ? 'computer' : '電腦') : (en ? 'empty' : '空格');
    return `${position}${en ? ', ' : '，'}${owner}`;
  };
  const summary = score?.summary;
  return <div ref={rootRef} className="hex-game-root">
    <div ref={jsPsychHostRef} className="hx-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <HexTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog hex-phase-menu" aria-labelledby="hx-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="hx-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            <label>{en ? 'Board size' : '棋盤大小'}<select name="difficulty" value={settings.difficulty}
              onChange={event => setSettings({ ...settings, difficulty: event.target.value as Difficulty })}>
              {difficulties.map(difficulty => <option key={difficulty} value={difficulty}>{sizeLabel(difficulty)}</option>)}
            </select>
              <small className="training-setting-description">{en ? 'A bigger board needs a longer chain, so you plan further ahead.' : '棋盤越大，要連的路越長，需要想得越遠。'}</small></label>
            <label className="hx-checkbox"><input name="soundEnabled" type="checkbox" checked={settings.soundEnabled}
              onChange={event => setSettings({ ...settings, soundEnabled: event.target.checked })} />{en ? 'Sound feedback' : '聲音回饋'}
              <small className="training-setting-description">{en ? 'A short sound for a tap on a taken cell and at the end of the game.' : '點到已有棋子的格子與棋局結束時播放提示音。'}</small></label>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <><main className="hx-stage hx-running" aria-label={title} inert={paused}>
      <header className="hx-hud">
        <p className="hx-goal"><span className="hx-edge-icon" />{en ? 'Join your two blue edges' : '接通兩條藍色邊'}</p>
        <p className="hx-turn" role="status" data-turn={match?.turn ?? 'player'}>
          {match?.turn !== 'over' && <span className="hx-stone-icon" data-mark={match?.turn === 'computer' ? 'A' : 'P'} />}
          {!match || match.turn === 'player' ? (en ? 'Your turn' : '輪到你')
            : match.turn === 'computer' ? (en ? 'Computer is thinking' : '電腦思考中') : (en ? 'Game over' : '棋局結束')}</p>
        <p ref={clockRef} className="hx-clock">0.0 {en ? 's' : '秒'}</p>
        <button ref={stopRef} type="button" className="btn btn-ghost hx-stop" onClick={pause}>{en ? 'Stop' : '停止'}</button>
      </header>
      <p className={`hx-feedback${match?.outcome ? ' hx-outcome' : ''}`} role="status" data-outcome={match?.outcome ?? undefined}>
        {match?.outcome ? outcomeLabel(match.outcome) : filledTap ? (en ? 'That cell is already taken. Choose an empty one.' : '這格已經有棋子，請選空格。') : ''}</p>
      {match && <div className="hx-board-slot">
        <HexBoard size={match.size} turn={match.turn} label={en ? 'Game board' : '棋盤'} onKeyDown={event => MoveHexFocus(event, match.size)}>
          {match.board.map((mark, index) => <button type="button" key={index} className="hx-cell" style={CellStyle(index, match.size)}
            data-index={index} data-mark={mark ?? undefined} data-path={match.path?.includes(index) ? 'true' : undefined}
            tabIndex={index === focusCell ? 0 : -1} onFocus={() => setFocusCell(index)}
            aria-label={cellLabel(index, match.size, mark)} onClick={() => tapCell(index)}><span className="hx-face" /></button>)}
        </HexBoard>
      </div>}
    </main>{paused && <div className="game-interrupt-overlay"><div className="game-interrupt-panel" role="dialog" aria-modal="true" aria-labelledby="hx-pause-title"
      onKeyDown={event => { if (event.key === 'Tab') { const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button'); if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[1].focus(); } else if (!event.shiftKey && document.activeElement === buttons[1]) { event.preventDefault(); buttons[0].focus(); } } }}>
      <h2 id="hx-pause-title">{en ? 'Paused' : '已暫停'}</h2>
      <p>{fullscreenInterrupted ? (en ? 'Fullscreen ended; ending the activity will not save this session.' : '已退出全螢幕，結束後不會保存這次紀錄。') : (en ? 'Ending the activity will not save this session.' : '結束後不會保存這次紀錄。')}</p>
      <button ref={continueRef} className="btn btn-primary" type="button" onClick={resume}>{en ? 'Continue' : '繼續'}</button>
      <button className="btn btn-ghost" type="button" onClick={exit}>{en ? 'End activity' : '結束活動'}</button>
    </div></div>}</>}
    {phase === 'results' && score && summary && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1 ref={resultHeadingRef} tabIndex={-1}>{en ? 'Session results' : '當次成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><p className="score-complete">{en ? 'Activity complete' : '已完成本次活動'}</p><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Result' : '結果'}</p><strong>{summary.completed ? (en ? 'You won' : '勝利') : (en ? 'Computer won' : '電腦獲勝')}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Your moves' : '你下的步數'}</p><strong>{summary.moves}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Mean time per move' : '平均每步思考時間'}</p><strong>{ms(summary.meanThinkMs)}</strong></div>
      </div></section>
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      <div className="score-actions">
        {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
      </div>
      <details className="score-details"><summary>{en ? 'View details' : '查看詳細資料'}</summary>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Taps on taken cells' : '點到已有棋子的次數'}</dt><dd>{summary.errors}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Computer moves' : '電腦步數'}</dt><dd>{summary.opponentMoves}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Total time' : '總用時'}</dt><dd>{seconds(summary.duration)}</dd></div>
      </dl></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      </details>
    </section></div>}
  </div>;
}
