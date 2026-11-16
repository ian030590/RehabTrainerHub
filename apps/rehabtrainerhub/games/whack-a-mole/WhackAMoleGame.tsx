import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useT } from './i18n/useT';
import { defaultSettings, difficulties, durationRange, ValidateSettings, type Difficulty, type WhackAMoleSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { WhackTutorial } from './rules/WhackTutorial';
import { CreateRandom, firstTargetMs, whackConfig, WhackMatch } from './logic/whackAMole';
import { FormatRemaining, HoleBoard, HoleContents, MoveHoleFocus } from './HoleBoard';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayFailureSound, PlayGameEndSound, PlayMidiMusic, PlaySuccessSound, PrepareAudioFeedback, SetSoundEnabled, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';
import { CreateHoleEffects } from './fx/holeEffects';
import { PauseClock } from './logic/pauseClock';

type Phase = 'menu' | 'rules' | 'running' | 'results';
type Flash = { index: number; kind: 'hit' | 'wrong' } | null;
const outcomeHoldMs = 1600;
const warningMs = 10000;
const flashMs = 300;

export function WhackAMoleGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  const [paused, setPaused] = useState(false);
  const [fullscreenInterrupted, setFullscreenInterrupted] = useState(false);
  const pausedRef = useRef(false);
  const endingRef = useRef(false);
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
  const [settings, setSettings] = useState<WhackAMoleSettings>({ ...defaultSettings });
  useEffect(() => { SetSoundEnabled(settings.soundEnabled); }, [settings.soundEnabled]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [score, setScore] = useState<ReturnType<typeof BuildGameScore> | null>(null);
  const [focusHole, setFocusHole] = useState(0);
  const [flash, setFlash] = useState<Flash>(null);
  const [over, setOver] = useState(false);
  const [, setVersion] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const clockRef = useRef<HTMLParagraphElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const matchRef = useRef<WhackMatch | null>(null);
  const holeEffectsRef = useRef<ReturnType<typeof CreateHoleEffects> | null>(null);
  const attachEffects = useCallback((canvas: HTMLCanvasElement | null) => {
    holeEffectsRef.current?.dispose();
    holeEffectsRef.current = canvas ? CreateHoleEffects(canvas) : null;
  }, []);
  const startedAtRef = useRef(0);
  const endedAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<PauseClock['set']>>(null);
  const limitTimerRef = useRef<ReturnType<PauseClock['set']>>(null);
  const moleTimerRef = useRef<ReturnType<PauseClock['set']>>(null);
  const flashTimerRef = useRef<ReturnType<PauseClock['set']>>(null);
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
    holeEffectsRef.current?.clear();
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
    holeEffectsRef.current?.clear();
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

  const finish = useCallback((match: WhackMatch) => {
    endingRef.current = true;
    const result = BuildGameScore(match, (endedAtRef.current ?? pauseClockRef.current!.now()) - startedAtRef.current);
    jsPsychLifecycleRef.current?.finish({ hits: result.summary.hits, misses: result.summary.misses, meanMs: result.summary.meanMs });
    matchRef.current = null;
    setScore(result);
    setSaveState(IsHubGame() ? 'saving' : 'local');
    SendGameResult({ ...settings }, result.summary, result.rounds);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setPhase('results');
  }, [settings]);
  // A mole still up when time runs out counts as ducked, as in the original game; the board then stays briefly.
  const end = useCallback((match: WhackMatch) => {
    endedAtRef.current = pauseClockRef.current!.now();
    holeEffectsRef.current?.clear();
    pauseClockRef.current?.clear(moleTimerRef.current);
    match.expire(endedAtRef.current);
    PlayGameEndSound(match.hits > 0 ? 'Victory' : 'Defeat');
    setOver(true);
    setVersion(version => version + 1);
    const generation = generationRef.current;
    timerRef.current = pauseClockRef.current!.set(() => { if (generation === generationRef.current) finish(match); }, outcomeHoldMs);
  }, [finish]);
  const showFlash = useCallback((index: number, kind: 'hit' | 'wrong') => {
    setFlash({ index, kind });
    pauseClockRef.current?.clear(flashTimerRef.current);
    flashTimerRef.current = pauseClockRef.current!.set(() => setFlash(null), flashMs);
  }, []);
  // Waits the gap, raises a mole, and lets it duck if nobody taps it in time.
  const schedule = useCallback((match: WhackMatch, delay: number) => {
    const generation = generationRef.current;
    const live = () => generation === generationRef.current && matchRef.current === match && endedAtRef.current === null;
    pauseClockRef.current?.clear(moleTimerRef.current);
    moleTimerRef.current = pauseClockRef.current!.set(() => {
      if (!live() || match.show(pauseClockRef.current!.now()) === null) return;
      const shown = match.shown;
      flushSync(() => setVersion(version => version + 1));
      match.stampOnset(pauseClockRef.current!.now());
      moleTimerRef.current = pauseClockRef.current!.set(() => {
        if (!live() || match.shown !== shown || !match.expire(pauseClockRef.current!.now())) return;
        holeEffectsRef.current?.resetStreak();
        PlayFailureSound();
        setVersion(version => version + 1);
        schedule(match, match.nextDelay());
      }, match.targetMs);
    }, delay);
  }, []);
  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (phase !== 'running' || !host) return;
    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    const clock = new PauseClock({ now: () => performance.now(), set: (callback, ms) => window.setTimeout(callback, ms), clear: timer => window.clearTimeout(timer) });
    pauseClockRef.current = clock;
    if (pausedRef.current) clock.pause();
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:whack-a-mole', onStart: () => {
      startedAtRef.current = clock.now();
      endedAtRef.current = null;
      const match = new WhackMatch(settings.difficulty, CreateRandom(Date.now()));
      matchRef.current = match;
      setFocusHole(0);
      setFlash(null);
      setOver(false);
      setVersion(version => version + 1);
      schedule(match, firstTargetMs);
      const generation = generationRef.current;
      limitTimerRef.current = clock.set(() => {
        if (generation === generationRef.current && matchRef.current === match) end(match);
      }, settings.durationSec * 1000);
    } });
    return () => {
      matchRef.current = null;
      clock.stop();
      if (pauseClockRef.current === clock) pauseClockRef.current = null;
      lifecycle.dispose();
      if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null;
    };
  }, [phase, settings.difficulty, settings.durationSec, end, schedule]);
  // The visible clock reads the match start time, so it never drifts from the recorded duration.
  useEffect(() => {
    if (phase !== 'running' || paused) return;
    const timer = window.setInterval(() => {
      const clock = clockRef.current;
      if (!clock || !matchRef.current || endedAtRef.current !== null) return;
      const remaining = settings.durationSec * 1000 - (pauseClockRef.current!.now() - startedAtRef.current);
      clock.textContent = FormatRemaining(remaining, en);
      clock.toggleAttribute('data-warning', remaining <= warningMs);
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase, en, settings.durationSec, paused]);

  const tapHole = (index: number, at: number) => {
    const match = matchRef.current;
    if (phaseRef.current !== 'running' || pausedRef.current || !match || endedAtRef.current !== null) return;
    // Pointer events carry their own time; keep it only when it is on the page clock.
    const now = performance.now();
    const tap = match.tap(index, (Number.isFinite(at) && at > 0 && Math.abs(at - now) < 1000 ? at : now) - (now - pauseClockRef.current!.now()));
    if (!tap.accepted || !tap.outcome) return;
    if (tap.outcome === 'hit') PlaySuccessSound();
    if (tap.outcome === 'wrong') PlayFailureSound();
    showFlash(index, tap.outcome);
    setVersion(version => version + 1);
    schedule(match, match.nextDelay());
    holeEffectsRef.current?.play(index, tap.outcome);
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

  const levelLabel = (difficulty: Difficulty) => {
    const { gridSize, targetMs } = whackConfig[difficulty];
    return en ? `${gridSize} × ${gridSize} holes / up ${targetMs / 1000} s` : `${gridSize} × ${gridSize} 個洞／停留 ${targetMs / 1000} 秒`;
  };
  const secondsLabel = (value: number) => en ? `${value} s` : `${value} 秒`;
  const onOff = (value: boolean) => value ? (en ? 'On' : '開啟') : (en ? 'Off' : '關閉');
  const summaryItems = [
    { label: en ? 'Holes and mole time' : '洞數與地鼠停留時間', value: levelLabel(settings.difficulty) },
    { label: en ? 'Session length' : '活動時間', value: secondsLabel(settings.durationSec) },
    { label: en ? 'Sound feedback' : '聲音回饋', value: onOff(settings.soundEnabled) },
  ];
  const ms = (value: number | null) => value === null ? (en ? 'N/A' : '無') : `${(value / 1000).toFixed(2)} ${en ? 's' : '秒'}`;
  const match = matchRef.current;
  const holeLabel = (index: number, size: number, up: boolean) => {
    const position = en ? `Row ${Math.floor(index / size) + 1}, column ${index % size + 1}` : `第 ${Math.floor(index / size) + 1} 列第 ${index % size + 1} 欄`;
    return `${position}${en ? ', ' : '，'}${up ? (en ? 'mole up' : '有地鼠') : (en ? 'empty' : '空的')}`;
  };
  const summary = score?.summary;
  return <div ref={rootRef} className="whack-a-mole-game-root">
    <div ref={jsPsychHostRef} className="wm-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <WhackTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog whack-a-mole-phase-menu" aria-labelledby="wm-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="wm-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            <label>{en ? 'Holes and mole time' : '洞數與地鼠停留時間'}<select name="difficulty" value={settings.difficulty}
              onChange={event => setSettings({ ...settings, difficulty: event.target.value as Difficulty })}>
              {difficulties.map(difficulty => <option key={difficulty} value={difficulty}>{levelLabel(difficulty)}</option>)}
            </select>
              <small className="training-setting-description">{en ? 'More holes and shorter mole times ask for faster searching and tapping.' : '洞越多、地鼠停留越短，就要更快找到並點擊。'}</small></label>
            <label>{en ? 'Session length' : '活動時間'}：<output>{secondsLabel(settings.durationSec)}</output>
              <input name="durationSec" type="range" min={durationRange.min} max={durationRange.max} step={durationRange.step} value={settings.durationSec}
                onChange={event => setSettings({ ...settings, durationSec: Number(event.target.value) })} />
              <small className="training-setting-description">{en ? 'The game ends when this time runs out.' : '時間到這局就結束。'}</small></label>
            <label className="wm-checkbox"><input name="soundEnabled" type="checkbox" checked={settings.soundEnabled}
              onChange={event => setSettings({ ...settings, soundEnabled: event.target.checked })} />{en ? 'Sound feedback' : '聲音回饋'}
              <small className="training-setting-description">{en ? 'A short sound for each hit or miss, and when the game ends.' : '打中、漏掉與結束時播放提示音。'}</small></label>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <><main className="wm-stage wm-running" aria-label={title} inert={paused}>
      <header className="wm-hud">
        <p className="wm-hits">{en ? 'Hits' : '打中'} <strong>{match?.hits ?? 0}</strong></p>
        <p className="wm-misses">{en ? 'Misses' : '漏掉'} {match?.misses ?? 0}</p>
        <p ref={clockRef} className="wm-clock">{FormatRemaining(settings.durationSec * 1000, en)}</p>
        <button ref={stopRef} type="button" className="btn btn-ghost wm-stop" onClick={pause}>{en ? 'Stop' : '停止'}</button>
      </header>
      <p className={`wm-feedback${over ? ' wm-outcome' : ''}`} role="status">
        {over && match ? (en ? `Time is up: ${match.hits} hit${match.hits === 1 ? '' : 's'}` : `時間到，打中 ${match.hits} 隻`) : ''}</p>
      {match && <div className="wm-board-slot" style={{ visibility: paused ? 'hidden' : 'visible' }}>
        <HoleBoard size={match.gridSize} state={over ? 'over' : 'running'} label={en ? 'Holes' : '地洞'} effectsRef={attachEffects}
          onKeyDown={event => MoveHoleFocus(event, match.gridSize)}>
          {Array.from({ length: match.gridSize * match.gridSize }, (_, index) => <button type="button" key={index} className="wm-hole" data-index={index}
            data-up={match.active === index ? 'true' : undefined} tabIndex={index === focusHole ? 0 : -1} onFocus={() => setFocusHole(index)}
            aria-label={holeLabel(index, match.gridSize, match.active === index)}
            onPointerDown={event => tapHole(index, event.timeStamp)}
            onClick={event => { if (event.detail === 0) tapHole(index, performance.now()); }}>
            <HoleContents flash={flash?.index === index ? flash.kind : undefined} /></button>)}
        </HoleBoard>
      </div>}
    </main>{paused && <div className="game-interrupt-overlay"><div className="game-interrupt-panel" role="dialog" aria-modal="true" aria-labelledby="wm-pause-title"
      onKeyDown={event => { if (event.key === 'Tab') { const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button'); if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[1].focus(); } else if (!event.shiftKey && document.activeElement === buttons[1]) { event.preventDefault(); buttons[0].focus(); } } }}>
      <h2 id="wm-pause-title">{en ? 'Paused' : '已暫停'}</h2>
      <p>{fullscreenInterrupted ? (en ? 'Fullscreen ended; ending the activity will not save this session.' : '已退出全螢幕，結束後不會保存這次紀錄。') : (en ? 'Ending the activity will not save this session.' : '結束後不會保存這次紀錄。')}</p>
      <button ref={continueRef} className="btn btn-primary" type="button" onClick={resume}>{en ? 'Continue' : '繼續'}</button>
      <button className="btn btn-ghost" type="button" onClick={exit}>{en ? 'End activity' : '結束活動'}</button>
    </div></div>}</>}
    {phase === 'results' && score && summary && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1 ref={resultHeadingRef} tabIndex={-1}>{en ? 'Session results' : '當次成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><p className="score-complete">{en ? 'Activity complete' : '已完成本次活動'}</p><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Hits' : '打中'}</p><strong>{summary.hits}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Misses' : '漏掉'}</p><strong>{summary.misses}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Mean hit time' : '平均打中時間'}</p><strong>{ms(summary.meanMs)}</strong></div>
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
        <div className="score-context-item"><dt>{en ? 'Fastest hit' : '最快打中時間'}</dt><dd>{ms(summary.bestMs)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Moles that ducked' : '躲回去的地鼠'}</dt><dd>{summary.expired}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Taps on the wrong hole' : '點錯洞'}</dt><dd>{summary.wrongTaps}</dd></div>
      </dl></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      </details>
    </section></div>}
  </div>;
}
