import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, difficulties, EstimatedSeconds, roundsRange, timeLimits, ValidateSettings, type ReactionSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { ReactionTutorial } from './rules/ReactionTutorial';
import { CreateSession, DrawForeperiod, foreperiods, InterruptReaction, Press, ShowGo, Successes, type Difficulty, type ReactionSession, type Status } from './logic/reactionTrials';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayFailureSound, PlayGameEndSound, PlayMidiMusic, PlaySuccessSound, PrepareAudioFeedback, SetSoundEnabled, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

type Phase = 'menu' | 'rules' | 'running' | 'results';

const lastResultMs = 1000;
export const RangeText = (difficulty: Difficulty, en: boolean) => {
  const [low, high] = foreperiods[difficulty].map(value => value / 1000);
  return en ? `${low}–${high} s` : `${low}–${high} 秒`;
};
export const Clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
// Big label and the line under it for each screen state.
export function PanelText(status: Status, lastMs: number | null, en: boolean): [string, string] {
  if (status === 'wait') return en ? ['Wait…', 'Press when it turns green'] : ['等待…', '變綠色再按'];
  if (status === 'go') return en ? ['Press!', ''] : ['按！', ''];
  if (status === 'early') return en ? ['Too early', 'Wait for green. Tap to try again.'] : ['太早了', '要等變綠色才按。點一下重新開始。'];
  if (status === 'result') return [en ? `${lastMs} ms` : `${lastMs} 毫秒`, en ? 'Tap to start the next one' : '點一下開始下一次'];
  return en ? ['Tap to start', 'Or press Space. Red means wait; press as soon as it turns green.'] : ['點這裡開始', '也可以按空白鍵。紅色時等待，變綠色立刻按。'];
}

export function ReactionSignal() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  const [paused, setPaused] = useState(false);
  const [fullscreenInterrupted, setFullscreenInterrupted] = useState(false);
  const endingRef = useRef(false);
  const pausedRef = useRef(false);
  const pauseRunRef = useRef<(() => void) | null>(null);
  const resumeRunRef = useRef<(() => void) | null>(null);
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
  const [settings, setSettings] = useState<ReactionSettings>({ ...defaultSettings });
  useEffect(() => { SetSoundEnabled(settings.soundEnabled); }, [settings.soundEnabled]);
  const [session, setSession] = useState<ReactionSession>(CreateSession);
  const [durationSec, setDurationSec] = useState(0);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLParagraphElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const timerRef = useRef<HTMLParagraphElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const pressRef = useRef<((timeMs: number) => void) | null>(null);
  const stopRunRef = useRef<(() => void) | null>(null);
  const drawRef = useRef<(() => void) | null>(null);
  const generationRef = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const enRef = useRef(en);
  enRef.current = en;

  useEffect(() => OnSavedSettings(saved => {
    const restored = RestoreSettings(saved, defaultSettings, ValidateSettings);
    if (restored && phaseRef.current === 'menu') setSettings(restored);
  }), []);
  const stopRuntime = useCallback(() => {
    endingRef.current = true;
    pausedRef.current = false;
    setPaused(false);
    generationRef.current++;
    stopRunRef.current?.();
    stopRunRef.current = null;
    pressRef.current = null;
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
  }, []);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const pause = useCallback(() => {
    if (pausedRef.current) return;
    setFullscreenInterrupted(false);
    pausedRef.current = true;
    pauseRunRef.current?.();
    StopMidiMusic();
    setPaused(true);
  }, []);
  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    restoreStopRef.current = true;
    setPaused(false);
    resumeRunRef.current?.();
  }, []);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setSession(CreateSession()); setPhase('menu'); };
    const fullscreenChanged = () => { if (phaseRef.current === 'running' && !endingRef.current && !document.fullscreenElement) { pause(); setFullscreenInterrupted(true); } };
    const keys = (event: KeyboardEvent) => {
      if (phaseRef.current !== 'running') return;
      if (event.key === 'Escape') { event.preventDefault(); if (!event.repeat) { if (pausedRef.current) resume(); else pause(); } return; }
      if (pausedRef.current) return;
      // Space or Enter press the panel; Enter on the Stop button keeps its own meaning.
      if ((event.key === ' ' || event.key === 'Enter') && (event.target as HTMLElement).tagName !== 'BUTTON') {
        event.preventDefault();
        if (!event.repeat) pressRef.current?.(event.timeStamp);
      }
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
  useEffect(() => { drawRef.current?.(); }, [en]);
  useEffect(() => {
    if (phase !== 'menu') return;
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, [phase]);
  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (phase !== 'running' || !host) return;
    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    const timers = new Set<number>();
    let frame = 0, ticker = 0, signal = 0;
    let stopped = false, initialized = false;
    let current = CreateSession();
    let startedAt = 0, pausedAt = 0;
    const later = (callback: () => void, ms: number) => {
      const timer = window.setTimeout(() => { timers.delete(timer); if (!stopped) callback(); }, ms);
      timers.add(timer);
      return timer;
    };
    const stop = () => {
      stopped = true;
      for (const timer of timers) window.clearTimeout(timer);
      timers.clear();
      window.cancelAnimationFrame(frame);
      window.clearInterval(ticker);
      pressRef.current = null;
      drawRef.current = null;
      pauseRunRef.current = null;
      resumeRunRef.current = null;
    };
    stopRunRef.current = stop;
    // The panel is drawn straight from the session so the signal does not wait for a React render.
    const draw = () => {
      const panel = panelRef.current;
      if (!panel) return;
      panel.dataset.state = current.status;
      const [label, hint] = PanelText(current.status, current.lastMs, enRef.current);
      if (labelRef.current) labelRef.current.textContent = label;
      if (hintRef.current) hintRef.current.textContent = hint;
      panel.setAttribute('aria-label', hint ? `${label} ${hint}` : label);
    };
    drawRef.current = draw;
    draw();
    const update = (next: ReactionSession) => { current = next; draw(); setSession(next); };
    const finish = () => {
      endingRef.current = true;
      stop();
      const duration = (performance.now() - startedAt) / 1000;
      const score = BuildGameScore(current.rows, duration);
      jsPsychLifecycleRef.current?.finish({ trials: score.summary.attempts, successes: score.summary.successes });
      PlayGameEndSound('Victory');
      setDurationSec(duration);
      setSession(current);
      setSaveState(IsHubGame() ? 'saving' : 'local');
      SendGameResult({ ...settings }, score.summary, score.rounds);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      setPhase('results');
    };
    const random = Math.random;
    const startClock = () => {
      if (!settings.timeLimitSec) return;
      const showLeft = () => {
        const left = Math.max(0, Math.ceil(settings.timeLimitSec - (performance.now() - startedAt) / 1000));
        if (timerRef.current) timerRef.current.textContent = enRef.current ? `${Clock(left)} left` : `剩 ${Clock(left)}`;
      };
      showLeft();
      ticker = window.setInterval(showLeft, 250);
      later(finish, Math.max(0, settings.timeLimitSec * 1000 - (performance.now() - startedAt)));
    };
    pauseRunRef.current = () => {
      if (!initialized) return;
      pausedAt = performance.now();
      for (const timer of timers) window.clearTimeout(timer);
      timers.clear();
      window.cancelAnimationFrame(frame);
      window.clearInterval(ticker);
      update(InterruptReaction(current));
    };
    resumeRunRef.current = () => {
      if (!initialized) return;
      startedAt += performance.now() - pausedAt;
      startClock();
      if (Successes(current) >= settings.rounds) later(finish, lastResultMs);
    };
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:reaction-time', onStart: () => {
      initialized = true;
      startedAt = performance.now();
      if (pausedRef.current) pausedAt = startedAt;
      else startClock();
      pressRef.current = timeMs => {
        if (pausedRef.current) return;
        const before = current.status;
        if (before === 'result' && Successes(current) >= settings.rounds) return;
        const { session: next, row } = Press(current, timeMs, DrawForeperiod(settings.difficulty, random));
        if (before === 'wait') window.clearTimeout(signal);
        update(next);
        if (next.status === 'wait') {
          signal = later(() => {
            // Time the signal from the frame that paints it.
            frame = window.requestAnimationFrame(() => {
              if (stopped || current.status !== 'wait') return;
              current = ShowGo(current, performance.now());
              draw();
              setSession(current);
            });
            if (panelRef.current && current.status === 'wait') {
              panelRef.current.dataset.state = 'go';
              const [label] = PanelText('go', null, enRef.current);
              if (labelRef.current) labelRef.current.textContent = label;
              if (hintRef.current) hintRef.current.textContent = '';
            }
          }, next.foreperiodMs!);
        }
        if (row?.falseStart) PlayFailureSound();
        else if (row) {
          PlaySuccessSound();
          if (Successes(next) >= settings.rounds) later(finish, lastResultMs);
        }
      };
    } });
    return () => {
      stop();
      lifecycle.dispose();
      if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null;
    };
  }, [phase, settings]);

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
    setSession(CreateSession());
    setPhase('running');
  };

  const duration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60), extra = seconds % 60;
    const parts = en ? [minutes && `${minutes} min`, extra && `${extra} s`] : [minutes && `${minutes} 分`, extra && `${extra} 秒`];
    return parts.filter(Boolean).join(' ');
  };
  const limitLabel = (seconds: number) => seconds ? (en ? `${seconds / 60} min` : `${seconds / 60} 分鐘`) : (en ? 'No limit' : '不限時');
  const summaryItems = [
    { label: en ? 'Random wait' : '隨機等待區間', value: RangeText(settings.difficulty, en) },
    { label: en ? 'Successful responses' : '成功反應目標', value: en ? `${settings.rounds}` : `${settings.rounds} 次` },
    { label: en ? 'Time limit' : '時間限制', value: limitLabel(settings.timeLimitSec) },
    { label: en ? 'Sound feedback' : '聲音回饋', value: settings.soundEnabled ? (en ? 'On' : '開啟') : (en ? 'Off' : '關閉') },
    { label: en ? 'Estimated time' : '預估時間', value: `${en ? 'about' : '約'} ${duration(EstimatedSeconds(settings))}` },
  ];
  const hints = en ? {
    difficulty: 'How long the screen stays red before it turns green. The wait is random within the range.',
    rounds: 'The session ends after this many timed presses. Pressing too early is counted separately and does not count here.',
    timeLimitSec: 'With a limit, the session also ends when time runs out.',
    soundEnabled: 'A short sound after each press and at the end.',
  } : {
    difficulty: '畫面維持紅色多久才變綠色，每次在區間內隨機。',
    rounds: '成功按到這個次數就結束。太早按會另外記錄，不算在內。',
    timeLimitSec: '設定時限時，時間到也會結束。',
    soundEnabled: '每次按下後與結束時播放短提示音。',
  };
  const score = BuildGameScore(session.rows, durationSec);
  const summary = score.summary;
  const missing = en ? 'N/A' : '無';
  const ms = (value: number | null) => value === null ? missing : `${value} ms`;
  const successes = Successes(session);
  return <div ref={rootRef} className="reaction-time-game-root">
    <div ref={jsPsychHostRef} className="reaction-time-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <ReactionTutorial active={phase === 'rules'} ready title={title}
      settings={settings} range={RangeText(settings.difficulty, en)} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog reaction-time-phase-menu" aria-labelledby="reaction-time-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="reaction-time-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            <label>{en ? 'Random wait' : '隨機等待區間'}<select name="difficulty" value={settings.difficulty}
              onChange={event => setSettings({ ...settings, difficulty: event.target.value as Difficulty })}>
              {difficulties.map(item => <option key={item} value={item}>{RangeText(item, en)}</option>)}
            </select>
              <small className="training-setting-description">{hints.difficulty}</small></label>
            <label>{en ? 'Successful responses' : '成功反應目標'}：<output>{en ? settings.rounds : `${settings.rounds} 次`}</output>
              <input name="rounds" type="range" min={roundsRange.min} max={roundsRange.max} step={roundsRange.step} value={settings.rounds}
                onChange={event => setSettings({ ...settings, rounds: Number(event.target.value) })} />
              <small className="training-setting-description">{hints.rounds}</small></label>
            <label>{en ? 'Time limit' : '時間限制'}<select name="timeLimitSec" value={settings.timeLimitSec}
              onChange={event => setSettings({ ...settings, timeLimitSec: Number(event.target.value) })}>
              {timeLimits.map(item => <option key={item} value={item}>{limitLabel(item)}</option>)}
            </select>
              <small className="training-setting-description">{hints.timeLimitSec}</small></label>
            <label className="reaction-time-checkbox"><input name="soundEnabled" type="checkbox" checked={settings.soundEnabled}
              onChange={event => setSettings({ ...settings, soundEnabled: event.target.checked })} />{en ? 'Sound feedback' : '聲音回饋'}
              <small className="training-setting-description">{hints.soundEnabled}</small></label>
            <p className="reaction-time-estimate">{en ? 'Estimated time' : '預估時間'}：{en ? 'about' : '約'} {duration(EstimatedSeconds(settings))}{en ? '; you start each try yourself' : '（每次由你自己開始，實際時間依速度而定）'}</p>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <><main className="reaction-time-stage reaction-time-running" aria-label={title} inert={paused}>
      <header className="reaction-time-hud">
        <p className="reaction-time-progress-label">{en ? `Timed: ${successes} of ${settings.rounds}` : `成功 ${successes}／${settings.rounds}`}</p>
        <p className="reaction-time-early">{en ? `Too early: ${session.rows.length - successes}` : `太早 ${session.rows.length - successes} 次`}</p>
        {settings.timeLimitSec > 0 && <p ref={timerRef} className="reaction-time-timer" aria-live="off" />}
        <div className="reaction-time-progress-track"><div className="reaction-time-progress-fill" style={{ width: `${successes / settings.rounds * 100}%` }} /></div>
        <button ref={stopRef} type="button" className="btn btn-ghost reaction-time-stop" onClick={pause}>{en ? 'Stop' : '停止'}</button>
      </header>
      <div ref={panelRef} className="reaction-time-panel" role="button" tabIndex={0}
        onPointerDown={event => {
          if (event.button !== 0) return;
          event.preventDefault();
          pressRef.current?.(event.timeStamp);
        }}>
        <p ref={labelRef} className="reaction-time-label" aria-live="polite" />
        <p ref={hintRef} className="reaction-time-hint" />
      </div>
    </main>{paused && <div className="game-interrupt-overlay"><div className="game-interrupt-panel" role="dialog" aria-modal="true" aria-labelledby="reaction-pause-title"
      onKeyDown={event => { if (event.key === 'Tab') { const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button'); if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[1].focus(); } else if (!event.shiftKey && document.activeElement === buttons[1]) { event.preventDefault(); buttons[0].focus(); } } }}>
      <h2 id="reaction-pause-title">{en ? 'Paused' : '已暫停'}</h2>
      <p>{fullscreenInterrupted ? (en ? 'Fullscreen ended; ending the activity will not save this session.' : '已退出全螢幕，結束後不會保存這次紀錄。') : (en ? 'Ending the activity will not save this session.' : '結束後不會保存這次紀錄。')}</p>
      <button ref={continueRef} className="btn btn-primary" type="button" onClick={resume}>{en ? 'Continue' : '繼續'}</button>
      <button className="btn btn-ghost" type="button" onClick={exit}>{en ? 'End activity' : '結束活動'}</button>
    </div></div>}</>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1 ref={resultHeadingRef} tabIndex={-1}>{en ? 'Session results' : '當次成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><p className="score-complete">{en ? 'Activity complete' : '已完成本次活動'}</p><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Mean reaction time' : '平均反應時間'}</p><strong>{ms(summary.meanMs)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Fastest' : '最快一次'}</p><strong>{ms(summary.bestMs)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Too early' : '太早按'}</p><strong>{en ? summary.falseStarts : `${summary.falseStarts} 次`}</strong></div>
      </div></section>
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      <div className="score-actions">
        {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
        <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
      </div>
      <details className="score-details"><summary>{en ? 'View details' : '查看詳細資料'}</summary>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.slice(0, -1).map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Timed presses' : '成功反應次數'}</dt><dd>{summary.successes} / {summary.attempts}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Median reaction time' : '反應時間中位數'}</dt><dd>{ms(summary.medianMs)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Spread (standard deviation)' : '反應時間標準差'}</dt><dd>{ms(summary.sdMs)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Session time' : '活動時間'}</dt><dd>{en ? `${summary.duration} s` : `${summary.duration} 秒`}</dd></div>
      </dl>
        <p className="score-note">{en ? 'Reaction time runs from the moment the screen turns green to your press. Presses while it is still red have no time and are only counted.'
          : '反應時間從畫面變綠色算到按下。紅色時就按不計時間，只計次數。'}</p></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      </details>
    </section></div>}
  </div>;
}
