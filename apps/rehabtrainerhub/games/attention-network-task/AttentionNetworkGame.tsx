import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, EstimatedSeconds, leadInMs, practiceItems, rangeSettings, ValidateSettings, type AntSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { AntTutorial } from './rules/AntTutorial';
import { ArrowRow } from './ArrowRow';
import { CreateAntPlan, CreateAntStep, CreateRandom, type AntSegment, type AntTrial, type Side } from './logic/antTrials';
import { TrialRun, type RunClock } from './logic/trialRun';
import { SummarizeAnt, type AntRow } from './logic/antScore';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayGameEndSound, PlayMidiMusic, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

const browserClock: RunClock = {
  now: () => performance.now(),
  set: (callback, ms) => window.setTimeout(callback, ms),
  clear: timer => window.clearTimeout(timer),
};

type Phase = 'menu' | 'rules' | 'running' | 'results';
interface RestState { after: AntSegment['kind']; block: number; blocks: number; next: number; accuracy: number | null; meanCorrectRtMs: number | null }

// Fills both arrow rows; the centre item is the target and the four flankers follow the item's flanker type.
function FillRows(area: HTMLElement, trial: AntTrial) {
  const flanker = trial.condition === 'neutral' ? 'dash' : trial.condition === 'congruent' ? trial.target : trial.target === 'left' ? 'right' : 'left';
  area.querySelectorAll<HTMLElement>('.ant-row').forEach(row => {
    Object.assign(row.dataset, { target: trial.target, condition: trial.condition });
    row.querySelectorAll<HTMLElement>('.ant-item').forEach((item, position) => { item.dataset.kind = position === 2 ? trial.target : flanker; });
  });
}

export function AttentionNetworkGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<AntSettings>({ ...defaultSettings });
  const [rows, setRows] = useState<AntRow[]>([]);
  const [rest, setRest] = useState<RestState | null>(null);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const progressLabelRef = useRef<HTMLParagraphElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const runRef = useRef<TrialRun<AntTrial> | null>(null);
  const runSegmentRef = useRef<((index: number) => void) | null>(null);
  const restRef = useRef(rest);
  restRef.current = rest;
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
    runSegmentRef.current = null;
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
  }, []);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  const continueAfterRest = useCallback(() => {
    const current = restRef.current;
    if (current) runSegmentRef.current?.(current.next);
  }, []);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setRows([]); setRest(null); setPhase('menu'); };
    const keys = (event: KeyboardEvent) => {
      if (phaseRef.current !== 'running') return;
      if (event.key === 'Escape') { event.preventDefault(); exit(); return; }
      if (restRef.current) {
        if ((event.key === 'Enter' || event.key === ' ') && !event.repeat && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); continueAfterRest(); }
        return;
      }
      const key = event.key.toLowerCase();
      const side: Side | null = key === 'arrowleft' || key === 'f' ? 'left' : key === 'arrowright' || key === 'j' ? 'right' : null;
      if (side) { event.preventDefault(); if (!event.repeat) runRef.current?.respond(side); }
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
  }, [exit, stopRuntime, continueAfterRest]);
  useEffect(() => {
    if (phase !== 'menu') return;
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, [phase]);
  useEffect(() => { if (rest) continueButtonRef.current?.focus(); }, [rest]);
  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (phase !== 'running' || !host) return;
    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    const random = CreateRandom(Date.now());
    const plan = CreateAntPlan(settings, random);
    const blocks = plan.filter(segment => segment.kind === 'block').length;
    const allRows: AntRow[] = [];
    const setState = (state: string) => { if (areaRef.current) areaRef.current.dataset.state = state; };
    const finish = () => {
      runRef.current = null;
      runSegmentRef.current = null;
      const score = BuildGameScore(allRows, settings);
      jsPsychLifecycleRef.current?.finish({ trials: score.summary.trials, accuracy: score.summary.accuracy, conflict_ms: score.summary.conflictMs });
      PlayGameEndSound('Victory');
      setRows([...allRows]);
      setSaveState(IsHubGame() ? 'saving' : 'local');
      SendGameResult({ ...settings }, score.summary, score.rounds);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      setPhase('results');
    };
    const runSegment = (index: number) => {
      const segment = plan[index];
      setRest(null);
      setState('ready');
      if (progressLabelRef.current) progressLabelRef.current.textContent = enRef.current ? 'Get ready' : '準備開始';
      if (progressFillRef.current) progressFillRef.current.style.width = '0%';
      const segmentRows: AntRow[] = [];
      const total = segment.trials.length;
      let prepared = -1;
      const run = new TrialRun<AntTrial>(total, item => CreateAntStep(segment.trials[item], settings, random), {
        lead: (state, step, item) => {
          const area = areaRef.current;
          if (!area) return;
          if (item !== prepared) {
            prepared = item;
            if (feedbackRef.current) { feedbackRef.current.textContent = ''; delete feedbackRef.current.dataset.result; }
            Object.assign(area.dataset, { cue: step.trial.cue, location: step.trial.location });
            FillRows(area, step.trial);
            const english = enRef.current;
            if (progressLabelRef.current) progressLabelRef.current.textContent = segment.kind === 'block'
              ? (english ? `Block ${segment.block} of ${blocks} · ${item + 1}/${total}` : `第 ${segment.block} 組（共 ${blocks} 組）· ${item + 1}／${total}`)
              : (english ? `Practice ${item + 1} of ${total}` : `練習 ${item + 1}／${total}`);
            if (progressFillRef.current) progressFillRef.current.style.width = `${(item + 1) / total * 100}%`;
          }
          setState(state);
        },
        show: () => setState('target'),
        hide: () => setState('fixation'),
        signal: () => undefined,
        end: (outcome, feedback) => {
          const trial = outcome.trial;
          const response = outcome.response as Side | null;
          const row: AntRow = { trial: allRows.length + 1, practice: trial.practice, cue: trial.cue, location: trial.location, condition: trial.condition,
            target: trial.target, response, rtMs: outcome.rtMs };
          allRows.push(row);
          segmentRows.push(row);
          if (!feedback) { setState('fixation'); return; }
          setState('feedback');
          if (!feedbackRef.current) return;
          const english = enRef.current;
          const correct = response === trial.target;
          feedbackRef.current.dataset.result = correct ? 'correct' : 'wrong';
          feedbackRef.current.textContent = correct ? (english ? 'Correct' : '答對了')
            : response === null ? (english ? 'Too slow. Answer a little faster.' : '太慢了，請快一點。')
              : (english ? `The middle arrow pointed ${trial.target}.` : `中間的箭頭朝${trial.target === 'left' ? '左' : '右'}。`);
        },
        clear: () => setState('fixation'),
      }, browserClock, () => {
        runRef.current = null;
        if (index === plan.length - 1) { finish(); return; }
        const part = SummarizeAnt(segmentRows.map(row => ({ ...row, practice: false })));
        setRest({ after: segment.kind, block: segment.block, blocks, next: index + 1, accuracy: part.accuracy, meanCorrectRtMs: part.meanCorrectRtMs });
      }, leadInMs);
      runRef.current = run;
      run.start();
    };
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:attention-network-task', onStart: () => {
      runSegmentRef.current = runSegment;
      runSegment(0);
    } });
    return () => {
      runRef.current?.stop();
      runRef.current = null;
      runSegmentRef.current = null;
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
    setRest(null);
    setPhase('running');
  };

  const duration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60), extra = seconds % 60;
    const parts = en ? [minutes && `${minutes} min`, extra && `${extra} s`] : [minutes && `${minutes} 分`, extra && `${extra} 秒`];
    return `${en ? 'about' : '約'} ${parts.filter(Boolean).join(' ')}`;
  };
  const unit = (field: typeof rangeSettings[number]) => en ? (field.unitEn ? ` ${field.unitEn}` : '') : ` ${field.unitZh}`;
  const hints: Record<string, string> = en ? {
    responseWindowMs: 'How long the arrow row stays up waiting for an answer. Every item still takes 3.5 s in total.',
    rounds: 'Counted items, in blocks of 48 with a rest after each. Each block holds every cue, position and arrow layout once.',
    practice: `${practiceItems} practice items with feedback come first. The counted items give no feedback.`,
  } : {
    responseWindowMs: '箭頭列出現後等待作答的時間；每題總長仍固定 3.5 秒。',
    rounds: '計入成果的題數，每 48 題一組，組間可休息。每組包含所有提示、位置與箭頭排列各一次。',
    practice: `正式開始前先做 ${practiceItems} 題練習，會提示對錯；正式題目不再提示。`,
  };
  const summaryItems = [
    ...rangeSettings.map(field => ({ label: en ? field.en : field.zh, value: `${settings[field.key]}${unit(field)}` })),
    { label: en ? 'Practice first' : '先練習', value: settings.practice ? (en ? `Yes, ${practiceItems} items` : `是，${practiceItems} 題`) : (en ? 'No' : '否') },
    { label: en ? 'Estimated time' : '預估時間', value: `${duration(EstimatedSeconds(settings))}${en ? ', plus rests' : '，另加休息時間'}` },
  ];
  const score = BuildGameScore(rows, settings);
  const summary = score.summary;
  const missing = en ? 'N/A' : '無';
  const ms = (value: number | null) => value === null ? missing : `${value} ms`;
  const percent = (value: number | null) => value === null ? missing : `${value}%`;
  return <div ref={rootRef} className="attention-network-task-game-root">
    <div ref={jsPsychHostRef} className="ant-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <AntTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog attention-network-task-phase-menu" aria-labelledby="ant-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="ant-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            {rangeSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}：<output>{settings[field.key]}{unit(field)}</output>
              <input name={field.key} type="range" min={field.min} max={field.max} step={field.step} value={settings[field.key]}
                onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })} />
              <small className="training-setting-description">{hints[field.key]}</small></label>)}
            <label className="ant-checkbox"><input name="practice" type="checkbox" checked={settings.practice}
              onChange={event => setSettings({ ...settings, practice: event.target.checked })} />{en ? 'Practice first' : '先練習'}
              <small className="training-setting-description">{hints.practice}</small></label>
            <p className="ant-estimate">{en ? 'Estimated time' : '預估時間'}：{duration(EstimatedSeconds(settings))}{en ? ', plus rests between blocks' : '，另加組間休息'}</p>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="ant-stage ant-running" aria-label={title}>
      <header className="ant-hud">
        <p ref={progressLabelRef} className="ant-progress-label" aria-live="off">{en ? 'Get ready' : '準備開始'}</p>
        <div className="ant-progress-track"><div ref={progressFillRef} className="ant-progress-fill" /></div>
        <button type="button" className="btn btn-ghost ant-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <div ref={areaRef} className="ant-stimulus-area" data-state="ready" data-cue="nocue" data-location="up" aria-hidden="true">
        <div className="ant-slot ant-slot-up"><span className="ant-star ant-star-up">*</span><ArrowRow slot="up" /></div>
        <div className="ant-slot ant-slot-center"><span className="ant-fixation">+</span><span className="ant-star ant-star-center">*</span></div>
        <div className="ant-slot ant-slot-down"><span className="ant-star ant-star-down">*</span><ArrowRow slot="down" /></div>
        <p ref={feedbackRef} className="ant-feedback" aria-live="off" />
      </div>
      <div className="ant-pads">
        {(['left', 'right'] as Side[]).map(side => <button key={side} type="button" className={`ant-pad ant-pad-${side}`}
          onPointerDown={event => { event.preventDefault(); runRef.current?.respond(side); }}>
          {side === 'left' ? (en ? 'Left' : '左') : (en ? 'Right' : '右')}<small>{side === 'left' ? '← / F' : '→ / J'}</small></button>)}
      </div>
      {rest && <section className="training-panel ant-rest" role="dialog" aria-modal="true" aria-labelledby="ant-rest-title">
        <div className="training-config training-confirmation">
          <header className="training-config-header"><h2 id="ant-rest-title">{rest.after === 'practice' ? (en ? 'Practice done' : '練習結束')
            : (en ? `Block ${rest.block} of ${rest.blocks} done` : `第 ${rest.block} 組完成（共 ${rest.blocks} 組）`)}</h2></header>
          <div className="training-config-body"><section className="training-setting"><h3>{en ? 'This part' : '這一段的表現'}</h3>
            <div className="training-config-summary">
              <p className="training-config-summary-item"><strong>{en ? 'Correct' : '正確率'}：</strong>{percent(rest.accuracy)}</p>
              <p className="training-config-summary-item"><strong>{en ? 'Mean time on correct answers' : '答對的平均時間'}：</strong>{ms(rest.meanCorrectRtMs)}</p>
            </div>
            <p>{rest.after === 'practice'
              ? (en ? `The counted items start next: ${rest.blocks} blocks of 48 with a rest after each. They give no feedback.` : `接下來是正式題目，共 ${rest.blocks} 組、每組 48 題，組間可休息。正式題目不提示對錯。`)
              : (en ? 'Take a short rest and continue when you are ready.' : '休息一下，準備好再繼續。')}</p>
          </section></div>
          <footer className="config-actions"><div className="training-config-navigation-buttons">
            <button ref={continueButtonRef} type="button" className="btn btn-primary ant-continue" onClick={continueAfterRest}>{en ? 'Continue' : '繼續'}</button>
          </div></footer>
        </div>
      </section>}
    </main>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Correct' : '正確率'}</p><strong>{percent(summary.accuracy)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Mean time on correct answers' : '答對的平均時間'}</p><strong>{ms(summary.meanCorrectRtMs)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Conflict difference' : '衝突差異'}</p><strong>{ms(summary.conflictMs)}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.slice(0, -1).map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Alerting difference' : '警覺差異'}</dt><dd>{ms(summary.alertingMs)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Orienting difference' : '定向差異'}</dt><dd>{ms(summary.orientingMs)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'No answer in time' : '未及時作答'}</dt><dd>{summary.misses}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Mean time over every answer' : '所有作答的平均時間'}</dt><dd>{ms(summary.meanResponseMs)}</dd></div>
      </dl>
        <p className="score-note">{en ? 'Each difference compares mean times on correct answers. Alerting: no cue minus two stars. Orienting: centre star minus a star at the row position. Conflict: opposite flankers minus same-direction flankers. Practice items are listed below but not counted here.'
          : '各項差異都比較答對題目的平均時間。警覺差異＝沒有星號減去上下兩個星號；定向差異＝中央星號減去箭頭位置的星號；衝突差異＝兩側箭頭反方向減去同方向。練習題列在下方明細，但不計入這些統計。'}</p></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}
