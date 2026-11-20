import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { axisKeys, defaultSettings, EnabledAxes, listSettings, rangeSettings, ValidateSettings, type RangeKey, type UfovSettings } from './settings';
import { BuildGameScore } from './score';
import { BuildResultFiles, type ResultFile } from './resultFiles';
import { ScoreAnalysis } from './ScoreAnalysis';
import { UfovTutorial } from './rules/UfovTutorial';
import { directionArrows, DirectionName, DirectionQuestion, StimulusFeedback, VehicleQuestion } from './AnswerPad';
import { SummarizeUfovSession, type UfovSession, type Vehicle } from './logic/ufovSummary';
import { UfovRun, type UfovPrompt } from './logic/ufovRun';
import { ufovTiming } from './logic/staircase';
import { CalculatePeripheralAttentionScreenGeometry } from './runtime/peripheralAttentionCanvas';
import { DetectDisplayDeviceKind } from './runtime/displayTiming';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayGameEndSound, PlayMidiMusic, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import {
  CanDownloadResultFiles, ExitGame, IsHubGame, OnSavedSettings, RequestResultDownload, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult,
} from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

type Phase = 'menu' | 'rules' | 'running' | 'results';
type Activity = 1 | 2 | 3;
type ListKey = typeof listSettings[number]['key'];

const compassCells = [7, 0, 1, 6, null, 2, 5, 4, 3];

const fileLabels = {
  'trials.csv': { zh: '逐題紀錄（CSV）', en: 'Trial log (CSV)' },
  'summary.csv': { zh: '統計摘要（CSV）', en: 'Summary (CSV)' },
  'trajectory.json': { zh: '滑鼠軌跡（JSON）', en: 'Mouse paths (JSON)' },
};

export function UfovGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  const [paused, setPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState<'user' | 'display' | 'fullscreen'>('user');
  const pausedRef = useRef(false);
  const endingRef = useRef(false);
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
  const [settings, setSettings] = useState<UfovSettings>({ ...defaultSettings });
  const [session, setSession] = useState<UfovSession | null>(null);
  const [files, setFiles] = useState<ResultFile[]>([]);
  const [prompt, setPrompt] = useState<UfovPrompt>({ kind: 'watch' });
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  // Phones and tablets cannot keep the outer ring at a known visual angle, so they run activity 1 only, as before.
  const [handheld] = useState(() => ['phone', 'tablet'].includes(DetectDisplayDeviceKind()));
  const activity = (handheld ? 1 : settings.subtestId) as Activity;
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLParagraphElement>(null);
  // Each answer belongs to the question it was asked for, so a late tap on an old button cannot answer the next one.
  const answerRef = useRef<{ kind: UfovPrompt['kind']; answer: (value?: number | Vehicle) => void } | null>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const runRef = useRef<UfovRun | null>(null);
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
    runRef.current?.stop();
    runRef.current = null;
    answerRef.current = null;
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
  }, []);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const pause = useCallback(() => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    setPauseReason('user');
    answerRef.current = null;
    runRef.current?.pause();
    StopMidiMusic();
    setPaused(true);
  }, []);
  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    restoreStopRef.current = true;
    const pending = answerRef.current;
    if (pending?.kind === 'pause') { answerRef.current = null; pending.answer(); }
    runRef.current?.resume();
    setPaused(false);
  }, []);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setSession(null); setFiles([]); setPhase('menu'); };
    const fullscreenChanged = () => { if (phaseRef.current === 'running' && !endingRef.current && !document.fullscreenElement) { pause(); setPauseReason('fullscreen'); } };
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
  useEffect(() => {
    const host = hostRef.current;
    const jsPsychHost = jsPsychHostRef.current;
    if (phase !== 'running' || !host || !jsPsychHost) return;
    const jsPsych = initJsPsych({ display_element: jsPsychHost });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    const practice = settings.mode === 'practice';
    const fixed = settings.stopCondition === 'fixed_trials';
    const finish = (completed: UfovSession) => {
      endingRef.current = true;
      runRef.current = null;
      answerRef.current = null;
      const score = BuildGameScore(completed);
      const resultFiles = BuildResultFiles(completed, new Date());
      jsPsychLifecycleRef.current?.finish({ trials: score.summary.trials, correct: score.summary.correct, threshold_ms: score.summary.thresholdMs });
      PlayGameEndSound('Victory');
      setSession(completed);
      setFiles(resultFiles);
      setSaveState(IsHubGame() ? 'saving' : 'local');
      SendGameResult({ ...settings, subtestUsed: activity }, score.summary, score.rounds, resultFiles);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      setPhase('results');
    };
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:ufov', onStart: () => {
      const run = new UfovRun({
        subtestId: activity,
        mode: practice ? 'practice' : 'formal',
        stopCondition: settings.stopCondition,
        trialCount: settings.trialCount,
        targetAxes: EnabledAxes(settings),
        contrastPercent: settings.contrastPercent,
        targetVisualAngleDeg: settings.targetVisualAngleDeg,
        vehicleVisualAngleDeg: settings.vehicleVisualAngleDeg,
        screenWidthCm: settings.screenWidthCm,
        screenHeightCm: settings.screenHeightCm,
        viewingDistanceCm: settings.viewingDistanceCm,
        geometry: CalculatePeripheralAttentionScreenGeometry(settings.screenWidthCm, settings.screenHeightCm, settings.viewingDistanceCm,
          settings.targetVisualAngleDeg, settings.vehicleVisualAngleDeg),
      }, {
        host,
        label: title,
        prompt: (next, answer) => {
          answerRef.current = answer ? { kind: next.kind, answer } : null;
          setPrompt(next);
          if (next.kind === 'pause') { pausedRef.current = true; setPauseReason('display'); StopMidiMusic(); setPaused(true); }
        },
        progress: (trial, practiceTrial) => {
          if (!progressRef.current) return;
          const english = enRef.current;
          progressRef.current.textContent = practiceTrial
            ? english ? `Practice trial ${trial} of ${ufovTiming.practiceTrials}` : `練習第 ${trial} 題，共 ${ufovTiming.practiceTrials} 題`
            : fixed ? english ? `Trial ${trial} of ${settings.trialCount}` : `第 ${trial} 題，共 ${settings.trialCount} 題`
              : english ? `Trial ${trial} (up to ${ufovTiming.adaptiveMaxTrials})` : `第 ${trial} 題（最多 ${ufovTiming.adaptiveMaxTrials} 題）`;
        },
      }, finish);
      runRef.current = run;
      if (pausedRef.current && answerRef.current?.kind !== 'pause') run.pause();
      void run.start().catch(error => console.error('The UFOV run stopped unexpectedly.', error));
    } });
    return () => {
      runRef.current?.stop();
      runRef.current = null;
      answerRef.current = null;
      lifecycle.dispose();
      if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null;
    };
    // The title only labels the canvas; a language change must not restart a running session.
  }, [activity, phase, settings]);

  const confirmSettings = () => {
    if (!formRef.current?.reportValidity() || !ValidateSettings(settings)) return;
    SaveGameSettings(settings);
    setPhase('rules');
  };
  const startTraining = async () => {
    if (phaseRef.current !== 'rules' || !ValidateSettings(settings)) return;
    endingRef.current = false;
    const generation = generationRef.current;
    PrepareAudioFeedback();
    try { await rootRef.current?.requestFullscreen?.(); } catch { /* Windowed play remains available. */ }
    if (generation !== generationRef.current || phaseRef.current !== 'rules') {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      return;
    }
    setPrompt({ kind: 'watch' });
    SendGameEvent('active');
    setPhase('running');
  };
  const answerFor = (kind: UfovPrompt['kind']) => (value?: number | Vehicle) => {
    const pending = answerRef.current;
    if (pausedRef.current || pending?.kind !== kind) return;
    answerRef.current = null;
    pending.answer(value);
  };

  const listField = (key: ListKey) => listSettings.find(field => field.key === key)!;
  const optionLabel = (key: ListKey, value: number | string) => {
    const option = listField(key).options.find(item => item.value === value);
    return option ? option[lang] : '';
  };
  const range = (key: RangeKey) => rangeSettings.find(field => field.key === key)!;
  const unit = (key: RangeKey) => {
    const text: string = en ? range(key).unitEn : range(key).unitZh;
    return !text ? '' : text === '°' || text === '%' ? text : ` ${text}`;
  };
  const measure = (key: RangeKey) => `${unit(key) === '°' ? settings[key].toFixed(1) : settings[key]}${unit(key)}`;
  const formal = settings.mode === 'formal';
  const fixed = settings.stopCondition === 'fixed_trials';
  const enabledAxes = EnabledAxes(settings);
  const allDirections = enabledAxes.length === axisKeys.length;
  const directionCount = `${enabledAxes.length}/${axisKeys.length}`;
  const modeLabel = optionLabel('mode', settings.mode);
  const activityLabel = optionLabel('subtestId', activity);
  const endLabel = !formal ? (en ? `${ufovTiming.practiceTrials} practice trials` : `${ufovTiming.practiceTrials} 題練習`)
    : fixed ? (en ? `${settings.trialCount} trials` : `${settings.trialCount} 題`) : (en ? 'When display time settles' : '呈現時間穩定後');
  const toggleDirections = () => setSettings(current => {
    const useCardinals = EnabledAxes(current).length === axisKeys.length;
    return { ...current, ...Object.fromEntries(axisKeys.map((key, axis) => [key, !useCardinals || axis % 2 === 0])) };
  });
  const geometry = CalculatePeripheralAttentionScreenGeometry(settings.screenWidthCm, settings.screenHeightCm, settings.viewingDistanceCm,
    settings.targetVisualAngleDeg, settings.vehicleVisualAngleDeg);
  const summaryItems = [
    { label: en ? 'Activity' : '活動項目', value: activityLabel + (handheld && settings.subtestId !== 1 ? (en ? ' (phones and tablets run processing speed)' : '（手機與平板只提供處理速度）') : '') },
    { label: en ? 'Mode' : '活動模式', value: modeLabel },
    ...(formal ? [{ label: en ? 'When the session ends' : '結束方式', value: fixed ? (en ? `After ${settings.trialCount} trials` : `完成 ${settings.trialCount} 題後`) : optionLabel('stopCondition', settings.stopCondition) }]
      : [{ label: en ? 'Trials' : '題數', value: en ? `${ufovTiming.practiceTrials} at ${ufovTiming.practiceDurationMs} ms` : `${ufovTiming.practiceTrials} 題，每題 ${ufovTiming.practiceDurationMs} 毫秒` }]),
    { label: en ? 'Contrast' : '刺激對比度', value: measure('contrastPercent') },
    { label: en ? 'Outer ring distance' : '外圈距離', value: measure('targetVisualAngleDeg') },
    { label: en ? 'Vehicle size' : '車輛大小', value: measure('vehicleVisualAngleDeg') },
    { label: en ? 'Display and distance' : '螢幕與距離', value: en ? `${settings.screenWidthCm} × ${settings.screenHeightCm} cm, ${settings.viewingDistanceCm} cm away`
      : `${settings.screenWidthCm} × ${settings.screenHeightCm} cm，距離 ${settings.viewingDistanceCm} cm` },
    ...(activity === 1 ? [] : [{ label: en ? 'Outer directions' : '外圈方向', value: allDirections ? (en ? 'All 8' : '全部 8 個')
      : enabledAxes.map(axis => DirectionName(lang, axis)).join(en ? ', ' : '、') }]),
  ];
  const rangeInput = (key: RangeKey, scale: readonly string[], disabled = false) => {
    const field = range(key);
    return <label className="ufov-slider-card" htmlFor={`ufov-${key}`}>
      <span className="ufov-slider-heading"><span id={`ufov-${key}-label`}>{field[lang]}</span>
        {key === 'contrastPercent' && <span className="ufov-contrast-swatch" aria-hidden="true"
          style={{ backgroundColor: `color-mix(in srgb, var(--ufov-field) ${settings.contrastPercent}%, var(--ufov-stimulus))` }} />}
        <span className="ufov-value" aria-hidden="true">{measure(key)}</span></span>
      <input id={`ufov-${key}`} aria-labelledby={`ufov-${key}-label`} aria-valuetext={measure(key)}
        name={key} type="range" min={field.min} max={field.max} step={field.step} value={settings[key]} disabled={disabled}
        onChange={event => setSettings({ ...settings, [key]: Number(event.target.value) })} />
      <span className="ufov-slider-scale" aria-hidden="true">{scale.map(value => <span key={value}>{value}</span>)}</span>
    </label>;
  };
  const numberInput = (key: RangeKey) => {
    const field = range(key);
    return <label className="ufov-number-field">{field[lang]} ({field.unitEn})
      <input name={key} type="number" required inputMode="decimal" min={field.min} max={field.max} step={field.step}
        value={Number.isNaN(settings[key]) ? '' : settings[key]}
        onChange={event => setSettings({ ...settings, [key]: event.target.value === '' ? Number.NaN : Number(event.target.value) })} />
    </label>;
  };
  const listInput = (key: ListKey) => {
    const value = key === 'subtestId' ? activity : settings[key];
    return <fieldset className={`ufov-option-grid ufov-options-${key}`} aria-labelledby={`ufov-${key}-heading`}>
      {listField(key).options.map(option => {
        const disabled = key === 'subtestId' ? handheld && option.value !== 1 : key === 'stopCondition' && !formal;
        return <label key={option.value} className="ufov-option">
          <input type="radio" name={key} value={option.value} checked={option.value === value} disabled={disabled}
            aria-labelledby={`ufov-${option.value}-label`} aria-describedby={`ufov-${option.value}-description`}
            onChange={() => setSettings(current => ({ ...current, [key]: option.value }))} />
          <span id={`ufov-${option.value}-label`}>{option[lang]}</span>
          <span className="ufov-option-meta" id={`ufov-${option.value}-description`}>{en ? option.hintEn : option.hintZh}</span>
        </label>;
      })}
    </fieldset>;
  };

  const score = session ? BuildGameScore(session) : null;
  const totals = session ? SummarizeUfovSession(session) : null;
  const missing = en ? 'N/A' : '無';
  const geometryReadout = (value: number, digits: number, suffix: string) => Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : missing;
  // One frame lasts about 17 ms, so whole milliseconds are as precise as the display; saved rows keep the exact values.
  const ms = (value: number | null) => value === null ? missing : `${Math.round(value)} ms`;
  const percent = (value: number | null) => value === null ? missing : `${value}%`;
  return <div ref={rootRef} className="ufov-game-root">
    <div ref={jsPsychHostRef} className="ufov-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <UfovTutorial active={phase === 'rules'} ready title={title}
      settings={{ ...settings, subtestId: activity }} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog ufov-phase-menu" aria-labelledby="ufov-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="ufov-settings-title">{en ? 'Peripheral Visual Field Training Settings' : '周邊視野訓練設定'}</h2>
          <div className="config-summary">
            <span>{en ? 'Activity' : '活動'} · {activityLabel}</span>
            <span>{en ? 'Contrast' : '對比度'} {measure('contrastPercent')}</span>
            <span>{en ? 'Outer ring' : '外圈'} {measure('targetVisualAngleDeg')}</span>
            <span>{en ? 'Vehicle' : '車輛'} {measure('vehicleVisualAngleDeg')}</span>
            <span>{directionCount} {en ? 'directions' : '方向'}</span>
            <span>{en ? 'End' : '結束方式'} · {endLabel}</span>
          </div>
        </header>
        <div className="training-config-body">
          <section className="training-setting" data-wide>
            <header className="training-setting-header"><div className="ufov-setting-title">
              <h3 id="ufov-subtestId-heading">{listField('subtestId')[lang]}</h3>
              <p>{en ? 'Choose what to look for during the flash.' : '選擇車輛閃過時要留意的內容。'}</p>
            </div><span>{activityLabel}</span></header>
            {listInput('subtestId')}
            {handheld && <p className="ufov-handheld-note">{en ? 'Phones and tablets run activity 1 only. Use a computer for activities 2 and 3.' : '手機與平板只提供活動 1，活動 2、3 請改用電腦。'}</p>}
          </section>
          <section className="training-setting" data-wide>
            <header className="training-setting-header"><div className="ufov-setting-title">
              <h3>{en ? 'Display size and viewing distance' : '螢幕尺寸與觀看距離'}</h3>
              <p>{en ? 'Measure the visible area and the distance from your eyes to the screen.' : '請量出螢幕可顯示的寬高，以及眼睛到螢幕的距離。'}</p>
            </div><span>{geometryReadout(settings.viewingDistanceCm, 0, ' cm')}</span></header>
            <div className="ufov-number-row">
              {numberInput('screenWidthCm')}
              {numberInput('screenHeightCm')}
              {numberInput('viewingDistanceCm')}
            </div>
            <dl className="ufov-geometry-info">
              <div className="ufov-geometry-stat"><dt>{en ? 'Pixel density' : '像素密度'}</dt><dd>{geometryReadout(geometry.pixelsPerCm, 0, ' PPCM')}</dd></div>
              <div className="ufov-geometry-stat"><dt>{en ? 'Largest on-screen angle' : '螢幕可呈現的最大視角'}</dt><dd>{geometryReadout(geometry.maxVisualAngleDeg, 1, '°')}</dd></div>
              <div className="ufov-geometry-stat"><dt>{en ? 'Vehicle width' : '車輛寬度'}</dt><dd>{geometryReadout(geometry.vehicleWidthPx, 0, ' px')}</dd></div>
            </dl>
            {geometry.isOverLimit && geometry.suggestedDistanceCm !== undefined && <p className="ufov-geometry-note" role="status">{en
              ? `The outer ring angle exceeds the screen. Move closer than ${geometry.suggestedDistanceCm.toFixed(1)} cm or choose a smaller angle.`
              : `外圈視角超出螢幕。請將觀看距離縮短至 ${geometry.suggestedDistanceCm.toFixed(1)} cm 以下，或調小外圈視角。`}</p>}
          </section>
          <section className="training-setting">
            <header className="training-setting-header"><div className="ufov-setting-title">
              <h3>{en ? 'Outer ring distance and vehicle size' : '外圈距離與車輛大小'}</h3>
              <p>{en ? 'Set both in degrees of visual angle.' : '以視角設定外圈距離與車輛大小。'}</p>
            </div><span>{measure('targetVisualAngleDeg')} / {measure('vehicleVisualAngleDeg')}</span></header>
            {rangeInput('targetVisualAngleDeg', ['5.0°', '20.0°', '35.0°'])}
            {rangeInput('vehicleVisualAngleDeg', ['0.8°', '2.5°', '5.0°'])}
          </section>
          <section className="training-setting">
            <header className="training-setting-header"><div className="ufov-setting-title">
              <h3>{en ? 'Contrast' : '對比度'}</h3>
              <p>{en ? range('contrastPercent').hintEn : range('contrastPercent').hintZh}</p>
            </div><span>{measure('contrastPercent')}</span></header>
            {rangeInput('contrastPercent', ['5%', '50%', '100%'])}
          </section>
          <section className="training-setting" data-wide>
            <header className="training-setting-header"><div className="ufov-setting-title">
              <h3 id="ufov-compass-heading">{en ? 'Outer car directions' : '外圈汽車方向'}</h3>
              <p id="ufov-compass-hint">{en ? 'The outer car appears only in the selected directions. Processing speed has no outer car.' : '外圈汽車只會出現在勾選的方向。處理速度活動沒有外圈汽車。'}</p>
            </div><span>{directionCount}</span></header>
            <fieldset className="ufov-compass" aria-labelledby="ufov-compass-heading" aria-describedby="ufov-compass-hint">
              {compassCells.map(axis => {
                if (axis === null) return <button key="all" type="button" className="ufov-compass-toggle" aria-pressed={allDirections}
                  onClick={toggleDirections}>{en ? 'Select all' : '全選'}</button>;
                const key = axisKeys[axis];
                return <label key={key} className="ufov-option ufov-compass-direction">
                  <input type="checkbox" name={key} checked={settings[key]} disabled={settings[key] && enabledAxes.length === 1}
                    onChange={event => setSettings({ ...settings, [key]: event.target.checked })} />
                  <span className="ufov-compass-arrow" aria-hidden="true">{directionArrows[axis]}</span>{DirectionName(lang, axis)}
                </label>;
              })}
            </fieldset>
          </section>
          <section className="training-setting" data-wide>
            <header className="training-setting-header"><div className="ufov-setting-title">
              <h3>{en ? 'Session mode and ending' : '訓練流程與結束方式'}</h3>
              <p>{en ? 'Practice lasts five trials. In a recorded session, choose when to finish.' : '練習固定五題。正式紀錄可選擇結束方式。'}</p>
            </div><span>{modeLabel}</span></header>
            <div className="ufov-flow-columns">
              <div className="ufov-flow-group"><h4 id="ufov-mode-heading">{listField('mode')[lang]}</h4>{listInput('mode')}</div>
              <div className="ufov-flow-group"><h4 id="ufov-stopCondition-heading">{listField('stopCondition')[lang]}</h4>{listInput('stopCondition')}
                {fixed && rangeInput('trialCount', ['10', '125', '240'], !formal)}
              </div>
            </div>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <><main className="ufov-stage ufov-running" aria-label={title} inert={paused}>
      <header className="ufov-hud">
        <p ref={progressRef} className="ufov-progress ufov-visually-hidden" aria-live="off">{en ? 'Get ready' : '準備開始'}</p>
        <button ref={stopRef} type="button" className="btn btn-ghost ufov-stop" onClick={pause}>{en ? 'Stop' : '停止'}</button>
      </header>
      <div ref={hostRef} className="ufov-canvas-host" style={{ visibility: paused ? 'hidden' : 'visible' }} />
      {prompt.kind !== 'watch' && prompt.kind !== 'pause' && <section className="ufov-answer" aria-label={en ? 'Your answer' : '作答'}>
        {prompt.kind === 'vehicle' && <VehicleQuestion lang={lang} onChoose={answerFor('vehicle')} />}
        {prompt.kind === 'direction' && <DirectionQuestion lang={lang} onChoose={answerFor('direction')} />}
        {prompt.kind === 'feedback' && <StimulusFeedback lang={lang} correct={prompt.correct} />}
        {prompt.kind === 'retry' && <p className="ufov-sync-note" role="status">{en ? 'The display skipped a frame, so this trial is not counted. Showing it again.' : '畫面更新不穩定，這一題不計分，馬上重新出題。'}</p>}
      </section>}
    </main>{paused && <div className="game-interrupt-overlay"><div className="game-interrupt-panel" role="dialog" aria-modal="true" aria-labelledby="ufov-pause-title"
      onKeyDown={event => { if (event.key === 'Tab') { const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button'); if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[1].focus(); } else if (!event.shiftKey && document.activeElement === buttons[1]) { event.preventDefault(); buttons[0].focus(); } } }}>
      <h2 id="ufov-pause-title">{en ? 'Paused' : '已暫停'}</h2>
      <p>{en ? 'Ending the activity will not save this session.' : '結束後不會保存這次紀錄。'}</p>
      {pauseReason === 'display' && <p>{en ? 'Recent trials were not counted because the display timing was unstable. Keep this page in front before continuing.' : '最近幾題因畫面更新不穩定而不計分。請讓這個頁面保持在最前方，再繼續。'}</p>}
      {pauseReason === 'fullscreen' && <p>{en ? 'Fullscreen ended.' : '已退出全螢幕。'}</p>}
      <button ref={continueRef} className="btn btn-primary" type="button" onClick={resume}>{en ? 'Continue' : '繼續'}</button>
      <button className="btn btn-ghost" type="button" onClick={exit}>{en ? 'End activity' : '結束活動'}</button>
    </div></div>}</>}
    {phase === 'results' && session && score && totals && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1 ref={resultHeadingRef} tabIndex={-1}>{en ? 'Session results' : '當次成果'}</h1><p>{title} · {optionLabel('subtestId', session.subtest_id)}</p></header>
      <section className="score-priority"><p className="score-complete">{en ? 'Activity complete' : '已完成本次活動'}</p><div className="score-key-grid">
        {session.mode === 'formal' ? <>
          <div className="score-key-metric"><p>{en ? 'Display time threshold' : '呈現時間門檻'}</p><strong>{ms(score.summary.thresholdMs)}</strong></div>
          <div className="score-key-metric"><p>{en ? 'Shortest display time answered correctly' : '答對時最短的呈現時間'}</p><strong>{ms(score.summary.bestMs)}</strong></div>
        </> : <div className="score-key-metric"><p>{en ? 'Display time per trial' : '每題呈現時間'}</p><strong>{ms(score.summary.thresholdMs)}</strong></div>}
        <div className="score-key-metric"><p>{en ? 'Correct trials' : '答對題數'}</p><strong>{score.summary.correct} / {score.summary.trials}</strong></div>
      </div>
        <p className="score-note">{session.mode === 'formal'
          ? en ? 'Display time is how long the vehicles stayed on screen, not how long you took to answer. The threshold is where it settled as right and wrong answers alternated.'
            : '呈現時間是車輛停在畫面上的時間，不是作答時間。門檻是答對與答錯交替後收斂的呈現時間。'
          : en ? 'Practice uses a fixed display time. Choose the recorded session to let the display time adjust.' : '練習模式的呈現時間固定。選擇正式模式，呈現時間才會依作答調整。'}</p>
        {session.aborted && <p className="score-note">{en ? 'The session stopped early. Only the finished trials are listed.' : '這次活動中途停止，只列出已完成的題目。'}</p>}
      </section>
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      <div className="score-actions">
        {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
        <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
      </div>
      <details className="score-details"><summary>{en ? 'View details' : '查看詳細資料'}</summary>
      {session.subtest_id !== 1 && <section className="score-directions"><h2>{en ? 'By direction' : '各方向的結果'}</h2>
        <div className="results-scroll" role="region" aria-label={en ? 'Results by direction' : '各方向的結果'} tabIndex={0}>
          <table className="results-table ufov-direction-table">
            <thead><tr><th scope="col">{en ? 'Direction' : '方向'}</th><th scope="col">{en ? 'Shown' : '出現次數'}</th><th scope="col">{en ? 'Correct' : '答對'}</th>
              <th scope="col">{en ? 'Share correct' : '答對比例'}</th><th scope="col">{en ? 'Mean answer time' : '平均作答時間'}</th><th scope="col">{en ? 'Mean display time' : '平均呈現時間'}</th></tr></thead>
            <tbody>{totals.directions.map(direction => <tr key={direction.axis}>
              <th scope="row">{DirectionName(lang, direction.axis)}</th><td>{direction.trials}</td><td>{direction.correct}</td>
              <td>{percent(direction.accuracyPercent)}</td><td>{ms(direction.meanResponseMs)}</td><td>{ms(direction.meanExposureMs)}</td></tr>)}</tbody>
          </table>
        </div></section>}
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Central vehicle correct' : '中央車輛答對比例'}</dt><dd>{percent(totals.centralAccuracyPercent)}</dd></div>
        {session.subtest_id !== 1 && <div className="score-context-item"><dt>{en ? 'Outer direction correct' : '外圈方向答對比例'}</dt><dd>{percent(totals.peripheralAccuracyPercent)}</dd></div>}
        <div className="score-context-item"><dt>{en ? 'Mean answer time' : '平均作答時間'}</dt><dd>{ms(totals.meanResponseMs)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Display refresh' : '畫面更新率'}</dt><dd>{Math.round(session.refresh_hz)} Hz</dd></div>
        <div className="score-context-item"><dt>{en ? 'Trials not counted for display timing' : '因畫面更新不穩定而不計分'}</dt><dd>{session.invalid_timing_attempt_count}</dd></div>
      </dl></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      {CanDownloadResultFiles() && files.length > 0 && <section className="score-downloads"><h2>{en ? 'Download this session' : '下載當次紀錄'}</h2>
        <p>{en ? 'The files hold this session only, with no name or account.' : '檔案只含這次的紀錄，不含姓名或帳號。'}</p>
        <div className="score-download-buttons">{files.map(file => {
          const kind = file.fileName.replace(/^ufov-\d{8}-\d{6}-/, '') as keyof typeof fileLabels;
          return <button key={file.fileName} className="btn btn-ghost" type="button" onClick={() => RequestResultDownload(file.fileName)}>{fileLabels[kind]?.[lang] ?? file.fileName}</button>;
        })}</div></section>}
      </details>
    </section></div>}
  </div>;
}
