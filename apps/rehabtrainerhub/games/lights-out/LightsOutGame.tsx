import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, difficulties, timeLimits, ValidateSettings, type Difficulty, type LightsOutSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { LightsOutTutorial } from './rules/LightsOutTutorial';
import { CreateRandom, lightsConfig, LightsMatch, type Outcome } from './logic/lightsOut';
import { FormatRemaining, LightsBoard, MoveLightsFocus } from './LightsBoard';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayGameEndSound, PlayMidiMusic, PrepareAudioFeedback, SetSoundEnabled, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';
import { PauseClock } from './logic/pauseClock';

type Phase = 'menu' | 'rules' | 'running' | 'results';
const outcomeHoldMs = 1600;
const warningMs = 10000;

export function LightsOutGame() {
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
  const [settings, setSettings] = useState<LightsOutSettings>({ ...defaultSettings });
  useEffect(() => { SetSoundEnabled(settings.soundEnabled); }, [settings.soundEnabled]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [score, setScore] = useState<ReturnType<typeof BuildGameScore> | null>(null);
  const [focusCell, setFocusCell] = useState(0);
  const [, setVersion] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const clockRef = useRef<HTMLParagraphElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const matchRef = useRef<LightsMatch | null>(null);
  const randomRef = useRef(CreateRandom(Date.now()));
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
    generationRef.current++;
    matchRef.current = null;
    pauseClockRef.current?.stop();
    pauseClockRef.current = null;
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

  const finish = useCallback((match: LightsMatch) => {
    endingRef.current = true;
    const result = BuildGameScore(match, (endedAtRef.current ?? pauseClockRef.current!.now()) - startedAtRef.current);
    jsPsychLifecycleRef.current?.finish({ outcome: match.outcome, moves: result.summary.moves, lightsLeft: result.summary.lightsLeft });
    matchRef.current = null;
    setScore(result);
    setSaveState(IsHubGame() ? 'saving' : 'local');
    SendGameResult({ ...settings }, result.summary, result.rounds);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setPhase('results');
  }, [settings]);
  // The final board stays on screen briefly so the player sees it before the results.
  const end = useCallback((match: LightsMatch, outcome: Outcome) => {
    endedAtRef.current = pauseClockRef.current!.now();
    pauseClockRef.current?.clear(limitTimerRef.current);
    // A board left lit at the time limit ends as a loss, as in the original game.
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
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:lights-out', onStart: () => {
      startedAtRef.current = clock.now();
      endedAtRef.current = null;
      randomRef.current = CreateRandom(Date.now());
      const match = new LightsMatch(settings.difficulty, startedAtRef.current, randomRef.current);
      matchRef.current = match;
      setFocusCell(Math.floor(match.size / 2) * match.size + Math.floor(match.size / 2));
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

  const pressCell = (index: number) => {
    const match = matchRef.current;
    if (phaseRef.current !== 'running' || pausedRef.current || !match) return;
    const press = match.press(index, pauseClockRef.current!.now());
    if (!press.accepted) return;
    setVersion(version => version + 1);
    if (press.solved) end(match, 'Victory');
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

  const boardLabel = (difficulty: Difficulty) => {
    const { size, shuffles } = lightsConfig[difficulty];
    return en ? `${size} × ${size} / ${shuffles} presses` : `${size} × ${size}／${shuffles} 步`;
  };
  const limitLabel = (value: number) => value === 0 ? (en ? 'No limit' : '不限時') : en ? `${value / 60} minute${value === 60 ? '' : 's'}` : `${value / 60} 分鐘`;
  const onOff = (value: boolean) => value ? (en ? 'On' : '開啟') : (en ? 'Off' : '關閉');
  const summaryItems = [
    { label: en ? 'Board and scramble' : '棋盤與打亂步數', value: boardLabel(settings.difficulty) },
    { label: en ? 'Time limit' : '時間限制', value: limitLabel(settings.timeLimitSec) },
    { label: en ? 'Sound feedback' : '聲音回饋', value: onOff(settings.soundEnabled) },
  ];
  const seconds = (value: number | null) => value === null ? (en ? 'N/A' : '無') : `${value.toFixed(1)} ${en ? 's' : '秒'}`;
  const ms = (value: number | null) => value === null ? (en ? 'N/A' : '無') : `${(value / 1000).toFixed(1)} ${en ? 's' : '秒'}`;
  const lightsText = (count: number) => en ? `${count} light${count === 1 ? '' : 's'}` : `${count} 盞燈`;
  const outcomeLabel = (match: LightsMatch) => match.outcome === 'Victory' ? (en ? 'Every light is off' : '燈全部熄滅了')
    : en ? `Time is up: ${lightsText(match.lightsLeft)} still on` : `時間到，還有 ${lightsText(match.lightsLeft)}亮著`;
  const match = matchRef.current;
  const cellLabel = (index: number, size: number, on: boolean) => {
    const position = en ? `Row ${Math.floor(index / size) + 1}, column ${index % size + 1}` : `第 ${Math.floor(index / size) + 1} 列第 ${index % size + 1} 欄`;
    return `${position}${en ? ', ' : '，'}${on ? (en ? 'on' : '亮') : (en ? 'off' : '暗')}`;
  };
  const summary = score?.summary;
  return <div ref={rootRef} className="lights-out-game-root">
    <div ref={jsPsychHostRef} className="lo-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <LightsOutTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog lights-out-phase-menu" aria-labelledby="lo-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="lo-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            <label>{en ? 'Board and scramble' : '棋盤與打亂步數'}<select name="difficulty" value={settings.difficulty}
              onChange={event => setSettings({ ...settings, difficulty: event.target.value as Difficulty })}>
              {difficulties.map(difficulty => <option key={difficulty} value={difficulty}>{boardLabel(difficulty)}</option>)}
            </select>
              <small className="training-setting-description">{en ? 'The board starts dark and is scrambled with this many random presses. That is not the fewest moves needed.' : '棋盤從全暗開始，用這麼多次隨機點擊打亂；這不等於最少解題步數。'}</small></label>
            <label>{en ? 'Time limit' : '時間限制'}<select name="timeLimitSec" value={settings.timeLimitSec}
              onChange={event => setSettings({ ...settings, timeLimitSec: Number(event.target.value) })}>
              {timeLimits.map(value => <option key={value} value={value}>{limitLabel(value)}</option>)}
            </select>
              <small className="training-setting-description">{en ? 'If lights are still on when time runs out, the game ends.' : '時間到時還有燈亮著，這局就結束。'}</small></label>
            <label className="lo-checkbox"><input name="soundEnabled" type="checkbox" checked={settings.soundEnabled}
              onChange={event => setSettings({ ...settings, soundEnabled: event.target.checked })} />{en ? 'Sound feedback' : '聲音回饋'}
              <small className="training-setting-description">{en ? 'A short sound when the game ends.' : '結束時播放提示音。'}</small></label>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <><main className="lo-stage lo-running" aria-label={title} inert={paused}>
      <header className="lo-hud">
        <p className="lo-left" role="status"><span className="lo-bulb-icon" />{en ? 'Lights on' : '還亮著'} <strong>{match?.lightsLeft ?? 0}</strong></p>
        <p className="lo-moves">{en ? 'Moves' : '步數'} {match?.moves ?? 0}</p>
        <p ref={clockRef} className="lo-clock">{settings.timeLimitSec ? FormatRemaining(settings.timeLimitSec * 1000, en) : `0.0 ${en ? 's' : '秒'}`}</p>
        <button ref={stopRef} type="button" className="btn btn-ghost lo-stop" onClick={pause}>{en ? 'Stop' : '停止'}</button>
      </header>
      <p className={`lo-feedback${match?.outcome ? ' lo-outcome' : ''}`} role="status" data-outcome={match?.outcome ?? undefined}>
        {match?.outcome ? outcomeLabel(match) : ''}</p>
      {match && <div className="lo-board-slot" style={{ visibility: paused ? 'hidden' : 'visible' }}>
        <LightsBoard size={match.size} state={match.outcome ? 'over' : 'running'} label={en ? 'Game board' : '棋盤'}
          onKeyDown={event => MoveLightsFocus(event, match.size)}>
          {match.lights.map((on, index) => <button type="button" key={index} className="lo-cell" data-index={index} data-on={on ? 'true' : undefined}
            tabIndex={index === focusCell ? 0 : -1} onFocus={() => setFocusCell(index)}
            aria-label={cellLabel(index, match.size, on)} onClick={() => pressCell(index)}><span className="lo-bulb" /></button>)}
        </LightsBoard>
      </div>}
    </main>{paused && <div className="game-interrupt-overlay"><div className="game-interrupt-panel" role="dialog" aria-modal="true" aria-labelledby="lo-pause-title"
      onKeyDown={event => { if (event.key === 'Tab') { const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button'); if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[1].focus(); } else if (!event.shiftKey && document.activeElement === buttons[1]) { event.preventDefault(); buttons[0].focus(); } } }}>
      <h2 id="lo-pause-title">{en ? 'Paused' : '已暫停'}</h2>
      <p>{fullscreenInterrupted ? (en ? 'Fullscreen ended; ending the activity will not save this session.' : '已退出全螢幕，結束後不會保存這次紀錄。') : (en ? 'Ending the activity will not save this session.' : '結束後不會保存這次紀錄。')}</p>
      <button ref={continueRef} className="btn btn-primary" type="button" onClick={resume}>{en ? 'Continue' : '繼續'}</button>
      <button className="btn btn-ghost" type="button" onClick={exit}>{en ? 'End activity' : '結束活動'}</button>
    </div></div>}</>}
    {phase === 'results' && score && summary && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1 ref={resultHeadingRef} tabIndex={-1}>{en ? 'Session results' : '當次成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><p className="score-complete">{en ? 'Activity complete' : '已完成本次活動'}</p><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Result' : '結果'}</p><strong>{summary.completed ? (en ? 'All lights off' : '全部熄滅') : (en ? 'Time is up' : '時間到')}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Moves' : '步數'}</p><strong>{summary.moves}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Mean time per move' : '平均每步時間'}</p><strong>{ms(summary.meanThinkMs)}</strong></div>
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
        <div className="score-context-item"><dt>{en ? 'Lights left on' : '結束時還亮著的燈'}</dt><dd>{summary.lightsLeft}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Total time' : '總用時'}</dt><dd>{seconds(summary.duration)}</dd></div>
      </dl></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      </details>
    </section></div>}
  </div>;
}
