import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, EstimatedSeconds, NextSettings, SymbolPx, ValidateSettings, ViewingDistanceCm, type SearchSettings } from './settings';
import { gameDefinition, LevelLabel, levels } from './logic/levels';
import { CreateRandom, CreateSearchBlocks, SearchTiming, type SearchTrial } from './logic/searchTrials';
import { BlockStatistics, type SearchRow } from './logic/searchScore';
import { TrialRun, type RunClock } from './logic/trialRun';
import { BuildGameScore, ToRow } from './score';
import { Glyph } from './Glyph';
import { ScoreAnalysis } from './ScoreAnalysis';
import { ComplexSearchTutorial } from './rules/ComplexSearchTutorial';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayFailureSound, PlayGameEndSound, PlayMidiMusic, PlaySuccessSound, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

const browserClock: RunClock = { now: () => performance.now(), set: (callback, ms) => window.setTimeout(callback, ms), clear: timer => window.clearTimeout(timer) };
const answers: Record<string, string> = { f: '1', arrowleft: '1', j: '0', arrowright: '0' };
type Phase = 'menu' | 'rules' | 'running' | 'rest' | 'results';

export function ComplexSearchGame() {
  const { lang } = useT();
  const en = lang === 'en';
  const title = gameDefinition.title[lang];
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<SearchSettings>({ ...defaultSettings });
  const [rows, setRows] = useState<SearchRow[]>([]);
  const rowsRef = useRef<SearchRow[]>([]);
  const [blockIndex, setBlockIndex] = useState(0);
  const [trial, setTrial] = useState<SearchTrial | null>(null);
  const [symbolPx, setSymbolPx] = useState(24);
  const [layoutError, setLayoutError] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const progressLabelRef = useRef<HTMLParagraphElement>(null);
  const restButtonRef = useRef<HTMLButtonElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const runRef = useRef<TrialRun<SearchTrial> | null>(null);
  const generationRef = useRef(0);
  const startingRef = useRef(false);
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
    const lifecycle = jsPsychLifecycleRef.current;
    if (lifecycle) lifecycle.dispose();
    jsPsychLifecycleRef.current = null;
    StopMidiMusic();
    DisposeAudioFeedback();
  }, []);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); rowsRef.current = []; setRows([]); setBlockIndex(0); setPhase('menu'); };
    const keys = (event: KeyboardEvent) => {
      if (!['running', 'rest'].includes(phaseRef.current)) return;
      if (event.key === 'Escape') { event.preventDefault(); exit(); return; }
      const response = answers[event.key.toLowerCase()];
      if (phaseRef.current === 'running' && response !== undefined) { event.preventDefault(); if (!event.repeat) runRef.current?.respond(response); }
    };
    const pagehide = () => { stopRuntime(); if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined); };
    window.addEventListener('game:saved', saved); window.addEventListener('game:configure', configure);
    window.addEventListener('keydown', keys, true); window.addEventListener('pagehide', pagehide);
    return () => {
      window.removeEventListener('game:saved', saved); window.removeEventListener('game:configure', configure);
      window.removeEventListener('keydown', keys, true); window.removeEventListener('pagehide', pagehide); pagehide();
    };
  }, [exit, stopRuntime]);
  useEffect(() => {
    if (phase !== 'menu') return;
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, [phase]);
  useEffect(() => { if (phase === 'rest') restButtonRef.current?.focus(); }, [phase]);
  useEffect(() => {
    if (phase !== 'running' || !fieldRef.current || !jsPsychHostRef.current) return;
    const field = fieldRef.current;
    const rect = field.getBoundingClientRect();
    const pixels = SymbolPx(window.screen.width, settings.symbolSizeDeg);
    setSymbolPx(pixels);
    let block: SearchTrial[];
    try {
      block = CreateSearchBlocks(settings, CreateRandom(Date.now()), { width: rect.width, height: rect.height, symbolPx: pixels, circleRadius: pixels * 1.25 })[blockIndex];
    } catch {
      setLayoutError(true); setPhase('rest'); return;
    }
    const setState = (state: string) => { field.dataset.state = state; };
    const finish = (outcomes: Parameters<typeof ToRow>[0][]) => {
      runRef.current = null;
      const completed = [...rowsRef.current, ...outcomes.map(outcome => ToRow(outcome, settings.timeLimitMs, settings.trialsPerBlock))];
      rowsRef.current = completed; setRows(completed);
      if (blockIndex < 2) { setBlockIndex(blockIndex + 1); setLayoutError(false); setPhase('rest'); return; }
      const score = BuildGameScore(completed, settings);
      jsPsychLifecycleRef.current?.finish({ trials: completed.length, accuracy_percent: score.summary.accuracy });
      PlayGameEndSound(score.summary.passed ? 'Victory' : 'Defeat');
      setSaveState(IsHubGame() ? 'saving' : 'local');
      SendGameResult({ ...settings }, score.summary, score.rounds);
      SaveGameSettings(NextSettings(settings, Boolean(score.summary.passed)));
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      setPhase('results');
    };
    const run = new TrialRun<SearchTrial>(block.length, index => ({ trial: block[index], timing: SearchTiming(settings.timeLimitMs) }), {
      lead: (state, step, index) => {
        setTrial(step.trial); setState(state);
        field.dataset.trial = String((blockIndex * settings.trialsPerBlock) + index + 1);
        field.dataset.present = String(Number(step.trial.present));
        if (feedbackRef.current) feedbackRef.current.textContent = '';
        if (progressLabelRef.current) progressLabelRef.current.textContent = enRef.current
          ? `Level ${levels[settings.level - 1].globalLevel}, block ${blockIndex + 1} (${step.trial.setSize} letters), item ${index + 1}/${block.length}`
          : `等級 ${levels[settings.level - 1].globalLevel}，第 ${blockIndex + 1} 段（${step.trial.setSize} 個字），第 ${index + 1}／${block.length} 題`;
      },
      show: () => setState('target'), hide: () => undefined, signal: () => undefined,
      end: outcome => {
        setState('feedback');
        const correct = outcome.response === String(Number(outcome.trial.present));
        if (correct) PlaySuccessSound(); else PlayFailureSound();
        if (feedbackRef.current) {
          feedbackRef.current.dataset.result = correct ? 'correct' : 'wrong';
          feedbackRef.current.textContent = correct ? (enRef.current ? 'Correct' : '答對了')
            : outcome.response === null ? (enRef.current ? 'Time is up' : '超過時間') : (enRef.current ? 'Incorrect' : '答錯了');
        }
      },
      clear: () => setState('gap'),
    }, browserClock, finish, 0);
    runRef.current = run;
    if (!jsPsychLifecycleRef.current) {
      const lifecycle = new JsPsychExternalLifecycle(initJsPsych({ display_element: jsPsychHostRef.current }));
      jsPsychLifecycleRef.current = lifecycle;
      void jsPsychLifecycleRef.current?.start({ moduleId: `vision:${gameDefinition.id}`, onStart: () => { if (runRef.current === run) run.start(); } });
    } else run.start();
    // Resizing changes the visual angles and spacing. Restart only the unfinished block after an explicit continue.
    const resized = () => {
      const current = field.getBoundingClientRect();
      if (Math.abs(current.width - rect.width) <= 1 && Math.abs(current.height - rect.height) <= 1) return;
      run.stop();
      if (field.dataset.state === 'lead' && field.dataset.trial === String(blockIndex * settings.trialsPerBlock + 1)) {
        setLayoutVersion(value => value + 1);
      } else { setLayoutError(true); setPhase('rest'); }
    };
    window.addEventListener('resize', resized);
    return () => { run.stop(); if (runRef.current === run) runRef.current = null; window.removeEventListener('resize', resized); };
  }, [phase, blockIndex, settings, layoutVersion]);

  const confirmSettings = () => {
    if (!formRef.current?.reportValidity() || !ValidateSettings(settings)) return;
    SaveGameSettings(settings); setPhase('rules');
  };
  const startTraining = async () => {
    if (startingRef.current || phaseRef.current !== 'rules' || !ValidateSettings(settings)) return;
    startingRef.current = true;
    const generation = generationRef.current;
    PrepareAudioFeedback();
    try { await rootRef.current?.requestFullscreen?.(); } catch { /* Keep windowed input available when fullscreen is unavailable. */ }
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    startingRef.current = false;
    if (generation !== generationRef.current || phaseRef.current !== 'rules') {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      return;
    }
    rowsRef.current = []; setRows([]); setBlockIndex(0); setLayoutError(false);
    SendGameEvent('active'); setPhase('running');
  };

  const level = levels[settings.level - 1];
  const timeLabel = (value: number) => value === 0 ? (en ? 'No time limit' : '不限時間') : `${value / 1000} ${en ? 's' : '秒'}`;
  const estimate = EstimatedSeconds(settings);
  const summaryItems = [
    { label: en ? 'Level' : '等級', value: LevelLabel(level, en) },
    { label: en ? 'Answer time' : '每題時間', value: timeLabel(settings.timeLimitMs) },
    { label: en ? 'Trials per block' : '每段題數', value: String(settings.trialsPerBlock) },
    { label: en ? 'Symbol size' : '字形大小', value: `${settings.symbolSizeDeg}°` },
    { label: en ? 'Screen width' : '螢幕寬度', value: `${settings.screenWidthCm} cm` },
    { label: en ? 'Estimated time (breaks excluded)' : '預估時間（不含休息）', value: estimate === null ? (en ? 'Depends on answer speed' : '依作答速度而定') : `${en ? 'Up to about' : '最多約'} ${Math.ceil(estimate / 60)} ${en ? 'min' : '分'}` },
  ];
  const score = BuildGameScore(rows, settings);
  const summary = score.summary;
  const next = NextSettings(settings, Boolean(summary.passed));
  const missing = en ? 'N/A' : '無';
  const ms = (value: number | null) => value === null ? missing : `${value} ms`;
  const percent = (value: number | null) => value === null ? missing : `${value}%`;
  const rest = BlockStatistics(rows.filter(row => row.block === blockIndex));
  return <div ref={rootRef} className={`${gameDefinition.id}-game-root search-game-root`}>
    <div ref={jsPsychHostRef} className="search-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <ComplexSearchTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog search-phase-menu" aria-labelledby="search-settings-title" onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="search-settings-title">{title}</h2></header>
        <div className="training-config-body"><section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
          <label>{en ? 'Level' : '等級'}<select name="level" value={settings.level} onChange={event => setSettings({ ...settings, level: Number(event.target.value) })}>
            {levels.map((item, i) => <option key={item.globalLevel} value={i + 1}>{LevelLabel(item, en)}</option>)}
          </select></label>
          <label>{en ? 'Time per trial' : '每題時間'}<select name="timeLimitMs" value={settings.timeLimitMs} onChange={event => setSettings({ ...settings, timeLimitMs: Number(event.target.value) })}>
            {[1500, 2000, 0].map(value => <option key={value} value={value}>{timeLabel(value)}</option>)}
          </select><small className="training-setting-description">{en ? 'Start at 1.5 s. A repeated level uses 2 s; after another failed attempt it has no time limit.' : '從 1.5 秒開始；未通過時下次改為 2 秒，再次未通過則不限時間。'}</small></label>
          <label>{en ? 'Trials per block' : '每段題數'}<select name="trialsPerBlock" value={settings.trialsPerBlock} onChange={event => setSettings({ ...settings, trialsPerBlock: Number(event.target.value) })}>
            {[20, 50, 100, 200].map(value => <option key={value} value={value}>{value}</option>)}
          </select><small className="training-setting-description">{en ? 'Three blocks of 8, 16 and 24 letters. Half the trials contain a target. The source uses 200 trials per block.' : '依序做 8、16、24 個字的三段。每段一半題目有目標，文獻採每段 200 題。'}</small></label>
          <label>{en ? 'Symbol size' : '字形大小'}：<output>{settings.symbolSizeDeg.toFixed(1)}°</output>
            <input name="symbolSizeDeg" type="range" min="1.4" max="1.8" step="0.1" value={settings.symbolSizeDeg} onChange={event => setSettings({ ...settings, symbolSizeDeg: Number(event.target.value) })} />
            <small className="training-setting-description">{en ? 'Start at 1.4° and increase it until every letter is easy to see.' : '從 1.4° 開始，調大至每個字都容易看清楚。'}</small></label>
          <label>{en ? 'Visible screen width (cm)' : '螢幕可見畫面寬度（公分）'}<input name="screenWidthCm" type="number" required min="15" max="80" step="0.5" value={settings.screenWidthCm} onChange={event => setSettings({ ...settings, screenWidthCm: Number(event.target.value) })} />
            <small className="training-setting-description">{en ? 'Measure the visible picture from the left edge to the right edge of your screen.' : '請量螢幕可見畫面從左邊到右邊的寬度。'}</small></label>
          <p className="search-distance">{en ? 'Recommended viewing distance' : '建議觀看距離'}：{ViewingDistanceCm(settings.screenWidthCm)} {en ? 'cm' : '公分'}</p>
          <p>{summaryItems.at(-1)!.label}：{summaryItems.at(-1)!.value}</p>
          <p className="search-source">{en ? 'Levels and rules refer to Sahraie, Smania & Zihl (2016).' : '等級與規則參考 Sahraie、Smania 與 Zihl（2016）。'}</p>
        </section></div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {(phase === 'running' || phase === 'rest') && <main className="search-stage search-running" aria-label={title}>
      <header className="search-hud"><p ref={progressLabelRef} className="search-progress-label">{en ? 'Get ready' : '準備開始'}</p>
        <button type="button" className="btn btn-ghost search-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button></header>
      <div ref={fieldRef} className="search-field" data-state="lead" style={{ '--symbol-px': `${symbolPx}px` } as CSSProperties}>
        <div className="search-target-circle"><span className="search-example"><Glyph stimulus={level.target} /></span></div>
        <div className="search-items" aria-hidden="true">{trial?.items.map((item, i) => <span key={i} className="search-item" data-target={item.target}
          data-quadrant={item.quadrant} style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }}><Glyph stimulus={item} /></span>)}</div>
        <p ref={feedbackRef} className="search-feedback" />
      </div>
      <div className="search-pads">{(['1', '0'] as const).map(response => <button key={response} type="button" className={`search-pad search-pad-${response}`}
        onClick={() => runRef.current?.respond(response)}>{response === '1' ? (en ? 'Present' : '有') : (en ? 'Absent' : '沒有')}<small>{response === '1' ? 'F / ←' : 'J / →'}</small></button>)}</div>
      {phase === 'rest' && <section className="search-rest" role="dialog" aria-modal="true" aria-labelledby="search-rest-title" onKeyDown={event => {
        if (event.key === 'Tab') { event.preventDefault(); const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button')); const i = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[(i + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus(); }
      }}>
        <h2 id="search-rest-title">{layoutError ? (en ? 'Adjust the window' : '請調整畫面') : (en ? 'Take a break' : '休息一下')}</h2>
        {layoutError ? <p>{en ? 'The field changed or is too small for the selected letter size. Enlarge the window or rotate the screen, then restart this block. Completed blocks are kept.' : '畫面尺寸已變更，或放不下選定大小的字形。請放大視窗或旋轉螢幕，再重做這一段。已完成的段落會保留。'}</p>
          : <p>{en ? `Block ${blockIndex}: ${percent(rest.accuracy)}. ${rest.passed ? 'Reached 85%.' : 'Below 85%.'} Continue when ready.` : `第 ${blockIndex} 段：${percent(rest.accuracy)}，${rest.passed ? '達到 85%。' : '未達 85%。'}準備好再繼續。`}</p>}
        <button ref={restButtonRef} type="button" className="btn btn-primary search-continue" onClick={() => { setLayoutError(false); setPhase('running'); }}>{en ? 'Continue' : '繼續'}</button>
        <button type="button" className="btn btn-ghost" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </section>}
    </main>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Level result' : '等級結果'}</p><strong>{summary.passed ? (en ? 'Passed' : '通過') : (en ? 'Repeat this level' : '再做這一級')}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Accuracy' : '正確率'}</p><strong>{percent(summary.accuracy)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Correct present: mean time' : '答對有目標題：平均時間'}</p><strong>{ms(summary.presentRtMs)}</strong></div>
      </div><p>{en ? 'A level passes when at least 2 of its 3 blocks reach 85% accuracy.' : '三段中至少兩段的正確率達到 85%，就通過這一級。'}</p></section>
      <section className="score-context"><h2>{en ? 'Block results' : '各段成果'}</h2>
        <div className="results-scroll" tabIndex={0} role="region" aria-label={en ? 'Block results' : '各段成果'}><table className="results-table"><thead><tr>
          {[en ? 'Letters' : '字數', en ? 'Accuracy' : '正確率', en ? 'Reached 85%' : '達到 85%', en ? 'Present RT' : '有目標時間', en ? 'Absent RT' : '無目標時間', en ? 'Timeouts' : '超時'].map(label => <th scope="col" key={label}>{label}</th>)}
        </tr></thead><tbody>{[8, 16, 24].map(size => { const block = BlockStatistics(rows.filter(row => row.setSize === size)); return <tr key={size}><td>{size}</td><td>{percent(block.accuracy)}</td><td>{block.passed ? (en ? 'Yes' : '是') : (en ? 'No' : '否')}</td><td>{ms(block.presentRtMs)}</td><td>{ms(block.absentRtMs)}</td><td>{block.timeouts}</td></tr>; })}</tbody></table></div>
        <dl className="score-context-list">
          <div className="score-context-item"><dt>{en ? 'Correct present on left' : '左側目標答對時間'}</dt><dd>{ms(summary.leftRtMs)}</dd></div>
          <div className="score-context-item"><dt>{en ? 'Correct present on right' : '右側目標答對時間'}</dt><dd>{ms(summary.rightRtMs)}</dd></div>
          <div className="score-context-item"><dt>{en ? 'Search slope (ms/letter)' : '搜尋斜率（毫秒／字）'}</dt><dd>{summary.slopeMsPerItem ?? missing}</dd></div>
          {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        </dl><p>{en ? 'The slope is the extra mean time per added letter, using correct target-present answers. Timeouts count as wrong; times use correct answers only.' : '斜率表示每多一個字，答對有目標題時平均多花的時間。超時算答錯；時間只計算答對的題目。'}</p>
        {summary.passed === 1 && settings.level === 4 && <p className="search-completed">{gameDefinition.next
          ? (en ? `All four levels of this type passed. Next activity: ${gameDefinition.next.title.en}.` : `這一類的四級已通過。下一款：${gameDefinition.next.title.zh}。`)
          : (en ? 'All 12 search levels completed.' : '十二級視覺搜尋已完成。')}</p>}
        <p className="search-next-settings">{en ? `Next time: level ${levels[next.level - 1].globalLevel}, ${timeLabel(next.timeLimitMs)} per trial. You can edit these settings.` : `下次開啟會使用：等級 ${levels[next.level - 1].globalLevel}，每題${timeLabel(next.timeLimitMs)}。設定仍可修改。`}</p>
      </section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}
