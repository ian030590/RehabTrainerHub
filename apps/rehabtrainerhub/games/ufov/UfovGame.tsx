import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { axisKeys, defaultSettings, EnabledAxes, listSettings, rangeSettings, ValidateSettings, type RangeKey, type UfovSettings } from './settings';
import { BuildGameScore } from './score';
import { BuildResultFiles, type ResultFile } from './resultFiles';
import { ScoreAnalysis } from './ScoreAnalysis';
import { UfovTutorial } from './rules/UfovTutorial';
import { DirectionName, DirectionPad, VehicleChoices } from './AnswerPad';
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
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
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
    generationRef.current++;
    runRef.current?.stop();
    runRef.current = null;
    answerRef.current = null;
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
  }, []);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setSession(null); setFiles([]); setPhase('menu'); };
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
        prompt: (next, answer) => { answerRef.current = answer ? { kind: next.kind, answer } : null; setPrompt(next); },
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
    if (pending?.kind !== kind) return;
    answerRef.current = null;
    pending.answer(value);
  };

  const listField = (key: 'subtestId' | 'mode' | 'stopCondition') => listSettings.find(field => field.key === key)!;
  const optionOf = (key: 'subtestId' | 'mode' | 'stopCondition', value: number | string) =>
    (listField(key).options as readonly { value: number | string; zh: string; en: string; hintZh: string; hintEn: string }[]).find(option => option.value === value);
  const optionLabel = (key: 'subtestId' | 'mode' | 'stopCondition', value: number | string) => { const option = optionOf(key, value); return option ? (en ? option.en : option.zh) : ''; };
  const range = (key: RangeKey) => rangeSettings.find(field => field.key === key)!;
  const unit = (key: RangeKey) => {
    const text: string = en ? range(key).unitEn : range(key).unitZh;
    return !text ? '' : text === '°' || text === '%' ? text : ` ${text}`;
  };
  const measure = (key: RangeKey) => `${settings[key]}${unit(key)}`;
  const formal = settings.mode === 'formal';
  const fixed = settings.stopCondition === 'fixed_trials';
  const enabledAxes = EnabledAxes(settings);
  const geometry = CalculatePeripheralAttentionScreenGeometry(settings.screenWidthCm, settings.screenHeightCm, settings.viewingDistanceCm,
    settings.targetVisualAngleDeg, settings.vehicleVisualAngleDeg);
  const summaryItems = [
    { label: en ? 'Activity' : '活動項目', value: optionLabel('subtestId', activity) + (handheld && settings.subtestId !== 1 ? (en ? ' (phones and tablets run activity 1)' : '（手機與平板只提供活動 1）') : '') },
    { label: en ? 'Mode' : '活動模式', value: optionLabel('mode', settings.mode) },
    ...(formal ? [{ label: en ? 'When the session ends' : '結束方式', value: fixed ? (en ? `After ${settings.trialCount} trials` : `完成 ${settings.trialCount} 題後`) : optionLabel('stopCondition', settings.stopCondition) }]
      : [{ label: en ? 'Trials' : '題數', value: en ? `${ufovTiming.practiceTrials} at ${ufovTiming.practiceDurationMs} ms` : `${ufovTiming.practiceTrials} 題，每題 ${ufovTiming.practiceDurationMs} 毫秒` }]),
    { label: en ? 'Contrast' : '刺激對比度', value: measure('contrastPercent') },
    { label: en ? 'Outer ring distance' : '外圈距離', value: measure('targetVisualAngleDeg') },
    { label: en ? 'Vehicle size' : '車輛大小', value: measure('vehicleVisualAngleDeg') },
    { label: en ? 'Display and distance' : '螢幕與距離', value: en ? `${settings.screenWidthCm} × ${settings.screenHeightCm} cm, ${settings.viewingDistanceCm} cm away`
      : `${settings.screenWidthCm} × ${settings.screenHeightCm} cm，距離 ${settings.viewingDistanceCm} cm` },
    ...(activity === 1 ? [] : [{ label: en ? 'Outer directions' : '外圈方向', value: enabledAxes.length === 8 ? (en ? 'All 8' : '全部 8 個')
      : enabledAxes.map(axis => DirectionName(lang, axis)).join(en ? ', ' : '、') }]),
  ];
  const rangeInput = (key: RangeKey) => {
    const field = range(key);
    return <label key={key}>{en ? field.en : field.zh}：<output>{measure(key)}</output>
      <input name={key} type="range" min={field.min} max={field.max} step={field.step} value={settings[key]}
        onChange={event => setSettings({ ...settings, [key]: Number(event.target.value) })} />
      <small className="training-setting-description">{en ? field.hintEn : field.hintZh}</small></label>;
  };
  const numberInput = (key: RangeKey) => {
    const field = range(key);
    return <label key={key}>{en ? field.en : field.zh}（{en ? field.unitEn : field.unitZh}）
      <input name={key} type="number" required inputMode="decimal" min={field.min} max={field.max} step={field.step}
        value={Number.isNaN(settings[key]) ? '' : settings[key]}
        onChange={event => setSettings({ ...settings, [key]: event.target.value === '' ? Number.NaN : Number(event.target.value) })} />
      <small className="training-setting-description">{en ? field.hintEn : field.hintZh}</small></label>;
  };
  const listInput = (key: 'subtestId' | 'mode' | 'stopCondition') => {
    const field = listField(key);
    const options = field.options as readonly { value: number | string; zh: string; en: string; hintZh: string; hintEn: string }[];
    const selected = optionOf(key, settings[key]);
    return <label key={key}>{en ? field.en : field.zh}
      <select name={key} value={settings[key]}
        onChange={event => setSettings({ ...settings, [key]: key === 'subtestId' ? Number(event.target.value) : event.target.value })}>
        {options.map(option => <option key={option.value} value={option.value}>{en ? option.en : option.zh}</option>)}
      </select>
      {selected && <small className="training-setting-description">{en ? selected.hintEn : selected.hintZh}</small>}</label>;
  };

  const score = session ? BuildGameScore(session) : null;
  const totals = session ? SummarizeUfovSession(session) : null;
  const missing = en ? 'N/A' : '無';
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
        <header className="training-config-header"><h2 id="ufov-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            {listInput('subtestId')}
            {handheld && <p className="ufov-handheld-note">{en ? 'Phones and tablets run activity 1 only. Use a computer for activities 2 and 3.' : '手機與平板只提供活動 1，活動 2、3 請改用電腦。'}</p>}
            {listInput('mode')}
            {formal && listInput('stopCondition')}
            {formal && fixed && rangeInput('trialCount')}
          </section>
          <section className="training-setting"><h3>{en ? 'What you see' : '刺激外觀'}</h3>
            {rangeInput('contrastPercent')}
            {rangeInput('targetVisualAngleDeg')}
            {rangeInput('vehicleVisualAngleDeg')}
          </section>
          <section className="training-setting"><h3>{en ? 'Display and distance' : '螢幕與距離'}</h3>
            <p className="training-setting-description">{en ? 'Visual angles are converted to screen size from these three numbers.' : '視角會依這三個數字換算成畫面上的大小。'}</p>
            {numberInput('screenWidthCm')}
            {numberInput('screenHeightCm')}
            {numberInput('viewingDistanceCm')}
            {geometry.isOverLimit && <p className="ufov-geometry-note" role="status">{en
              ? `With this display and distance the outer ring reaches about ${geometry.maxVisualAngleDeg.toFixed(1)}°, so it is drawn just inside the screen edge.`
              : `以這個螢幕與距離，外圈最遠約 ${geometry.maxVisualAngleDeg.toFixed(1)}°，會畫在畫面邊緣內。`}</p>}
          </section>
          <section className="training-setting"><h3>{en ? 'Outer car directions' : '外圈汽車方向'}</h3>
            <fieldset className="ufov-axis-options">
              <legend>{en ? 'The outer car appears only in the checked directions. Activity 1 has no outer car.' : '外圈汽車只會出現在勾選的方向。活動 1 沒有外圈汽車。'}</legend>
              {axisKeys.map((key, axis) => <label key={key} className="ufov-axis-option">
                <input type="checkbox" name={key} checked={settings[key]} onChange={event => setSettings({ ...settings, [key]: event.target.checked })} />
                {DirectionName(lang, axis)}</label>)}
            </fieldset>
            {enabledAxes.length === 0 && <p className="ufov-axis-warning" role="alert">{en ? 'Check at least one direction.' : '請至少勾選一個方向。'}</p>}
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="ufov-stage ufov-running" aria-label={title}>
      <header className="ufov-hud">
        <p ref={progressRef} className="ufov-progress" aria-live="off">{en ? 'Get ready' : '準備開始'}</p>
        <button type="button" className="btn btn-ghost ufov-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <div ref={hostRef} className="ufov-canvas-host" />
      {prompt.kind !== 'watch' && <section className="ufov-answer" aria-label={en ? 'Your answer' : '作答'}>
        {prompt.kind === 'vehicle' && <><h2>{en ? 'Which vehicle was in the center?' : '中央是哪一種車？'}</h2>
          <VehicleChoices lang={lang} className="ufov-answer-choices" onChoose={answerFor('vehicle')} /></>}
        {prompt.kind === 'direction' && <><h2>{en ? 'Where was the outer car?' : '外圈汽車在哪個方向？'}</h2>
          <DirectionPad lang={lang} className="ufov-answer-directions" onChoose={answerFor('direction')} /></>}
        {prompt.kind === 'feedback' && <p className={`ufov-feedback ufov-feedback-${prompt.correct ? 'correct' : 'wrong'}`} role="status">
          <span aria-hidden="true">{prompt.correct ? '✓' : '×'}</span>{prompt.correct ? (en ? 'Correct' : '答對') : (en ? 'Not this time' : '答錯')}</p>}
        {prompt.kind === 'retry' && <p className="ufov-sync-note" role="status">{en ? 'The display skipped a frame, so this trial is not counted. Showing it again.' : '畫面更新不穩定，這一題不計分，馬上重新出題。'}</p>}
        {prompt.kind === 'pause' && <section className="ufov-sync-pause"><h2>{en ? 'Paused to check the display' : '暫停，重新檢查畫面'}</h2>
          <p>{en ? 'The last few trials were not counted because the display did not keep time. Keep this page in front, then continue.' : '最近幾題因畫面更新不穩定而不計分。請讓這個頁面保持在最前方，準備好再繼續。'}</p>
          <button type="button" className="btn btn-primary" onClick={() => answerFor('pause')()}>{en ? 'Check and continue' : '重新檢查並繼續'}</button></section>}
      </section>}
    </main>}
    {phase === 'results' && session && score && totals && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title} · {optionLabel('subtestId', session.subtest_id)}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
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
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}
