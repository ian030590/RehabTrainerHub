import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, EstimatedSeconds, leadInMs, practiceItems, rangeSettings, ValidateSettings, type StopSignalSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { StopSignalTutorial } from './rules/StopSignalTutorial';
import { KeyGuide, ShapeIcon, StopStar } from './shapes';
import {
  CreateKeyMap, CreateRandom, CreateStopSignalPlan, CreateStopSignalStep, initialStopDelayMs, NextStopDelay, practiceStopDelayMs,
  type Condition, type Side, type StopSignalSegment, type StopSignalTrial,
} from './logic/stopSignalTrials';
import { TrialRun, type RunClock } from './logic/trialRun';
import { BlockFeedback, type BlockTip, type StopSignalRow } from './logic/stopSignalScore';
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
interface RestState { after: StopSignalSegment['kind']; block: number; blocks: number; next: number; feedback: ReturnType<typeof BlockFeedback> }

const keyLabels: Record<Side, string> = { left: 'Z', right: 'M' };
const tipText: Record<BlockTip, { zh: string; en: string }> = {
  slow: { zh: '反應有點慢，請盡快並正確地按下。', en: 'Responses were slow. Press as quickly and accurately as you can.' },
  missed: { zh: '有些形狀沒有按到。除非看到星形，每個形狀都要按。', en: 'Some shapes got no press. Press for every shape unless a star appears.' },
  accuracy: { zh: '按錯鍵的次數偏多，請再看一次下方每個形狀的按鍵。', en: 'Several presses used the wrong key. Check the keys for each shape below.' },
  'stop-more': { zh: '看到星形時，請盡力停住不按。', en: 'When a star appears, try hard to hold back.' },
  'stop-less': { zh: '不要為了等星形而放慢，看到形狀就盡快按。', en: 'Do not wait to see whether a star appears. Press as soon as you see the shape.' },
};

export function StopSignalGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<StopSignalSettings>({ ...defaultSettings });
  const [keyMap] = useState<Side[]>(() => CreateKeyMap(CreateRandom(Date.now())));
  const [rows, setRows] = useState<StopSignalRow[]>([]);
  const [rest, setRest] = useState<RestState | null>(null);
  const [guide, setGuide] = useState(true);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const shapeBoxRef = useRef<HTMLSpanElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const progressLabelRef = useRef<HTMLParagraphElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const runRef = useRef<TrialRun<StopSignalTrial> | null>(null);
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
      const side: Side | null = key === 'z' || key === 'arrowleft' ? 'left' : key === 'm' || key === 'arrowright' ? 'right' : null;
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
    const plan = CreateStopSignalPlan(settings, CreateRandom(Date.now()), keyMap);
    const blocks = plan.segments.filter(segment => segment.kind === 'block').length;
    const allRows: StopSignalRow[] = [];
    const stopRates: number[] = [];
    let delay = initialStopDelayMs;
    let lastCondition: Condition | null = null;
    const area = () => areaRef.current;
    const setState = (state: string) => { if (area()) area()!.dataset.state = state; };
    const setSignal = (on: boolean) => { if (area()) area()!.dataset.signal = on ? 'on' : 'off'; };
    const finish = () => {
      runRef.current = null;
      runSegmentRef.current = null;
      const score = BuildGameScore(allRows, settings);
      jsPsychLifecycleRef.current?.finish({ trials: score.summary.trials, stop_success: score.summary.stopSuccessRate, ssrt_ms: score.summary.ssrtMs });
      PlayGameEndSound('Victory');
      setRows([...allRows]);
      setSaveState(IsHubGame() ? 'saving' : 'local');
      SendGameResult({ ...settings }, score.summary, score.rounds);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      setPhase('results');
    };
    const runSegment = (index: number) => {
      const segment = plan.segments[index];
      if (segment.kind === 'block') {
        if (lastCondition !== null && segment.condition !== lastCondition) delay = initialStopDelayMs;
        lastCondition = segment.condition;
      }
      setRest(null);
      setGuide(segment.kind !== 'block' || settings.keyGuide);
      setState('ready');
      setSignal(false);
      if (progressLabelRef.current) progressLabelRef.current.textContent = enRef.current ? 'Get ready' : '準備開始';
      if (progressFillRef.current) progressFillRef.current.style.width = '0%';
      const segmentRows: StopSignalRow[] = [];
      const total = segment.trials.length;
      const run = new TrialRun<StopSignalTrial>(total, item => CreateStopSignalStep(segment.trials[item], delay, settings), {
        lead: state => { setState(state); setSignal(false); },
        show: (step, item) => {
          if (feedbackRef.current) { feedbackRef.current.textContent = ''; delete feedbackRef.current.dataset.result; }
          if (shapeBoxRef.current) shapeBoxRef.current.dataset.shape = String(step.trial.shape);
          const english = enRef.current;
          if (progressLabelRef.current) progressLabelRef.current.textContent = segment.kind === 'block'
            ? (english ? `Block ${segment.block} of ${blocks} · ${item + 1}/${total}` : `第 ${segment.block} 組（共 ${blocks} 組）· ${item + 1}／${total}`)
            : (english ? `Practice ${item + 1} of ${total}` : `練習 ${item + 1}／${total}`);
          if (progressFillRef.current) progressFillRef.current.style.width = `${(item + 1) / total * 100}%`;
          setState('target');
        },
        hide: () => setState('blank'),
        signal: () => setSignal(true),
        signalOff: () => setSignal(false),
        end: (outcome, feedback) => {
          const trial = outcome.trial;
          const response = outcome.response as Side | null;
          const row: StopSignalRow = { trial: allRows.length + 1, practice: trial.practice, shape: trial.shape, target: trial.target, response, rtMs: outcome.rtMs,
            stop: trial.stop, stopDelayMs: trial.stop ? (trial.practice ? practiceStopDelayMs : delay) : null, condition: trial.condition };
          allRows.push(row);
          segmentRows.push(row);
          if (trial.stop && !trial.practice) delay = NextStopDelay(delay, response === null);
          setSignal(false);
          if (!feedback) return;
          setState('feedback');
          if (!feedbackRef.current) return;
          const english = enRef.current;
          const correct = trial.stop ? response === null : response === trial.target;
          feedbackRef.current.dataset.result = correct ? 'correct' : 'wrong';
          feedbackRef.current.textContent = trial.stop
            ? (correct ? (english ? 'You held back.' : '成功停住。') : (english ? 'A star means hold back.' : '看到星形要停住。'))
            : correct ? (english ? 'Correct' : '答對了') : response === null ? (english ? 'No press this time.' : '這次沒有按到。')
              : (english ? `That shape goes with ${keyLabels[trial.target]}.` : `這個形狀要按 ${keyLabels[trial.target]}。`);
        },
        clear: () => { setState('blank'); setSignal(false); },
      }, browserClock, () => {
        runRef.current = null;
        const feedback = BlockFeedback(segmentRows, stopRates);
        if (segment.kind === 'block' && feedback.stopSuccess !== null) stopRates.push(feedback.stopSuccess);
        if (index === plan.segments.length - 1) finish();
        else setRest({ after: segment.kind, block: segment.block, blocks, next: index + 1, feedback });
      }, leadInMs);
      runRef.current = run;
      run.start();
    };
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:stop-signal', onStart: () => {
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
  }, [phase, settings, keyMap]);

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
    responseWindowMs: 'Time from the shape appearing until the next item starts. The shape itself shows for 0.85 s.',
    rounds: 'Counted shapes, in blocks of 50 with a rest after each block. The first six blocks share one star frequency and the rest use the other.',
    practice: `${practiceItems} practice shapes with feedback come first: 12 without stars, then 20 with some stars.`,
    keyGuide: 'Keep the shapes on the two buttons during counted blocks. The original task hides them after practice.',
  } : {
    responseWindowMs: '從形狀出現到下一題開始的時間，形狀本身顯示 0.85 秒。',
    rounds: '計入成果的形狀數，每 50 個一組，組間可休息。前 6 組和後 6 組的星形出現頻率不同。',
    practice: `正式開始前先做 ${practiceItems} 個練習並提示對錯：先 12 個沒有星形，再 20 個會出現星形。`,
    keyGuide: '正式階段仍在兩個按鈕上顯示對應形狀。原版在練習後會隱藏。',
  };
  const summaryItems = [
    ...rangeSettings.map(field => ({ label: en ? field.en : field.zh, value: `${settings[field.key]}${unit(field)}` })),
    { label: en ? 'Practice first' : '先練習', value: settings.practice ? (en ? `Yes, ${practiceItems} shapes` : `是，${practiceItems} 個`) : (en ? 'No' : '否') },
    { label: en ? 'Key guide in counted blocks' : '正式階段顯示按鍵提示', value: settings.keyGuide ? (en ? 'Yes' : '是') : (en ? 'No' : '否') },
    { label: en ? 'Estimated time' : '預估時間', value: `${duration(EstimatedSeconds(settings))}${en ? ', plus rests' : '，另加休息時間'}` },
  ];
  const score = BuildGameScore(rows, settings);
  const summary = score.summary;
  const missing = en ? 'N/A' : '無';
  const ms = (value: number | null) => value === null ? missing : `${value} ms`;
  const percent = (value: number | null) => value === null ? missing : `${value}%`;
  const restHeading = rest && (rest.after === 'practice-go' ? (en ? 'Shape practice done' : '形狀練習完成')
    : rest.after === 'practice-stop' ? (en ? 'Practice done' : '練習結束')
      : (en ? `Block ${rest.block} of ${rest.blocks} done` : `第 ${rest.block} 組完成（共 ${rest.blocks} 組）`));
  const restNote = rest && (rest.after === 'practice-go'
    ? (en ? 'Next, a red star sometimes appears around the shape. When it does, hold back and press nothing. The star can come late, so you will not always manage to stop. Keep pressing quickly and do not wait for it.'
      : '接下來，形狀周圍有時會出現紅色星形，這時請停住不要按。星形可能較晚出現，不一定每次都停得住；請照常快速按下，不要刻意等星形。')
    : rest.after === 'practice-stop'
      ? (en ? `The counted blocks start next: ${rest.blocks} blocks of 50 with a rest after each. They give no feedback${settings.keyGuide ? '.' : ', and the shapes leave the buttons.'}`
        : `接下來是正式階段，共 ${rest.blocks} 組、每組 50 個，組間可休息。正式階段不提示對錯${settings.keyGuide ? '。' : '，按鈕上的形狀也會隱藏。'}`)
      : (en ? 'Take a short rest and continue when you are ready.' : '休息一下，準備好再繼續。'));
  return <div ref={rootRef} className="stop-signal-game-root">
    <div ref={jsPsychHostRef} className="stop-signal-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <StopSignalTutorial active={phase === 'rules'} ready title={title} keyMap={keyMap}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog stop-signal-phase-menu" aria-labelledby="stop-signal-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="stop-signal-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            {rangeSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}：<output>{settings[field.key]}{unit(field)}</output>
              <input name={field.key} type="range" min={field.min} max={field.max} step={field.step} value={settings[field.key]}
                onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })} />
              <small className="training-setting-description">{hints[field.key]}</small></label>)}
            <label className="stop-signal-checkbox"><input name="practice" type="checkbox" checked={settings.practice}
              onChange={event => setSettings({ ...settings, practice: event.target.checked })} />{en ? 'Practice first' : '先練習'}
              <small className="training-setting-description">{hints.practice}</small></label>
            <label className="stop-signal-checkbox"><input name="keyGuide" type="checkbox" checked={settings.keyGuide}
              onChange={event => setSettings({ ...settings, keyGuide: event.target.checked })} />{en ? 'Keep the key guide in counted blocks' : '正式階段顯示按鍵提示'}
              <small className="training-setting-description">{hints.keyGuide}</small></label>
            <p className="stop-signal-estimate">{en ? 'Estimated time' : '預估時間'}：{duration(EstimatedSeconds(settings))}{en ? ', plus rests between blocks' : '，另加組間休息'}</p>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="stop-signal-stage stop-signal-running" aria-label={title}>
      <header className="stop-signal-hud">
        <p ref={progressLabelRef} className="stop-signal-progress-label" aria-live="off">{en ? 'Get ready' : '準備開始'}</p>
        <div className="stop-signal-progress-track"><div ref={progressFillRef} className="stop-signal-progress-fill" /></div>
        <button type="button" className="btn btn-ghost stop-signal-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <div ref={areaRef} className="stop-signal-stimulus-area" data-state="ready" data-signal="off">
        <p className="stop-signal-fixation" aria-hidden="true">+</p>
        <span ref={shapeBoxRef} className="stop-signal-stimulus" aria-hidden="true"><StopStar />{[0, 1, 2, 3].map(item => <ShapeIcon key={item} shape={item} />)}</span>
        <p ref={feedbackRef} className="stop-signal-feedback" aria-live="off" />
      </div>
      <div className="stop-signal-pads">
        {(['left', 'right'] as Side[]).map(side => <button key={side} type="button" className={`stop-signal-pad stop-signal-pad-${side}`}
          onPointerDown={event => { event.preventDefault(); runRef.current?.respond(side); }}>
          {guide && <KeyGuide keyMap={keyMap} side={side} />}
          <span>{side === 'left' ? (en ? 'Left' : '左') : (en ? 'Right' : '右')}</span><small>{keyLabels[side]}</small></button>)}
      </div>
      {rest && <section className="training-panel stop-signal-rest" role="dialog" aria-modal="true" aria-labelledby="stop-signal-rest-title">
        <div className="training-config training-confirmation">
          <header className="training-config-header"><h2 id="stop-signal-rest-title">{restHeading}</h2></header>
          <div className="training-config-body"><section className="training-setting"><h3>{en ? 'This part' : '這一段的表現'}</h3>
            <div className="training-config-summary">
              <p className="training-config-summary-item"><strong>{en ? 'Correct key on shapes' : '形狀按對比例'}：</strong>{percent(rest.feedback.goAccuracy)}</p>
              <p className="training-config-summary-item"><strong>{en ? 'Middle press time' : '按下時間中位數'}：</strong>{ms(rest.feedback.medianGoRtMs)}</p>
              {rest.feedback.stopSuccess !== null && <p className="training-config-summary-item"><strong>{en ? 'Held back on stars' : '看到星形成功停住'}：</strong>{percent(rest.feedback.stopSuccess)}</p>}
            </div>
            {rest.feedback.tips.map(tip => <p key={tip} className="stop-signal-tip">{tipText[tip][lang]}</p>)}
            {(rest.after !== 'block' || rest.feedback.tips.includes('accuracy')) && <ol className="stop-signal-rest-keys">
              {(['left', 'right'] as Side[]).map(side => <li key={side}><KeyGuide keyMap={keyMap} side={side} />
                {side === 'left' ? (en ? 'Left button or Z' : '左按鈕或 Z 鍵') : (en ? 'Right button or M' : '右按鈕或 M 鍵')}</li>)}
            </ol>}
            <p>{restNote}</p>
          </section></div>
          <footer className="config-actions"><div className="training-config-navigation-buttons">
            <button ref={continueButtonRef} type="button" className="btn btn-primary stop-signal-continue" onClick={continueAfterRest}>{en ? 'Continue' : '繼續'}</button>
          </div></footer>
        </div>
      </section>}
    </main>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Held back on stars' : '看到星形成功停住'}</p><strong>{percent(summary.stopSuccessRate)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Mean time on correct presses' : '按對形狀的平均時間'}</p><strong>{ms(summary.meanGoRtMs)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Estimated time needed to stop' : '停住所需時間（估計）'}</p><strong>{ms(summary.ssrtMs)}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.slice(0, -1).map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Overall correct' : '整體正確率'}</dt><dd>{percent(summary.accuracy)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Shapes without a press' : '形狀沒有按到'}</dt><dd>{summary.omissionErrors} / {summary.goTrials}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Items with a star' : '出現星形的題數'}</dt><dd>{summary.stopTrials}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Mean star delay' : '星形平均延遲'}</dt><dd>{ms(summary.meanStopDelayMs)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Mean time over every press' : '所有按下的平均時間'}</dt><dd>{ms(summary.meanResponseMs)}</dd></div>
      </dl>
        <p className="score-note">{en ? 'The time needed to stop is estimated from press times and star delays. It cannot be estimated when every star, or no star, was stopped. Practice items are listed below but not counted here.'
          : '停住所需時間是由按下時間與星形延遲推算的估計值；星形全部停住或全部沒停住時無法推算。練習題列在下方明細，但不計入這些統計。'}</p></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}
