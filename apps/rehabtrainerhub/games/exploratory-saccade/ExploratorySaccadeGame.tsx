import { useCallback, useEffect, useRef, useState } from 'react';
import { initJsPsych } from 'jspsych';
import { useT } from './i18n/useT';
import { defaultSettings, numericSettings, SymbolPx, ValidateSettings, ViewingDistanceCm, type SaccadeSettings } from './settings';
import { GenerateScreen } from './logic/screens';
import { browserClock, ScreenRun, type ScreenRecord, type ScreenState } from './logic/screenRun';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';
import { DisposeAudioFeedback, PlayGameEndSound, PlayMidiMusic, PlaySuccessSound, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExploratorySaccadeTutorial } from './rules/ExploratorySaccadeTutorial';
import { RunningView } from './RunningView';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';

type Phase = 'menu' | 'rules' | 'running' | 'results';
const emptyState: ScreenState = { phase: 'ready', screen: null, found: [], missed: [] };

export function ExploratorySaccadeGame() {
  const { lang, t } = useT(), en = lang === 'en', title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  const [settings, setSettings] = useState<SaccadeSettings>({ ...defaultSettings });
  const [screens, setScreens] = useState<ScreenRecord[]>([]);
  const [state, setState] = useState<ScreenState>(emptyState);
  const [remainingMs, setRemainingMs] = useState(settings.practiceMinutes * 60000);
  const [layoutError, setLayoutError] = useState(false);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const rootRef = useRef<HTMLDivElement>(null), dialogRef = useRef<HTMLDialogElement>(null), formRef = useRef<HTMLFormElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null), jsPsychHostRef = useRef<HTMLDivElement>(null);
  const lifecycleRef = useRef<JsPsychExternalLifecycle | null>(null), runRef = useRef<ScreenRun | null>(null);
  const phaseRef = useRef(phase), generationRef = useRef(0);
  phaseRef.current = phase;
  const stopRuntime = useCallback(() => {
    generationRef.current++;
    runRef.current?.stop(); runRef.current = null;
    lifecycleRef.current?.abort({ abort_reason: 'exit-training' });
    DisposeAudioFeedback();
  }, []);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const backToSettings = useCallback(() => {
    stopRuntime(); setLayoutError(false); setPhase('menu');
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, [stopRuntime]);
  useEffect(() => OnSavedSettings(saved => {
    const restored = RestoreSettings(saved, defaultSettings, ValidateSettings);
    if (restored && phaseRef.current === 'menu') setSettings(restored);
  }), []);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setScreens([]); setPhase('menu'); };
    const keys = (event: KeyboardEvent) => {
      if (phaseRef.current === 'running' && event.key === 'Escape') { event.preventDefault(); exit(); }
    };
    const pagehide = () => { stopRuntime(); if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined); };
    window.addEventListener('game:saved', saved); window.addEventListener('game:configure', configure);
    window.addEventListener('keydown', keys, true); window.addEventListener('pagehide', pagehide);
    return () => {
      window.removeEventListener('game:saved', saved); window.removeEventListener('game:configure', configure);
      window.removeEventListener('keydown', keys, true); window.removeEventListener('pagehide', pagehide);
      pagehide();
    };
  }, [exit, stopRuntime]);
  useEffect(() => {
    if (phase !== 'menu') return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, [phase]);
  useEffect(() => {
    if (phase !== 'running' || !jsPsychHostRef.current || !fieldRef.current) return;
    const lifecycle = new JsPsychExternalLifecycle(initJsPsych({ display_element: jsPsychHostRef.current }));
    lifecycleRef.current = lifecycle;
    const seed = Date.now();
    let bounds = fieldRef.current.getBoundingClientRect();
    const failLayout = () => { stopRuntime(); setLayoutError(true); };
    const finish = (completed: ScreenRecord[]) => {
      runRef.current = null;
      const score = BuildGameScore(completed);
      lifecycle.finish({ screens: score.summary.screens, found: score.summary.found });
      PlayGameEndSound('Victory');
      setScreens(completed); setSaveState(IsHubGame() ? 'saving' : 'local');
      SendGameResult({ ...settings }, score.summary, score.rounds);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      setPhase('results');
    };
    void lifecycle.start({ moduleId: 'vision:exploratory-saccade', onStart: () => {
      const run = new ScreenRun({ sessionMs: settings.practiceMinutes * 60000, screenLimitMs: settings.screenTimeLimitSec * 1000 },
        (index, previous) => GenerateScreen(settings, { width: bounds.width, height: bounds.height,
          symbolPx: SymbolPx(window.screen.width, settings.symbolSizeDeg) }, seed + index, index, previous), {
          change: next => { setState(next); setRemainingMs(run.remainingMs()); },
          mark: () => PlaySuccessSound(), end: finish,
        }, browserClock);
      runRef.current = run;
      try { run.prepare(); } catch { failLayout(); }
    } });
    const ticker = window.setInterval(() => { if (runRef.current) setRemainingMs(runRef.current.remainingMs()); }, 200);
    // Only the first, unstarted screen can be rebuilt after fullscreen settles.
    const observer = new ResizeObserver(entries => {
      const current = entries[0]?.contentRect;
      if (!current || (Math.abs(current.width - bounds.width) <= 2 && Math.abs(current.height - bounds.height) <= 2)) return;
      const run = runRef.current;
      if (run && run.state.phase === 'ready' && run.screens.length === 0 && fieldRef.current) {
        bounds = fieldRef.current.getBoundingClientRect();
        try { run.prepare(); } catch { failLayout(); }
      } else failLayout();
    });
    observer.observe(fieldRef.current);
    return () => {
      observer.disconnect(); window.clearInterval(ticker);
      runRef.current?.stop(); runRef.current = null;
      lifecycle.dispose(); DisposeAudioFeedback();
      if (lifecycleRef.current === lifecycle) lifecycleRef.current = null;
    };
  }, [phase, settings, stopRuntime]);
  useEffect(() => {
    if (phase === 'running' && state.phase === 'ready' && !layoutError) fieldRef.current?.querySelector<HTMLButtonElement>('.saccade-start')?.focus();
  }, [phase, state.phase, state.screen, layoutError]);

  const confirmSettings = () => {
    if (!formRef.current?.reportValidity() || !ValidateSettings(settings)) return;
    SaveGameSettings({ ...settings }); setPhase('rules');
  };
  const startTraining = async () => {
    if (phaseRef.current !== 'rules' || !ValidateSettings(settings)) return;
    const generation = generationRef.current;
    PrepareAudioFeedback();
    try { await rootRef.current?.requestFullscreen?.(); } catch { /* Windowed play remains available. */ }
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (generation !== generationRef.current || phaseRef.current !== 'rules') {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      return;
    }
    setState(emptyState); setLayoutError(false); setRemainingMs(settings.practiceMinutes * 60000);
    SendGameEvent('active'); setPhase('running');
  };
  const summaryItems = [
    ...numericSettings.map(field => ({ label: en ? field.en : field.zh, value: String(settings[field.key]) })),
    { label: en ? 'Distractors' : '干擾符號', value: settings.distractors === 'mixed' ? (en ? 'Digits and letters' : '數字與字母') : (en ? 'Letters' : '字母') },
    { label: en ? 'Screen time limit' : '每個畫面的時間上限', value: settings.screenTimeLimitSec ? `${settings.screenTimeLimitSec} ${en ? 's' : '秒'}` : (en ? 'Until all are found' : '直到全部找到') },
  ];
  const score = BuildGameScore(screens), summary = score.summary;
  const ms = (value: number | null) => value === null ? (en ? 'N/A' : '無') : `${value} ms`;
  const returnLabel = IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口');
  const context = [
    { label: en ? 'Mean completed screen time' : '全部找到的畫面平均時間', value: ms(summary.meanScreenMs) },
    { label: en ? 'Left: onset to find' : '左側：出現至找到', value: ms(summary.leftFoundMs) },
    { label: en ? 'Right: onset to find' : '右側：出現至找到', value: ms(summary.rightFoundMs) },
    { label: en ? 'Left missed targets' : '左側漏找', value: summary.leftMissed },
    { label: en ? 'Right missed targets' : '右側漏找', value: summary.rightMissed },
    { label: en ? 'False clicks' : '誤點數', value: summary.falseClicks },
    { label: en ? 'Screens' : '完成畫面數', value: summary.screens },
    { label: en ? 'Search time (s)' : '實際搜尋時間（秒）', value: summary.searchSeconds },
  ];
  return <div ref={rootRef} className="exploratory-saccade-game-root">
    <div ref={jsPsychHostRef} className="saccade-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <ExploratorySaccadeTutorial active={phase === 'rules'} title={title} settings={settings}
      summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog saccade-phase-menu" aria-labelledby="saccade-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="saccade-settings-title">{title}</h2></header>
        <div className="training-config-body"><section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
          <p>{en ? 'Use a mouse, touchpad or touch screen. Measure the visible screen from its left to right edge.' : '需要滑鼠、觸控板或觸控螢幕。請量出螢幕可見畫面從左緣到右緣的寬度。'}</p>
          {numericSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}
            <input name={field.key} type="number" required min={field.min} max={field.max} step={field.step} value={Number.isNaN(settings[field.key]) ? '' : settings[field.key]}
              onChange={event => setSettings({ ...settings, [field.key]: event.target.valueAsNumber })} /></label>)}
          <label>{en ? 'Distractors' : '干擾符號'}<select name="distractors" value={settings.distractors}
            onChange={event => setSettings({ ...settings, distractors: event.target.value as SaccadeSettings['distractors'] })}>
            <option value="mixed">{en ? 'Digits and letters' : '數字與字母'}</option><option value="letters">{en ? 'Letters only' : '僅字母'}</option>
          </select></label>
          <label>{en ? 'Screen time limit' : '每個畫面的時間上限'}<select name="screenTimeLimitSec" value={settings.screenTimeLimitSec}
            onChange={event => setSettings({ ...settings, screenTimeLimitSec: Number(event.target.value) })}>
            {[0, 30, 60, 90, 120].map(value => <option key={value} value={value}>{value ? `${value} ${en ? 's' : '秒'}` : (en ? 'Until all are found' : '直到全部找到')}</option>)}
          </select></label>
          <p className="saccade-distance">{en ? 'Recommended viewing distance' : '建議觀看距離'}：{Number.isFinite(settings.screenWidthCm) ? ViewingDistanceCm(settings.screenWidthCm) : '?'} {en ? 'cm' : '公分'}</p>
          <p>{en ? 'Only search time counts. Finish the current screen when the session time runs out. On a small screen, reduce symbol count or size, or turn the device.' : '只計算搜尋時間，用完練習時間後仍完成目前這個畫面。小螢幕可減少符號數或字級，或旋轉裝置。'}</p>
          <p className="training-setting-description">{en ? 'Method references: Roth et al. (2009); Ivanov et al. (2016, 2018).' : '方法參考：Roth 等（2009）；Ivanov 等（2016、2018）。'}</p>
        </section></div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{returnLabel}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && !layoutError && <RunningView state={state} en={en} remainingMs={remainingMs} fieldRef={fieldRef}
      onStart={() => runRef.current?.startScreen()} onStop={exit} onInteract={(...args) => runRef.current?.interact(...args)} />}
    {phase === 'running' && layoutError && <section className="saccade-layout-error training-config" role="alert">
      <h2>{en ? 'Adjust the display settings' : '請調整顯示設定'}</h2>
      <p>{en ? 'The display changed or has too little space for this symbol size and count. Nothing was saved. Reduce the symbol size or count, or rotate the device before starting again.' : '畫面尺寸已改變，或目前字級與符號數無法保留足夠間距。本次未保存。請縮小字級、減少符號數，或旋轉裝置後重新開始。'}</p>
      <button type="button" className="btn btn-primary" autoFocus onClick={backToSettings}>{en ? 'Back to settings' : '返回設定'}</button>
      <button type="button" className="btn btn-ghost" onClick={exit}>{returnLabel}</button>
    </section>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Found targets' : '找到目標'}</p><strong>{summary.found} / {summary.targets}</strong><p>{summary.targets ? `${Math.round(summary.found! / summary.targets * 1000) / 10}%` : (en ? 'N/A' : '無')}</p></div>
        <div className="score-key-metric"><p>{en ? 'Mean interval between finds' : '平均每個目標間隔'}</p><strong>{ms(summary.meanTargetMs)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Missed targets' : '漏找目標'}</p><strong>{summary.missed}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Screen and side comparison' : '畫面與左右側比較'}</h2><dl className="score-context-list">
        {context.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
      </dl><p className="score-note">{en ? 'Target intervals begin at screen onset, then at the preceding find. Left and right times begin at screen onset. Screen means include only screens with all targets found. Waiting and feedback time are excluded.' : '目標間隔由畫面出現起算，之後由前一次找到起算。左右側時間都由畫面出現起算。畫面平均時間只計全部找到的畫面。等待與提示時間不列入搜尋時間。'}</p></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
      </dl></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{returnLabel}</button>
    </section></div>}
  </div>;
}
