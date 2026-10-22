import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, EstimatedSeconds, leadInMs, rangeSettings, ValidateSettings, type SartSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { SartTutorial } from './rules/SartTutorial';
import { CreateRandom, CreateSartTrials } from './logic/sartTrials';
import { SartRun, type SartClock, type SartRow } from './logic/sartRun';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayGameEndSound, PlayMidiMusic, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

const browserClock: SartClock = {
  now: () => performance.now(),
  set: (callback, ms) => window.setTimeout(callback, ms),
  clear: timer => window.clearTimeout(timer),
};

type Phase = 'menu' | 'rules' | 'running' | 'results';

export function SartGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<SartSettings>({ ...defaultSettings });
  const [rows, setRows] = useState<SartRow[]>([]);
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
  const runRef = useRef<SartRun | null>(null);
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
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
  }, []);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setRows([]); setPhase('menu'); };
    const keys = (event: KeyboardEvent) => {
      if (phaseRef.current !== 'running') return;
      if (event.key === 'Escape') { event.preventDefault(); exit(); }
      if (event.key === ' ' || event.code === 'Space') { event.preventDefault(); if (!event.repeat) runRef.current?.respond(); }
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
    const host = jsPsychHostRef.current;
    if (phase !== 'running' || !host) return;
    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    const trials = CreateSartTrials(settings.trials, settings.noGoDigit, CreateRandom(Date.now()));
    const finish = (completed: SartRow[]) => {
      runRef.current = null;
      const score = BuildGameScore(completed);
      jsPsychLifecycleRef.current?.finish({ trials: completed.length, commission_errors: score.summary.commissionErrors, omission_errors: score.summary.omissionErrors });
      PlayGameEndSound('Victory');
      setRows(completed);
      setSaveState(IsHubGame() ? 'saving' : 'local');
      SendGameResult({ ...settings }, score.summary, score.rounds);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      setPhase('results');
    };
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:sart', onStart: () => {
      const run = new SartRun(trials, { digitMs: settings.digitMs, maskMs: settings.maskMs, leadInMs }, {
        show: (trial, index) => {
          if (stimulusRef.current) {
            stimulusRef.current.textContent = String(trial.digit);
            stimulusRef.current.style.setProperty('--sart-digit-scale', String(trial.size));
          }
          if (areaRef.current) areaRef.current.dataset.state = 'digit';
          if (progressLabelRef.current) progressLabelRef.current.textContent = enRef.current ? `Digit ${index + 1} of ${trials.length}` : `第 ${index + 1} 個，共 ${trials.length} 個`;
          if (progressFillRef.current) progressFillRef.current.style.width = `${(index + 1) / trials.length * 100}%`;
        },
        mask: () => { if (areaRef.current) areaRef.current.dataset.state = 'mask'; },
      }, browserClock, finish);
      runRef.current = run;
      run.start();
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
  const unit = (field: typeof rangeSettings[number]) => en ? (field.unitEn ? ` ${field.unitEn}` : '') : ` ${field.unitZh}`;
  const hints: Record<string, string> = en ? {
    noGoDigit: 'Press for every other digit. This one appears once in every nine.',
    trials: 'More digits make a longer session.',
    digitMs: 'How long each digit stays on screen before it is covered.',
    maskMs: 'How long the cover stays. Display time plus cover time is the gap between digits.',
  } : {
    noGoDigit: '其他數字都要按。這個數字每 9 個出現一次。',
    trials: '數字越多，練習時間越長。',
    digitMs: '每個數字出現多久後被蓋住。',
    maskMs: '蓋住的時間。顯示時間加蓋住時間，就是兩個數字之間的間隔。',
  };
  const summaryItems = [
    { label: en ? 'Digit to skip' : '要忍住不按的數字', value: String(settings.noGoDigit) },
    ...rangeSettings.map(field => ({ label: en ? field.en : field.zh, value: `${settings[field.key]}${unit(field)}` })),
    { label: en ? 'Estimated time' : '預估時間', value: duration(EstimatedSeconds(settings)) },
  ];
  const score = BuildGameScore(rows);
  const summary = score.summary;
  const missing = en ? 'N/A' : '無';
  const ms = (value: number | null) => value === null ? missing : `${value} ms`;
  return <div ref={rootRef} className="sart-game-root">
    <div ref={jsPsychHostRef} className="sart-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <SartTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog sart-phase-menu" aria-labelledby="sart-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="sart-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            <label>{en ? 'Digit to skip' : '要忍住不按的數字'}<select name="noGoDigit" value={settings.noGoDigit}
              onChange={event => setSettings({ ...settings, noGoDigit: Number(event.target.value) })}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => <option key={digit} value={digit}>{digit}</option>)}
            </select>
              <small className="training-setting-description">{hints.noGoDigit}</small></label>
            {rangeSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}：<output>{settings[field.key]}{unit(field)}</output>
              <input name={field.key} type="range" min={field.min} max={field.max} step={field.step} value={settings[field.key]}
                onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })} />
              <small className="training-setting-description">{hints[field.key]}</small></label>)}
            <p className="sart-estimate">{en ? 'Estimated time' : '預估時間'}：{duration(EstimatedSeconds(settings))}</p>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="sart-stage sart-running" aria-label={title}>
      <header className="sart-hud">
        <p ref={progressLabelRef} className="sart-progress-label" aria-live="off">{en ? 'Get ready' : '準備開始'}</p>
        <div className="sart-progress-track"><div ref={progressFillRef} className="sart-progress-fill" /></div>
        <button type="button" className="btn btn-ghost sart-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <div ref={areaRef} className="sart-stimulus-area" data-state="ready">
        <p ref={stimulusRef} className="sart-stimulus" />
        <svg className="sart-mask" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="38" /><path d="M23 23 77 77M77 23 23 77" /></svg>
        <p className="sart-fixation" aria-hidden="true">+</p>
      </div>
      <button type="button" className="sart-response-pad" onPointerDown={event => { event.preventDefault(); runRef.current?.respond(); }}>
        {en ? 'Press' : '按'}<small>{en ? 'or Space bar' : '或空白鍵'}</small></button>
    </main>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? `Pressed on ${settings.noGoDigit}` : `看到 ${settings.noGoDigit} 卻按了`}</p><strong>{summary.commissionErrors} / {summary.noGoTrials}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Missed presses' : '該按卻沒按'}</p><strong>{summary.omissionErrors}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Mean response time' : '平均反應時間'}</p><strong>{ms(summary.meanGoRtMs)}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.slice(0, -1).map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Correct responses' : '正確率'}</dt><dd>{summary.accuracyPercent === null ? missing : `${summary.accuracyPercent}%`}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Response time spread (CV)' : '反應時間變異係數'}</dt><dd>{summary.rtCvPercent === null ? missing : `${summary.rtCvPercent}%`}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Mean time over the 4 digits before a wrong press' : '誤按前 4 個數字的平均反應時間'}</dt><dd>{ms(summary.preCommissionRtMs)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Mean time over the 4 digits before a correct skip' : '成功忍住前 4 個數字的平均反應時間'}</dt><dd>{ms(summary.preWithholdRtMs)}</dd></div>
      </dl>
        <p className="score-note">{en ? 'Comparing the last two shows whether presses sped up just before a wrong press.'
          : '比較最後兩項，可以看出誤按之前是否按得比較快。'}</p></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}
