import { useCallback, useEffect, useRef, useState } from 'react';
import { initJsPsych } from 'jspsych';
import { useT } from './i18n/useT';
import type { CopyKey } from './i18n';
import { defaultSettings, options, ValidateSettings, type Settings, type Scenario } from './settings';
import { BuildGameScore } from './score';
import { RestoreSettings } from './runtime/settingsMemory';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { DisposeAudioFeedback, PlayMidiMusic, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { BrakeReactionTutorial } from './rules/BrakeReactionTutorial';
import { RunningView } from './RunningView';
import { RoundStats, SessionSummary, SessionMetrics } from './SessionSummary';
import { ScoreAnalysis } from './ScoreAnalysis';
import { ModelFor, Motion } from './src/physics';
import { MakeRound, RandomFrom, ScenarioPlan } from './src/round';
import type { Row } from './src/score';
import { LoadCarAtlas, MakeRoad } from './src/road';

type Phase = 'menu' | 'rules' | 'confirm' | 'running' | 'paused' | 'feedback' | 'results';
type SaveState = 'saving' | 'saved' | 'error';
type Attempt = { round: ReturnType<typeof MakeRound>; falseStarts: number; note: string };

export function BrakeReactionGame() {
  const { lang, copy: t } = useT();
  const [settings, setSettings] = useState(defaultSettings);
  const en = lang === 'en';
  const [ready, setReady] = useState(window.parent === window);
  const [phase, setPhase] = useState<Phase>('menu');
  const [sound, setSound] = useState(true);
  const [demo, setDemo] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [feedback, setFeedback] = useState<Row>();
  const [attempt, setAttempt] = useState<Attempt>();
  const [saveState, setSaveState] = useState<SaveState>('saving');
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const stopRef = useRef<HTMLButtonElement>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const restoreStopFocus = useRef(false);
  const root = useRef<HTMLElement>(null);
  const jsPsychDisplay = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle>(null);
  const plan = useRef<Scenario[]>([]);
  const random = useRef(RandomFrom(0));
  const lastBrakeInput = useRef(-Infinity);
  const starting = useRef(false);
  const runGeneration = useRef(0);

  useEffect(() => {
    void LoadCarAtlas();
    const lifecycle = new JsPsychExternalLifecycle(initJsPsych({ display_element: jsPsychDisplay.current! }));
    jsPsychLifecycleRef.current = lifecycle;
    const unsubscribe = OnSavedSettings(saved => {
      setSettings(RestoreSettings(saved, defaultSettings, ValidateSettings) ?? defaultSettings);
      setReady(true);
    });
    const configure = () => {
      runGeneration.current++;
      starting.current = false;
      lifecycle.abort({ reason: 'configure' });
      DisposeAudioFeedback();
      setPhase('menu');
    };
    const saved = (event: Event) => setSaveState((event as CustomEvent<SaveState>).detail);
    const pagehide = () => {
      runGeneration.current++;
      starting.current = false;
      lifecycle.abort({ reason: 'pagehide' });
      DisposeAudioFeedback();
    };
    const pageshow = (event: PageTransitionEvent) => { if (event.persisted) configure(); };
    window.addEventListener('game:configure', configure);
    window.addEventListener('game:saved', saved);
    window.addEventListener('pagehide', pagehide);
    window.addEventListener('pageshow', pageshow);
    return () => {
      unsubscribe();
      window.removeEventListener('game:configure', configure);
      window.removeEventListener('game:saved', saved);
      window.removeEventListener('pagehide', pagehide);
      window.removeEventListener('pageshow', pageshow);
      runGeneration.current++;
      lifecycle.dispose();
      jsPsychLifecycleRef.current = null;
      DisposeAudioFeedback();
    };
  }, []);

  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(() => undefined);
    else StopMidiMusic();
    return StopMidiMusic;
  }, [phase, sound]);

  useEffect(() => {
    if (phase === 'menu') settingsDialog.current?.showModal();
    if (phase === 'paused') {
      resumeRef.current?.focus();
    } else if (phase === 'running' && restoreStopFocus.current) {
      restoreStopFocus.current = false;
      stopRef.current?.focus();
    } else {
      root.current?.querySelector<HTMLElement>('h1, h2')?.focus({ preventScroll: true });
    }
  }, [phase, attempt]);

  function Exit() {
    runGeneration.current++;
    starting.current = false;
    jsPsychLifecycleRef.current?.abort({ reason: 'exit' });
    setPhase('menu');
    void ExitGame();
  }

  const confirmSettings = () => {
    if (!ready || !formRef.current?.reportValidity() || !ValidateSettings(settings)) return;
    SaveGameSettings(settings);
    setPhase('rules');
  };

  const drawPreview = useCallback((canvas: HTMLCanvasElement, atlas: HTMLImageElement | null) => {
    const model = ModelFor(settings);
    const example = { ...MakeRound(settings, 'plain', 0, RandomFrom(1)), gap: 16, decoys: [] };
    const draw = MakeRoad(canvas, atlas, example, settings.leadType);
    const motion = Motion(model, example.gap, 10, 0);
    return () => draw(model, example.onset, motion, 0, settings.road === 'wet', true);
  }, [settings]);

  const runRound = useCallback((index: number, falseStarts = 0, note = '') => {
    setAttempt({ round: MakeRound(settings, plan.current[index], index, random.current), falseStarts, note });
    setPhase('running');
  }, [settings]);

  function Start(isDemo: boolean) {
    if (starting.current || !ValidateSettings(settings)) return;
    PrepareAudioFeedback();
    setDemo(isDemo);
    setRows([]);
    random.current = RandomFrom(crypto.getRandomValues(new Uint32Array(1))[0]);
    plan.current = ScenarioPlan(settings.scenario, random.current);
    lastBrakeInput.current = -Infinity;
    if (isDemo) {
      runRound(0);
      return;
    }
    starting.current = true;
    const generation = ++runGeneration.current;
    const element = root.current;
    if (element?.requestFullscreen) void element.requestFullscreen().catch(() => undefined);
    void jsPsychLifecycleRef.current?.start({
      moduleId: 'vision:brake-reaction',
      onStart: () => {
        if (generation !== runGeneration.current) {
          jsPsychLifecycleRef.current?.abort({ reason: 'stale-start' });
          return;
        }
        starting.current = false;
        SendGameEvent('active');
        runRound(0);
      },
    }).then(started => {
      if (!started && generation === runGeneration.current) starting.current = false;
    }).catch(() => {
      if (generation !== runGeneration.current) return;
      starting.current = false;
      DisposeAudioFeedback();
    });
  }

  const onFalseStart = useCallback(() => {
    runRound(rows.length, (attempt?.falseStarts ?? 0) + 1, t.falseStart);
  }, [runRound, rows.length, attempt, t.falseStart]);

  const onPause = useCallback(() => {
    DisposeAudioFeedback();
    setPhase('paused');
  }, []);

  const onFeedback = useCallback((row: Row) => {
    DisposeAudioFeedback();
    setFeedback(row);
    setPhase('feedback');
  }, []);

  function Resume() {
    if (document.hidden) return;
    restoreStopFocus.current = true;
    PrepareAudioFeedback();
    if (!demo && !document.fullscreenElement) void root.current?.requestFullscreen?.().catch(() => undefined);
    runRound(rows.length, attempt?.falseStarts);
  }

  function Continue() {
    if (demo) {
      setPhase('confirm');
      return;
    }
    if (!feedback) return;
    const completed = [...rows, feedback];
    setRows(completed);
    if (completed.length < 6) {
      PrepareAudioFeedback();
      runRound(completed.length);
      return;
    }

    const { config, score } = BuildGameScore(settings, completed);
    jsPsychLifecycleRef.current?.finish({ ...score.summary });
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setSaveState('saving');
    setPhase('results');
    SendGameResult(config, score.summary, score.rounds);
  }

  const label = (value: string | number) => typeof value === 'number' ? value + ' km/h' : t[value as CopyKey];
  const summaryItems = Object.entries(settings).map(([key, value]) => ({ label: t[key as CopyKey], value: label(value) }));
  const leaveLabel = IsHubGame() ? t.lobby : t.standaloneExit;

  function SettingSelect(key: keyof Settings) {
    const values = options[key];
    return <label>{t[key]}<select id={key} name={key} value={settings[key]} onChange={event => {
      const selected = values.find(value => String(value) === event.target.value);
      if (selected !== undefined) setSettings(previous => ({ ...previous, [key]: selected }));
    }}>
      {values.map(value => <option key={value} value={value}>{label(value)}</option>)}
    </select></label>;
  }

  return <main id="game" ref={root} className={(phase === 'running' || phase === 'paused') ? 'drive-screen brake-reaction-phase-playing' : `brake-reaction-phase-${phase}`}
    onKeyDown={event => {
      if (event.key === 'Escape' && !event.repeat && (phase === 'running' || phase === 'paused')) {
        event.preventDefault();
        if (phase === 'paused') Resume();
        else onPause();
      }
    }}>
    <div className="jspsych-trial" ref={jsPsychDisplay} aria-hidden="true" />
    {phase === 'menu' && <>
      <div className="brake-preview" aria-hidden="true">
        <div className="brake-preview-sky" />
        <div className="brake-preview-road"><span className="brake-preview-divider" /></div>
        <div className="brake-preview-lead"><span className="brake-preview-car-window" /></div>
        <div className="brake-preview-own"><span className="brake-preview-car-window" /></div>
      </div>
      <dialog className="game-settings-dialog brake-reaction-phase-menu" ref={settingsDialog} aria-labelledby="title" onCancel={event => {
        event.preventDefault();
        Exit();
      }}>
        <form className="training-config" ref={formRef} aria-labelledby="title" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
          onKeyDown={event => { if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); confirmSettings(); } }}>
          <header className="training-config-header"><h2 id="title" tabIndex={-1}>{t.title}</h2></header>
          <div className="training-config-body">
            <section className="training-setting"><h3>{t.settings}</h3>
              <p>{t.settingsDescription}</p>
              {SettingSelect('traffic')}
              {SettingSelect('scenario')}
              {SettingSelect('speedKmh')}
              {SettingSelect('road')}
            </section>
            <section className="training-setting"><h3>{t.vehicles}</h3>
              <p>{t.vehiclesDescription}</p>
              {SettingSelect('leadType')}
              {SettingSelect('ownType')}
            </section>
          </div>
          <footer className="config-actions">
            <div className="training-config-navigation-buttons">
              <button className="btn btn-ghost" type="button" onClick={Exit}>{leaveLabel}</button>
              <button className="btn btn-primary" type="button" onClick={confirmSettings} disabled={!ready}>{t.confirmSettings}</button>
            </div>
          </footer>
        </form>
      </dialog>
    </>}
    {(phase === 'rules' || phase === 'confirm') && <BrakeReactionTutorial title={phase === 'rules' ? t.tutorial : t.confirmation}
      ready={phase === 'confirm'} summaryItems={summaryItems} drawPreview={drawPreview}
      onContinue={() => setPhase('confirm')} onDemo={() => Start(true)} onStart={() => Start(false)} onBack={() => setPhase('menu')} />}
    {(phase === 'running' || phase === 'paused') && attempt && <RunningView key={attempt.round.messageSeed} round={attempt.round} settings={settings} scenario={attempt.round.scenario}
      index={rows.length} demo={demo} paused={phase === 'paused'} falseStarts={attempt.falseStarts} note={attempt.note} lastBrakeInput={lastBrakeInput}
      onFalseStart={onFalseStart} onFeedback={onFeedback} onPause={onPause} stopControl={<button className="btn btn-ghost" id="stop" ref={stopRef} onClick={onPause}>{en ? 'Stop' : '停止'}</button>}
      sound={sound} onSound={setSound} />}
    {(phase === 'paused' || phase === 'feedback') && <section className={phase === 'paused' ? 'training-panel game-interrupt-panel' : 'training-panel'} role="dialog" aria-modal="true" aria-labelledby="title"
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const buttons = event.currentTarget.querySelectorAll('button');
        const opposite = event.shiftKey ? buttons[1] : buttons[0];
        const edge = event.shiftKey ? buttons[0] : buttons[1];
        if (document.activeElement === edge) {
          event.preventDefault();
          opposite.focus();
        }
      }}>
      <header className="training-config-header"><h2 id="title" tabIndex={-1}>{phase === 'paused' ? (en ? 'Paused' : '已暫停') : t.feedback}</h2></header>
      <div className="training-config-body">
        {phase === 'paused' ? <p>{t.interrupted} {en ? 'Ending now discards this record.' : '現在結束就不會保存這次紀錄。'}</p> : feedback && <RoundStats row={feedback} copy={t} />}
      </div>
      <footer className="config-actions">
        <button className="btn btn-ghost" onClick={demo ? () => setPhase('rules') : Exit}>{demo ? t.tutorial : en ? 'End activity' : '結束活動'}</button>
        {phase === 'paused' ?
          <button className="btn btn-primary" id="resume" ref={resumeRef} onClick={Resume}>{en ? 'Continue' : '繼續'}</button> :
          <button className="btn btn-primary" id="continue" onClick={Continue}>{demo ? t.skipDemo : rows.length === 5 ? t.review : t.next}</button>}
      </footer>
    </section>}
    {phase === 'results' && <section className="experiment-results" aria-labelledby="title">
      <header className="score-header training-config-header"><h1 id="title" tabIndex={-1}>{en ? 'Session results' : '當次成果'}</h1><p>{t.title}</p></header>
      <div className="training-config-body">
        <section className="score-priority"><p className="score-complete">{en ? 'Practice complete' : '已完成練習'}</p>
          <SessionMetrics settings={settings} rows={rows} copy={t} />
        </section>
        <p className="score-save-status" role="status">{IsHubGame() ? t[saveState] : t.localRecord}</p>
        <div className="score-actions">
          {IsHubGame() && saveState === 'error' && <button className="btn btn-ghost score-retry-button" onClick={() => {
            setSaveState('saving');
            RetryGameSave();
          }}>{t.retry}</button>}
          <button className="btn btn-primary score-return-button" onClick={Exit}>{leaveLabel}</button>
        </div>
        <details className="score-details">
          <summary>{en ? 'View details' : '查看詳細資料'}</summary>
          <section className="score-context" aria-label={t.statistics}>
            <SessionSummary settings={settings} rows={rows} copy={t} summaryItems={summaryItems} />
          </section>
          <ScoreAnalysis language={lang} rounds={BuildGameScore(settings, rows).score.rounds} />
        </details>
      </div>
    </section>}
  </main>;
}
