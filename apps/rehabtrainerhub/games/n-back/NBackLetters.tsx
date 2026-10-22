import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, EstimatedSeconds, leadInMs, practiceItems, rangeSettings, ValidateSettings, type NBackSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { NBackTutorial } from './rules/NBackTutorial';
import { CreateNBackPlan, CreateNBackStep, CreateRandom, type Answer, type NBackTrial } from './logic/nBackTrials';
import { TrialRun, type RunClock } from './logic/trialRun';
import { SummarizeNBack, type NBackRow } from './logic/nBackScore';
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
interface IntroState { next: number; load: number; block: number; blocks: number; afterPractice: boolean; previousBlock: number; previousAccuracy: number | null }

export const RuleLabel = (load: number, en: boolean) => load === 0 ? (en ? 'Find t' : '找 t') : (en ? `${load} back` : `比對前 ${load} 個`);
export const RuleText = (load: number, en: boolean) => load === 0
  ? (en ? 'Answer "Same" for t or T and "Different" for any other letter.' : '看到 t 或 T 按「相同」，其他字母按「不同」。')
  : (en ? `Answer "Same" when the letter matches the one ${load} ${load === 1 ? 'place' : 'places'} back (case does not matter), otherwise "Different".`
    : `目前字母和前 ${load} 個字母相同時按「相同」（不分大小寫），否則按「不同」。`);

export function NBackLetters() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<NBackSettings>({ ...defaultSettings });
  const [rows, setRows] = useState<NBackRow[]>([]);
  const [intro, setIntro] = useState<IntroState | null>(null);
  const [load, setLoad] = useState(1);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const letterRef = useRef<HTMLParagraphElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const progressLabelRef = useRef<HTMLParagraphElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const runRef = useRef<TrialRun<NBackTrial> | null>(null);
  const runSegmentRef = useRef<((index: number) => void) | null>(null);
  const introRef = useRef(intro);
  introRef.current = intro;
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
  const startNextBlock = useCallback(() => {
    const current = introRef.current;
    if (current) runSegmentRef.current?.(current.next);
  }, []);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setRows([]); setIntro(null); setPhase('menu'); };
    const keys = (event: KeyboardEvent) => {
      if (phaseRef.current !== 'running') return;
      if (event.key === 'Escape') { event.preventDefault(); exit(); return; }
      if (introRef.current) {
        if ((event.key === 'Enter' || event.key === ' ') && !event.repeat && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); startNextBlock(); }
        return;
      }
      const key = event.key.toLowerCase();
      const answer: Answer | null = key === 'arrowleft' || key === 'f' ? 'same' : key === 'arrowdown' || key === 'arrowright' || key === 'j' ? 'different' : null;
      if (answer) { event.preventDefault(); if (!event.repeat) runRef.current?.respond(answer); }
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
  }, [exit, stopRuntime, startNextBlock]);
  useEffect(() => {
    if (phase !== 'menu') return;
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, [phase]);
  useEffect(() => { if (intro) continueButtonRef.current?.focus(); }, [intro]);
  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (phase !== 'running' || !host) return;
    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    const plan = CreateNBackPlan(settings, CreateRandom(Date.now()));
    const blocks = plan.filter(segment => segment.kind === 'block').length;
    const allRows: NBackRow[] = [];
    const setState = (state: string) => { if (areaRef.current) areaRef.current.dataset.state = state; };
    const finish = () => {
      runRef.current = null;
      runSegmentRef.current = null;
      const score = BuildGameScore(allRows, settings);
      jsPsychLifecycleRef.current?.finish({ trials: score.summary.trials, accuracy: score.summary.accuracy });
      PlayGameEndSound('Victory');
      setRows([...allRows]);
      setSaveState(IsHubGame() ? 'saving' : 'local');
      SendGameResult({ ...settings }, score.summary, score.rounds);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      setPhase('results');
    };
    const showIntro = (index: number, previous: NBackRow[] | null, previousBlock: number, afterPractice: boolean) => {
      const segment = plan[index];
      setIntro({ next: index, load: segment.load, block: segment.block, blocks, afterPractice, previousBlock,
        previousAccuracy: previous ? SummarizeNBack(previous.map(row => ({ ...row, practice: false }))).accuracy : null });
    };
    const runSegment = (index: number) => {
      const segment = plan[index];
      setIntro(null);
      setLoad(segment.load);
      setState('ready');
      if (progressLabelRef.current) progressLabelRef.current.textContent = enRef.current ? 'Get ready' : '準備開始';
      if (progressFillRef.current) progressFillRef.current.style.width = '0%';
      const segmentRows: NBackRow[] = [];
      const total = segment.trials.length;
      const run = new TrialRun<NBackTrial>(total, item => CreateNBackStep(segment.trials[item], settings), {
        lead: () => undefined,
        show: (step, item) => {
          if (feedbackRef.current) { feedbackRef.current.textContent = ''; delete feedbackRef.current.dataset.result; }
          if (letterRef.current) letterRef.current.textContent = step.trial.letter;
          const english = enRef.current;
          if (progressLabelRef.current) progressLabelRef.current.textContent = segment.kind === 'block'
            ? (english ? `Block ${segment.block} of ${blocks} · ${item + 1}/${total}` : `第 ${segment.block} 組（共 ${blocks} 組）· ${item + 1}／${total}`)
            : (english ? `Practice ${item + 1} of ${total}` : `練習 ${item + 1}／${total}`);
          if (progressFillRef.current) progressFillRef.current.style.width = `${(item + 1) / total * 100}%`;
          setState('target');
        },
        hide: () => setState('waiting'),
        signal: () => undefined,
        end: (outcome, feedback) => {
          const trial = outcome.trial;
          const response = outcome.response as Answer | null;
          const row: NBackRow = { trial: allRows.length + 1, practice: trial.practice, load: trial.load, letter: trial.letter, match: trial.match, response, rtMs: outcome.rtMs };
          allRows.push(row);
          segmentRows.push(row);
          if (!feedback) { setState('blank'); return; }
          setState('feedback');
          if (!feedbackRef.current) return;
          const english = enRef.current;
          const correct = response === (trial.match ? 'same' : 'different');
          feedbackRef.current.dataset.result = correct ? 'correct' : 'wrong';
          feedbackRef.current.textContent = correct ? (english ? 'Correct' : '答對了')
            : response === null ? (english ? 'Too slow. Answer a little faster.' : '太慢了，請快一點。')
              : trial.match ? (english ? `This letter matched the one ${trial.load} back.` : `這個字母和前 ${trial.load} 個相同。`)
                : (english ? `This letter differed from the one ${trial.load} back.` : `這個字母和前 ${trial.load} 個不同。`);
        },
        clear: () => setState('blank'),
      }, browserClock, () => {
        runRef.current = null;
        if (index === plan.length - 1) finish();
        else showIntro(index + 1, segmentRows, segment.block, segment.kind === 'practice');
      }, leadInMs);
      runRef.current = run;
      run.start();
    };
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:n-back', onStart: () => {
      runSegmentRef.current = runSegment;
      if (plan[0].kind === 'practice') runSegment(0);
      else showIntro(0, null, 0, false);
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
    setIntro(null);
    setLoad(1);
    setPhase('running');
  };

  const duration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60), extra = seconds % 60;
    const parts = en ? [minutes && `${minutes} min`, extra && `${extra} s`] : [minutes && `${minutes} 分`, extra && `${extra} 秒`];
    return `${en ? 'at most about' : '最長約'} ${parts.filter(Boolean).join(' ')}`;
  };
  const unit = (field: typeof rangeSettings[number]) => en ? (field.unitEn ? ` ${field.unitEn}` : '') : ` ${field.unitZh}`;
  const hints: Record<string, string> = en ? {
    exposureMs: 'How long each letter stays on screen. You can answer for up to 2 s from when it appears.',
    rounds: 'Counted letters, in blocks of 50. The blocks are one "find t" block (first or last) and two blocks each of 1, 2 and 3 back.',
    practice: `${practiceItems} practice letters (1 back) with feedback come first. The counted letters give no feedback.`,
  } : {
    exposureMs: '每個字母顯示多久；從字母出現起 2 秒內都可以作答。',
    rounds: '計入成果的字母數，每 50 個一組：一組「找 t」（排在最前或最後），以及比對前 1、2、3 個各兩組。',
    practice: `正式開始前先做 ${practiceItems} 個練習（比對前 1 個），會提示對錯；正式字母不再提示。`,
  };
  const summaryItems = [
    ...rangeSettings.map(field => ({ label: en ? field.en : field.zh, value: `${settings[field.key]}${unit(field)}` })),
    { label: en ? 'Practice first' : '先練習', value: settings.practice ? (en ? `Yes, ${practiceItems} letters` : `是，${practiceItems} 個`) : (en ? 'No' : '否') },
    { label: en ? 'Estimated time' : '預估時間', value: `${duration(EstimatedSeconds(settings))}${en ? ', plus rests' : '，另加休息時間'}` },
  ];
  const score = BuildGameScore(rows, settings);
  const summary = score.summary;
  const missing = en ? 'N/A' : '無';
  const ms = (value: number | null) => value === null ? missing : `${value} ms`;
  const percent = (value: number | null) => value === null ? missing : `${value}%`;
  return <div ref={rootRef} className="n-back-game-root">
    <div ref={jsPsychHostRef} className="n-back-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <NBackTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog n-back-phase-menu" aria-labelledby="n-back-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="n-back-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            {rangeSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}：<output>{settings[field.key]}{unit(field)}</output>
              <input name={field.key} type="range" min={field.min} max={field.max} step={field.step} value={settings[field.key]}
                onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })} />
              <small className="training-setting-description">{hints[field.key]}</small></label>)}
            <label className="n-back-checkbox"><input name="practice" type="checkbox" checked={settings.practice}
              onChange={event => setSettings({ ...settings, practice: event.target.checked })} />{en ? 'Practice first' : '先練習'}
              <small className="training-setting-description">{hints.practice}</small></label>
            <p className="n-back-estimate">{en ? 'Estimated time' : '預估時間'}：{duration(EstimatedSeconds(settings))}{en ? '; answering sooner ends each letter sooner' : '；作答越快，結束越早'}</p>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="n-back-stage n-back-running" aria-label={title}>
      <header className="n-back-hud">
        <p ref={progressLabelRef} className="n-back-progress-label" aria-live="off">{en ? 'Get ready' : '準備開始'}</p>
        <p className="n-back-rule">{RuleLabel(load, en)}</p>
        <div className="n-back-progress-track"><div ref={progressFillRef} className="n-back-progress-fill" /></div>
        <button type="button" className="btn btn-ghost n-back-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <div ref={areaRef} className="n-back-stimulus-area" data-state="ready" aria-hidden="true">
        <p ref={letterRef} className="n-back-letter">b</p>
        <p ref={feedbackRef} className="n-back-feedback" aria-live="off" />
      </div>
      <div className="n-back-pads">
        {(['same', 'different'] as Answer[]).map(answer => <button key={answer} type="button" className={`n-back-pad n-back-pad-${answer}`}
          onPointerDown={event => { event.preventDefault(); runRef.current?.respond(answer); }}>
          {answer === 'same' ? (en ? 'Same' : '相同') : (en ? 'Different' : '不同')}<small>{answer === 'same' ? '← / F' : '↓ / J'}</small></button>)}
      </div>
      {intro && <section className="training-panel n-back-intro" role="dialog" aria-modal="true" aria-labelledby="n-back-intro-title">
        <div className="training-config training-confirmation">
          <header className="training-config-header"><h2 id="n-back-intro-title">{intro.afterPractice ? (en ? 'Practice done' : '練習結束')
            : intro.previousBlock ? (en ? `Block ${intro.previousBlock} of ${intro.blocks} done` : `第 ${intro.previousBlock} 組完成（共 ${intro.blocks} 組）`)
              : (en ? 'Counted letters' : '正式字母')}</h2></header>
          <div className="training-config-body"><section className="training-setting">
            {intro.previousAccuracy !== null && <p className="training-config-summary-item"><strong>{en ? 'Correct in the last part' : '上一段正確率'}：</strong>{percent(intro.previousAccuracy)}</p>}
            <h3>{en ? `Next: block ${intro.block} of ${intro.blocks}, ${RuleLabel(intro.load, true)}` : `下一組：第 ${intro.block} 組（共 ${intro.blocks} 組），${RuleLabel(intro.load, false)}`}</h3>
            <p className="n-back-intro-rule">{RuleText(intro.load, en)}</p>
            <p>{intro.afterPractice ? (en ? 'Counted letters give no feedback. Take a short rest if you need one.' : '正式字母不提示對錯。需要的話先休息一下。')
              : (en ? 'Take a short rest and start when you are ready.' : '休息一下，準備好再開始。')}</p>
          </section></div>
          <footer className="config-actions"><div className="training-config-navigation-buttons">
            <button ref={continueButtonRef} type="button" className="btn btn-primary n-back-continue" onClick={startNextBlock}>{en ? 'Start this block' : '開始這一組'}</button>
          </div></footer>
        </div>
      </section>}
    </main>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Correct' : '正確率'}</p><strong>{percent(summary.accuracy)}</strong></div>
        <div className="score-key-metric"><p>{en ? '"Same" on matching letters' : '相同字母答「相同」'}</p><strong>{percent(summary.hitRate)}</strong></div>
        <div className="score-key-metric"><p>{en ? '"Same" on other letters' : '不同字母誤答「相同」'}</p><strong>{percent(summary.falseAlarmRate)}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.slice(0, -1).map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        {([0, 1, 2, 3] as const).map(level => <div className="score-context-item" key={level}><dt>{en ? `Correct, ${RuleLabel(level, true)}` : `正確率：${RuleLabel(level, false)}`}</dt>
          <dd>{percent(summary[`load${level}Accuracy`])}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'No answer in time' : '未及時作答'}</dt><dd>{summary.misses}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Mean answer time' : '平均作答時間'}</dt><dd>{ms(summary.meanResponseMs)}</dd></div>
      </dl>
        <p className="score-note">{en ? 'Blocks not reached in a shorter session show N/A. Practice letters are listed below but not counted here.'
          : '較短的流程沒有做到的組別會顯示「無」。練習字母列在下方明細，但不計入這些統計。'}</p></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}
