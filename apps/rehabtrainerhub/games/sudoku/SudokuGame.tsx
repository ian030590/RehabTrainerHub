import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, difficulties, timeLimits, ValidateSettings, type Difficulty, type SudokuSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { SudokuTutorial } from './rules/SudokuTutorial';
import { CreateRandom, gridConfig, NumberGridMatch, type Outcome } from './logic/numberGrid';
import { CellEdges, FormatRemaining, MoveNumberFocus, NumberBoard, RuleText } from './NumberBoard';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayFailureSound, PlayGameEndSound, PlayMidiMusic, PrepareAudioFeedback, SetSoundEnabled, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';
import { PauseClock } from './logic/pauseClock';

type Phase = 'menu' | 'rules' | 'running' | 'results';
type Change = (match: NumberGridMatch, now: number) => { accepted: boolean; solved: boolean; fullWrong: boolean };
const outcomeHoldMs = 1600;
const warningMs = 10000;

export function SudokuGame() {
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
  const [settings, setSettings] = useState<SudokuSettings>({ ...defaultSettings });
  useEffect(() => { SetSoundEnabled(settings.soundEnabled); }, [settings.soundEnabled]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [score, setScore] = useState<ReturnType<typeof BuildGameScore> | null>(null);
  const [fullWrong, setFullWrong] = useState(false);
  const [focusCell, setFocusCell] = useState(0);
  const [, setVersion] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const clockRef = useRef<HTMLParagraphElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const matchRef = useRef<NumberGridMatch | null>(null);
  const startedAtRef = useRef(0);
  const endedAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<PauseClock['set']>>(null);
  const limitTimerRef = useRef<ReturnType<PauseClock['set']>>(null);
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
    DisposeAudioFeedback();
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

  const finish = useCallback((match: NumberGridMatch) => {
    endingRef.current = true;
    const result = BuildGameScore(match, (endedAtRef.current ?? pauseClockRef.current!.now()) - startedAtRef.current);
    jsPsychLifecycleRef.current?.finish({ outcome: match.outcome, moves: result.summary.moves, errors: result.summary.errors, blanksLeft: result.summary.blanksLeft });
    matchRef.current = null;
    setScore(result);
    setSaveState(IsHubGame() ? 'saving' : 'local');
    SendGameResult({ ...settings }, result.summary, result.rounds);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setPhase('results');
  }, [settings]);
  // The final board stays on screen briefly so the player sees it before the results.
  const end = useCallback((match: NumberGridMatch, outcome: Outcome) => {
    endedAtRef.current = pauseClockRef.current!.now();
    pauseClockRef.current?.clear(limitTimerRef.current);
    // A board not finished at the time limit ends as a loss, as in the original game.
    PlayGameEndSound(outcome === 'Victory' ? 'Victory' : 'Defeat');
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
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:sudoku', onStart: () => {
      startedAtRef.current = clock.now();
      endedAtRef.current = null;
      const match = new NumberGridMatch(settings.difficulty, startedAtRef.current, CreateRandom(Date.now()));
      matchRef.current = match;
      setFullWrong(false);
      setFocusCell(Math.max(0, match.givens.indexOf(false)));
      setVersion(version => version + 1);
      if (settings.timeLimitSec) {
        const generation = generationRef.current;
        limitTimerRef.current = pauseClockRef.current!.set(() => {
          if (generation !== generationRef.current || matchRef.current !== match) return;
          if (match.expire()) end(match, 'TimeUp');
        }, settings.timeLimitSec * 1000);
      }
    } });
    return () => {
      matchRef.current = null;
      clock.stop();
      if (pauseClockRef.current === clock) pauseClockRef.current = null;
      lifecycle.dispose();
      if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null;
    };
  }, [phase, settings.difficulty, settings.timeLimitSec, end]);
  // The visible clock reads the match start time, so it never drifts from the recorded duration.
  useEffect(() => {
    if (phase !== 'running' || paused) return;
    const timer = window.setInterval(() => {
      const clock = clockRef.current;
      if (!clock || !matchRef.current || endedAtRef.current !== null) return;
      const elapsed = pauseClockRef.current!.now() - startedAtRef.current;
      if (!settings.timeLimitSec) { clock.textContent = `${(elapsed / 1000).toFixed(1)} ${en ? 's' : '秒'}`; return; }
      const remaining = settings.timeLimitSec * 1000 - elapsed;
      clock.textContent = FormatRemaining(remaining, en);
      clock.toggleAttribute('data-warning', remaining <= warningMs);
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase, en, settings.timeLimitSec, paused]);

  // Taps and keys both go through here; single entries stay silent until the board is finished.
  const change = (apply: Change) => {
    const match = matchRef.current;
    if (phaseRef.current !== 'running' || pausedRef.current || !match || match.outcome) return;
    const result = apply(match, pauseClockRef.current!.now());
    if (!result.accepted) return;
    setFullWrong(result.fullWrong);
    setVersion(version => version + 1);
    if (result.solved) end(match, 'Victory');
    else if (result.fullWrong) PlayFailureSound();
  };
  const boardKeys = (event: ReactKeyboardEvent<HTMLDivElement>, match: NumberGridMatch) => {
    if (MoveNumberFocus(event, match.size)) return;
    const index = Number((event.target as HTMLElement).closest<HTMLElement>('.sk-cell')?.dataset.index);
    if (Number.isNaN(index)) return;
    const value = ['Backspace', 'Delete', '0'].includes(event.key) ? 0 : /^[1-9]$/.test(event.key) ? Number(event.key) : null;
    if (value === null) return;
    event.preventDefault();
    change((current, now) => current.set(index, value, now));
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

  const kindNames = { 'latin-square': en ? 'Latin square' : '拉丁方陣', 'magic-square': en ? 'Magic square' : '魔方陣', sudoku: en ? 'Sudoku' : '數獨' };
  const boardLabel = (difficulty: Difficulty) => {
    const { kind, size, blanks } = gridConfig[difficulty];
    return en ? `${kindNames[kind]} ${size} × ${size} / ${blanks} blanks` : `${kindNames[kind]} ${size} × ${size}／${blanks} 空格`;
  };
  const limitLabel = (value: number) => value === 0 ? (en ? 'No limit' : '不限時') : en ? `${value / 60} minute${value === 60 ? '' : 's'}` : `${value / 60} 分鐘`;
  const onOff = (value: boolean) => value ? (en ? 'On' : '開啟') : (en ? 'Off' : '關閉');
  const summaryItems = [
    { label: en ? 'Rule and blanks' : '規則與空格', value: boardLabel(settings.difficulty) },
    { label: en ? 'Time limit' : '時間限制', value: limitLabel(settings.timeLimitSec) },
    { label: en ? 'Sound feedback' : '聲音回饋', value: onOff(settings.soundEnabled) },
  ];
  const seconds = (value: number | null) => value === null ? (en ? 'N/A' : '無') : `${value.toFixed(1)} ${en ? 's' : '秒'}`;
  const ms = (value: number | null) => value === null ? (en ? 'N/A' : '無') : `${(value / 1000).toFixed(1)} ${en ? 's' : '秒'}`;
  const outcomeLabel = (match: NumberGridMatch) => match.outcome === 'Victory' ? (en ? 'Solved: every line follows the rule' : '完成了，全部符合規則')
    : match.blanksLeft ? (en ? `Time is up: ${match.blanksLeft} blank${match.blanksLeft === 1 ? '' : 's'} left` : `時間到，還有 ${match.blanksLeft} 格空著`)
      : (en ? 'Time is up: something still breaks the rule' : '時間到，還有不符合規則的地方');
  const match = matchRef.current;
  const cellLabel = (index: number, current: NumberGridMatch) => {
    const position = en ? `Row ${Math.floor(index / current.size) + 1}, column ${index % current.size + 1}` : `第 ${Math.floor(index / current.size) + 1} 列第 ${index % current.size + 1} 欄`;
    const value = current.values[index];
    const content = current.givens[index] ? (en ? `given ${value}` : `題目 ${value}`) : value ? String(value) : (en ? 'blank' : '空格');
    return `${position}${en ? ', ' : '，'}${content}`;
  };
  const summary = score?.summary;
  return <div ref={rootRef} className="sudoku-game-root">
    <div ref={jsPsychHostRef} className="sk-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <SudokuTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog sudoku-phase-menu" aria-labelledby="sk-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="sk-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            <label>{en ? 'Rule and blanks' : '規則與空格'}<select name="difficulty" value={settings.difficulty}
              onChange={event => setSettings({ ...settings, difficulty: event.target.value as Difficulty })}>
              {difficulties.map(difficulty => <option key={difficulty} value={difficulty}>{boardLabel(difficulty)}</option>)}
            </select>
              <small className="training-setting-description">{en ? 'The three options are different rules, not three levels of the same puzzle.' : '三個選項是不同的規則，不是同一種題目的三種難度。'}</small></label>
            <label>{en ? 'Time limit' : '時間限制'}<select name="timeLimitSec" value={settings.timeLimitSec}
              onChange={event => setSettings({ ...settings, timeLimitSec: Number(event.target.value) })}>
              {timeLimits.map(value => <option key={value} value={value}>{limitLabel(value)}</option>)}
            </select>
              <small className="training-setting-description">{en ? 'If the board is not finished when time runs out, the game ends.' : '時間到時還沒完成，這局就結束。'}</small></label>
            <label className="sk-checkbox"><input name="soundEnabled" type="checkbox" checked={settings.soundEnabled}
              onChange={event => setSettings({ ...settings, soundEnabled: event.target.checked })} />{en ? 'Sound feedback' : '聲音回饋'}
              <small className="training-setting-description">{en ? 'A short sound when a full board breaks the rule and at the end of the game.' : '填滿但不符合規則時與結束時播放提示音。'}</small></label>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <><main className="sk-stage sk-running" aria-label={title} inert={paused}>
      <header className="sk-hud">
        <p className="sk-rule">{RuleText(gridConfig[settings.difficulty].kind, en)}</p>
        <p className="sk-moves">{en ? 'Entries' : '填寫'} {match?.moves ?? 0}</p>
        <p ref={clockRef} className="sk-clock">{settings.timeLimitSec ? FormatRemaining(settings.timeLimitSec * 1000, en) : `0.0 ${en ? 's' : '秒'}`}</p>
        <button ref={stopRef} type="button" className="btn btn-ghost sk-stop" onClick={pause}>{en ? 'Stop' : '停止'}</button>
      </header>
      <p className={`sk-feedback${match?.outcome ? ' sk-outcome' : ''}`} role="status" data-outcome={match?.outcome ?? undefined}>
        {match?.outcome ? outcomeLabel(match) : fullWrong ? (en ? 'Every cell is filled, but something breaks the rule.' : '格子都填滿了，但還有不符合規則的地方。') : ''}</p>
      {match && <div className="sk-board-slot">
        <NumberBoard size={match.size} state={match.outcome ? 'over' : 'running'} label={en ? 'Game board' : '棋盤'} onKeyDown={event => boardKeys(event, match)}>
          {match.values.map((value, index) => <button type="button" key={index} className="sk-cell" data-index={index}
            data-given={match.givens[index] ? 'true' : undefined} {...CellEdges(index, match.size, match.kind)}
            tabIndex={index === focusCell ? 0 : -1} onFocus={() => setFocusCell(index)} aria-label={cellLabel(index, match)}
            onClick={() => change((current, now) => current.cycle(index, now))}>{value || ''}</button>)}
        </NumberBoard>
      </div>}
    </main>{paused && <div className="game-interrupt-overlay"><div className="game-interrupt-panel" role="dialog" aria-modal="true" aria-labelledby="sk-pause-title"
      onKeyDown={event => { if (event.key === 'Tab') { const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button'); if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[1].focus(); } else if (!event.shiftKey && document.activeElement === buttons[1]) { event.preventDefault(); buttons[0].focus(); } } }}>
      <h2 id="sk-pause-title">{en ? 'Paused' : '已暫停'}</h2>
      <p>{fullscreenInterrupted ? (en ? 'Fullscreen ended; ending the activity will not save this session.' : '已退出全螢幕，結束後不會保存這次紀錄。') : (en ? 'Ending the activity will not save this session.' : '結束後不會保存這次紀錄。')}</p>
      <button ref={continueRef} className="btn btn-primary" type="button" onClick={resume}>{en ? 'Continue' : '繼續'}</button>
      <button className="btn btn-ghost" type="button" onClick={exit}>{en ? 'End activity' : '結束活動'}</button>
    </div></div>}</>}
    {phase === 'results' && score && summary && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1 ref={resultHeadingRef} tabIndex={-1}>{en ? 'Session results' : '當次成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><p className="score-complete">{en ? 'Activity complete' : '已完成本次活動'}</p><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Result' : '結果'}</p><strong>{summary.completed ? (en ? 'Solved' : '完成') : (en ? 'Time is up' : '時間到')}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Entries' : '填寫次數'}</p><strong>{summary.moves}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Mean time per entry' : '平均每次填寫時間'}</p><strong>{ms(summary.meanThinkMs)}</strong></div>
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
        <div className="score-context-item"><dt>{en ? 'Full boards that broke the rule' : '填滿但不符合規則的次數'}</dt><dd>{summary.errors}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Blanks left at the end' : '結束時的空格數'}</dt><dd>{summary.blanksLeft}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Total time' : '總用時'}</dt><dd>{seconds(summary.duration)}</dd></div>
      </dl></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      </details>
    </section></div>}
  </div>;
}
