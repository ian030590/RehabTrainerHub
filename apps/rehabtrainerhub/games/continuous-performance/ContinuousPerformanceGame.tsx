import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, EstimatedSeconds, leadInMs, rangeSettings, ValidateSettings, type CptSettings, type CptVariant } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { CptTutorial } from './rules/CptTutorial';
import { CreateCptTrials, CreateRandom } from './logic/cptTrials';
import { CptRun, type CptClock, type CptRow } from './logic/cptRun';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayGameEndSound, PlayMidiMusic, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

const browserClock: CptClock = {
  now: () => performance.now(),
  set: (callback, ms) => window.setTimeout(callback, ms),
  clear: timer => window.clearTimeout(timer),
};

type Phase = 'menu' | 'rules' | 'running' | 'results';

export function ContinuousPerformanceGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  const [paused, setPaused] = useState(false);
  const [fullscreenInterrupted, setFullscreenInterrupted] = useState(false);
  const endingRef = useRef(false);
  const pausedRef = useRef(false);
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
  const [settings, setSettings] = useState<CptSettings>({ ...defaultSettings });
  const [rows, setRows] = useState<CptRow[]>([]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const stimulusRef = useRef<HTMLParagraphElement>(null);
  const progressLabelRef = useRef<HTMLParagraphElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const runRef = useRef<CptRun | null>(null);
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
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
  }, []);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const pause = useCallback(() => {
    if (pausedRef.current) return;
    setFullscreenInterrupted(false);
    pausedRef.current = true;
    runRef.current?.pause();
    StopMidiMusic();
    setPaused(true);
  }, []);
  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    restoreStopRef.current = true;
    setPaused(false);
    runRef.current?.resume();
  }, []);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setRows([]); setPhase('menu'); };
    const fullscreenChanged = () => { if (phaseRef.current === 'running' && !endingRef.current && !document.fullscreenElement) { pause(); setFullscreenInterrupted(true); } };
    const keys = (event: KeyboardEvent) => {
      if (phaseRef.current !== 'running') return;
      if (event.key === 'Escape') { event.preventDefault(); if (!event.repeat) { if (pausedRef.current) resume(); else pause(); } return; }
      if (pausedRef.current) return;
      if (event.key === ' ' || event.code === 'Space') { event.preventDefault(); if (!event.repeat) runRef.current?.respond(); }
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
    const host = jsPsychHostRef.current;
    if (phase !== 'running' || !host) return;
    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    const trials = CreateCptTrials(settings, CreateRandom(Date.now()));
    const finish = (completed: CptRow[]) => {
      endingRef.current = true;
      runRef.current = null;
      const score = BuildGameScore(completed);
      jsPsychLifecycleRef.current?.finish({ trials: completed.length, omissions: score.summary.omissions, commissions: score.summary.commissions });
      PlayGameEndSound('Victory');
      setRows(completed);
      setSaveState(IsHubGame() ? 'saving' : 'local');
      SendGameResult({ ...settings }, score.summary, score.rounds);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      setPhase('results');
    };
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:continuous-performance', onStart: () => {
      const run = new CptRun(trials, { letterMs: settings.letterMs, isiMs: settings.isiMs, leadInMs }, {
        show: (trial, index) => {
          if (stimulusRef.current) stimulusRef.current.textContent = trial.letter;
          if (areaRef.current) areaRef.current.dataset.state = 'letter';
          if (progressLabelRef.current) progressLabelRef.current.textContent = enRef.current ? `Letter ${index + 1} of ${trials.length}` : `第 ${index + 1} 個，共 ${trials.length} 個`;
          if (progressFillRef.current) progressFillRef.current.style.width = `${(index + 1) / trials.length * 100}%`;
        },
        blank: () => { if (areaRef.current) areaRef.current.dataset.state = 'blank'; },
      }, browserClock, finish);
      runRef.current = run;
      run.start();
      if (pausedRef.current) run.pause();
    } });
    return () => {
      runRef.current?.stop();
      runRef.current = null;
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
    PrepareAudioFeedback();
    try { await rootRef.current?.requestFullscreen?.(); } catch { /* Windowed play remains available. */ }
    if (generation !== generationRef.current || phaseRef.current !== 'rules') {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      return;
    }
    SendGameEvent('active');
    setPhase('running');
  };

  const duration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60), rest = seconds % 60;
    const parts = en ? [minutes && `${minutes} min`, rest && `${rest} s`] : [minutes && `${minutes} 分`, rest && `${rest} 秒`];
    return `${en ? 'about' : '約'} ${parts.filter(Boolean).join(' ')}`;
  };
  const unit = (field: typeof rangeSettings[number]) => en ? (field.unitEn ? `${field.unitEn === '%' ? '' : ' '}${field.unitEn}` : '') : `${field.unitZh === '%' ? '' : ' '}${field.unitZh}`;
  const variantLabel = (variant: CptVariant) => variant === 'ax' ? (en ? 'X right after A' : 'A 後面緊接的 X') : (en ? 'Every X' : '每個 X');
  const hints: Record<string, string> = en ? {
    variant: settings.variant === 'ax' ? 'Press only when X comes straight after A. A with another letter, or X after another letter, are traps.' : 'Press each time X appears.',
    trials: 'More letters make a longer session.',
    targetPercent: 'How many of the letters are targets. A lower share means longer waits between presses.',
    letterMs: 'How long each letter stays on screen.',
    isiMs: 'The blank gap after each letter. A press during the gap still counts for that letter.',
  } : {
    variant: settings.variant === 'ax' ? 'A 之後緊接著 X 才按。A 後面接別的字母，或別的字母後面接 X，都是陷阱。' : '每次出現 X 就按。',
    trials: '字母越多，練習時間越長。',
    targetPercent: '目標字母占全部字母的比例。比例越低，兩次要按之間等得越久。',
    letterMs: '每個字母在畫面上停留多久。',
    isiMs: '字母消失後的空白時間。空白時間內按，仍算在剛才那個字母。',
  };
  const summaryItems = [
    { label: en ? 'Press for' : '要按的目標', value: variantLabel(settings.variant) },
    ...rangeSettings.map(field => ({ label: en ? field.en : field.zh, value: `${settings[field.key]}${unit(field)}` })),
    { label: en ? 'Estimated time' : '預估時間', value: duration(EstimatedSeconds(settings)) },
  ];
  const score = BuildGameScore(rows);
  const summary = score.summary;
  const missing = en ? 'N/A' : '無';
  const ms = (value: number | null) => value === null ? missing : `${value} ms`;
  const percent = (value: number | null) => value === null ? missing : `${value}%`;
  return <div ref={rootRef} className="continuous-performance-game-root">
    <div ref={jsPsychHostRef} className="cpt-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <CptTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog continuous-performance-phase-menu" aria-labelledby="cpt-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="cpt-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            <label>{en ? 'Press for' : '要按的目標'}<select name="variant" value={settings.variant}
              onChange={event => setSettings({ ...settings, variant: event.target.value as CptVariant })}>
              {(['x', 'ax'] as const).map(variant => <option key={variant} value={variant}>{variantLabel(variant)}</option>)}
            </select>
              <small className="training-setting-description">{hints.variant}</small></label>
            {rangeSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}：<output>{settings[field.key]}{unit(field)}</output>
              <input name={field.key} type="range" min={field.min} max={field.max} step={field.step} value={settings[field.key]}
                onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })} />
              <small className="training-setting-description">{hints[field.key]}</small></label>)}
            <p className="cpt-estimate">{en ? 'Estimated time' : '預估時間'}：{duration(EstimatedSeconds(settings))}</p>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <><main className="cpt-stage cpt-running" aria-label={title} inert={paused}>
      <header className="cpt-hud">
        <p ref={progressLabelRef} className="cpt-progress-label" aria-live="off">{en ? 'Get ready' : '準備開始'}</p>
        <div className="cpt-progress-track"><div ref={progressFillRef} className="cpt-progress-fill" /></div>
        <button ref={stopRef} type="button" className="btn btn-ghost cpt-stop" onClick={pause}>{en ? 'Stop' : '停止'}</button>
      </header>
      <div ref={areaRef} className="cpt-stimulus-area" data-state="ready">
        <p ref={stimulusRef} className="cpt-stimulus" />
        <p className="cpt-fixation" aria-hidden="true">+</p>
      </div>
      <button type="button" className="cpt-response-pad" onPointerDown={event => { event.preventDefault(); runRef.current?.respond(); }}>
        {en ? 'Press' : '按'}<small>{en ? 'or Space bar' : '或空白鍵'}</small></button>
    </main>{paused && <div className="game-interrupt-overlay"><div className="game-interrupt-panel" role="dialog" aria-modal="true" aria-labelledby="cpt-pause-title"
      onKeyDown={event => { if (event.key === 'Tab') { const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button'); if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[1].focus(); } else if (!event.shiftKey && document.activeElement === buttons[1]) { event.preventDefault(); buttons[0].focus(); } } }}>
      <h2 id="cpt-pause-title">{en ? 'Paused' : '已暫停'}</h2>
      <p>{fullscreenInterrupted ? (en ? 'Fullscreen ended; ending the activity will not save this session.' : '已退出全螢幕，結束後不會保存這次紀錄。') : (en ? 'Ending the activity will not save this session.' : '結束後不會保存這次紀錄。')}</p>
      <button ref={continueRef} className="btn btn-primary" type="button" onClick={resume}>{en ? 'Continue' : '繼續'}</button>
      <button className="btn btn-ghost" type="button" onClick={exit}>{en ? 'End activity' : '結束活動'}</button>
    </div></div>}</>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1 ref={resultHeadingRef} tabIndex={-1}>{en ? 'Session results' : '當次成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><p className="score-complete">{en ? 'Activity complete' : '已完成本次活動'}</p><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Targets caught' : '按到的目標'}</p><strong>{summary.hits} / {summary.targets}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Presses on other letters' : '按到非目標'}</p><strong>{summary.commissions}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Mean response time' : '平均反應時間'}</p><strong>{ms(summary.meanHitRtMs)}</strong></div>
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
        <div className="score-context-item"><dt>{en ? 'Correct responses' : '正確率'}</dt><dd>{percent(summary.accuracyPercent)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Missed targets' : '漏按的目標'}</dt><dd>{summary.omissions}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Presses on other letters, share' : '非目標誤按比例'}</dt><dd>{percent(summary.falseAlarmPercent)}</dd></div>
        <div className="score-context-item"><dt>{en ? "Sensitivity (d')" : "辨別力（d'）"}</dt><dd>{summary.dPrime ?? missing}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Response time spread (SD)' : '反應時間標準差'}</dt><dd>{ms(summary.hitRtSdMs)}</dd></div>
        {settings.variant === 'ax' && <div className="score-context-item"><dt>{en ? 'Presses on traps (A then other, other then X)' : '陷阱誤按（A 後接他字、他字後接 X）'}</dt><dd>{summary.nearMissPresses}</dd></div>}
      </dl>
        <p className="score-note">{en ? "d' combines caught targets and wrong presses; a higher value means targets and other letters were told apart more clearly."
          : "d' 同時考慮按到的目標與誤按，數值越高代表越能分辨目標與其他字母。"}</p></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      </details>
    </section></div>}
  </div>;
}
