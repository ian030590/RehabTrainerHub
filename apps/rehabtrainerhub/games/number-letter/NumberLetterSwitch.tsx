import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, EstimatedSeconds, leadInMs, practiceItems, rangeSettings, ValidateSettings, type NumberLetterSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { NumberLetterTutorial } from './rules/NumberLetterTutorial';
import { CorrectAnswer, CreateNumberLetterPlan, CreateNumberLetterStep, CreateRandom, vowels, type Answer, type NumberLetterSegment, type NumberLetterTrial } from './logic/numberLetterTrials';
import { TrialRun, type RunClock } from './logic/trialRun';
import { IsCorrect, SummarizeNumberLetter, type NumberLetterRow } from './logic/numberLetterScore';
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
type Kind = NumberLetterSegment['kind'];
interface IntroState { next: number; kind: Kind; part: number; parts: number; items: number; afterPractice: boolean; previousAccuracy: number | null }

export const RuleLabel = (kind: Kind, en: boolean) => kind === 'number' ? (en ? 'Numbers' : '數字題') : kind === 'letter' ? (en ? 'Letters' : '字母題') : (en ? 'Switching' : '上下切換');
export const RuleText = (kind: Kind, en: boolean) => kind === 'number'
  ? (en ? 'Pairs appear only in the top half. Press Z (left) for an odd number and M (right) for an even number. Ignore the letter.'
    : '組合只會出現在上半部。數字是奇數按 Z（左），偶數按 M（右），不用管字母。')
  : kind === 'letter'
    ? (en ? 'Pairs appear only in the bottom half. Press Z (left) for a consonant and M (right) for a vowel (A, E, I, U). Ignore the number.'
      : '組合只會出現在下半部。字母是子音按 Z（左），母音（A、E、I、U）按 M（右），不用管數字。')
    : (en ? 'Pairs move clockwise around the four boxes. In the top half judge the number (odd Z, even M); in the bottom half judge the letter (consonant Z, vowel M).'
      : '組合會順時針在四格輪流出現。在上半部看數字（奇數 Z、偶數 M），在下半部看字母（子音 Z、母音 M）。');

export function NumberLetterSwitch() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<NumberLetterSettings>({ ...defaultSettings });
  const [rows, setRows] = useState<NumberLetterRow[]>([]);
  const [intro, setIntro] = useState<IntroState | null>(null);
  const [kind, setKind] = useState<Kind>('practice');
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const pairRef = useRef<HTMLParagraphElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const progressLabelRef = useRef<HTMLParagraphElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const runRef = useRef<TrialRun<NumberLetterTrial> | null>(null);
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
  const startNextPart = useCallback(() => {
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
        if ((event.key === 'Enter' || event.key === ' ') && !event.repeat && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); startNextPart(); }
        return;
      }
      const key = event.key.toLowerCase();
      const answer: Answer | null = key === 'z' || key === 'arrowleft' ? 'z' : key === 'm' || key === 'arrowright' ? 'm' : null;
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
  }, [exit, stopRuntime, startNextPart]);
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
    const plan = CreateNumberLetterPlan(settings, CreateRandom(Date.now()));
    const parts = plan.filter(segment => segment.kind !== 'practice').length;
    const allRows: NumberLetterRow[] = [];
    const setState = (state: string) => { if (boardRef.current) boardRef.current.dataset.state = state; };
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
    const partNumber = (index: number) => plan.slice(0, index + 1).filter(segment => segment.kind !== 'practice').length;
    const showIntro = (index: number, previous: NumberLetterRow[] | null, afterPractice: boolean) => {
      const segment = plan[index];
      setIntro({ next: index, kind: segment.kind, part: partNumber(index), parts, items: segment.trials.length, afterPractice,
        previousAccuracy: previous ? SummarizeNumberLetter(previous.map(row => ({ ...row, practice: false }))).accuracy : null });
    };
    const explain = (trial: NumberLetterTrial, english: boolean) => {
      const key = CorrectAnswer(trial) === 'z' ? 'Z' : 'M';
      if (trial.position.startsWith('top')) {
        const odd = trial.number % 2 === 1;
        return english ? `Top half: look at the number. ${trial.number} is ${odd ? 'odd' : 'even'}, so press ${key}.` : `上半部看數字：${trial.number} 是${odd ? '奇數' : '偶數'}，要按 ${key}。`;
      }
      const vowel = vowels.includes(trial.letter);
      return english ? `Bottom half: look at the letter. ${trial.letter} is a ${vowel ? 'vowel' : 'consonant'}, so press ${key}.` : `下半部看字母：${trial.letter} 是${vowel ? '母音' : '子音'}，要按 ${key}。`;
    };
    const runSegment = (index: number) => {
      const segment = plan[index];
      setIntro(null);
      setKind(segment.kind);
      setState('ready');
      if (progressLabelRef.current) progressLabelRef.current.textContent = enRef.current ? 'Get ready' : '準備開始';
      if (progressFillRef.current) progressFillRef.current.style.width = '0%';
      const segmentRows: NumberLetterRow[] = [];
      const total = segment.trials.length;
      const part = partNumber(index);
      const run = new TrialRun<NumberLetterTrial>(total, item => CreateNumberLetterStep(segment.trials[item], settings), {
        lead: () => undefined,
        show: (step, item) => {
          if (feedbackRef.current) { feedbackRef.current.textContent = ''; delete feedbackRef.current.dataset.result; }
          if (pairRef.current) pairRef.current.textContent = `${step.trial.letter}${step.trial.number}`;
          if (boardRef.current) boardRef.current.dataset.position = step.trial.position;
          const english = enRef.current;
          if (progressLabelRef.current) progressLabelRef.current.textContent = segment.kind === 'practice'
            ? (english ? `Practice ${item + 1} of ${total}` : `練習 ${item + 1}／${total}`)
            : (english ? `Part ${part} of ${parts} · ${item + 1}/${total}` : `第 ${part} 段（共 ${parts} 段）· ${item + 1}／${total}`);
          if (progressFillRef.current) progressFillRef.current.style.width = `${(item + 1) / total * 100}%`;
          setState('target');
        },
        hide: () => undefined,
        signal: () => undefined,
        end: (outcome, feedback) => {
          const trial = outcome.trial;
          const row: NumberLetterRow = { trial: allRows.length + 1, practice: trial.practice, letter: trial.letter, number: trial.number, position: trial.position,
            condition: trial.condition, switched: trial.switched, response: outcome.response as Answer | null, rtMs: outcome.rtMs };
          allRows.push(row);
          segmentRows.push(row);
          if (!feedback) { setState('blank'); return; }
          setState('feedback');
          if (!feedbackRef.current) return;
          const english = enRef.current;
          const correct = IsCorrect(row);
          feedbackRef.current.dataset.result = correct ? 'correct' : 'wrong';
          feedbackRef.current.textContent = correct ? (english ? 'Correct' : '答對了')
            : `${row.response === null ? (english ? 'Time is up. ' : '時間到。') : ''}${explain(trial, english)}`;
        },
        clear: () => setState('blank'),
      }, browserClock, () => {
        runRef.current = null;
        if (index === plan.length - 1) finish();
        else showIntro(index + 1, segmentRows, segment.kind === 'practice');
      }, leadInMs);
      runRef.current = run;
      run.start();
    };
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:number-letter', onStart: () => {
      runSegmentRef.current = runSegment;
      if (plan[0].kind === 'practice') runSegment(0);
      else showIntro(0, null, false);
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
    setKind('practice');
    setPhase('running');
  };

  const duration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60), extra = seconds % 60;
    const parts = en ? [minutes && `${minutes} min`, extra && `${extra} s`] : [minutes && `${minutes} 分`, extra && `${extra} 秒`];
    const text = parts.filter(Boolean).join(' ');
    return settings.responseWindowMs ? `${en ? 'at most about' : '最長約'} ${text}` : `${en ? 'about' : '約'} ${text}${en ? ', depending on answer speed' : '（依作答速度而定）'}`;
  };
  const value = (field: typeof rangeSettings[number]) => field.key === 'responseWindowMs' && settings.responseWindowMs === 0 ? (en ? 'No limit' : '不限時')
    : `${settings[field.key]}${en ? (field.unitEn ? ` ${field.unitEn}` : '') : ` ${field.unitZh}`}`;
  const hints: Record<string, string> = en ? {
    responseWindowMs: 'Time allowed for each pair. 0 means no limit, as in the original task; each pair waits for your answer.',
    rounds: 'Counted items: 32 with numbers on top, 32 with letters below, then the rest moving clockwise. Fewer items shorten only the last part.',
    practice: `${practiceItems} practice items with feedback come first, moving clockwise. The counted items give no feedback.`,
  } : {
    responseWindowMs: '每個組合可作答的時間。0 代表不限時（與原作業相同），會等你作答。',
    rounds: '計入成果的題數：先 32 題上半部數字題、32 題下半部字母題，其餘為順時針輪流的切換題。題數較少時只縮短最後一段。',
    practice: `正式開始前先做 ${practiceItems} 題順時針輪流的練習，會提示對錯；正式題目不再提示。`,
  };
  const summaryItems = [
    ...rangeSettings.map(field => ({ label: en ? field.en : field.zh, value: value(field) })),
    { label: en ? 'Practice first' : '先練習', value: settings.practice ? (en ? `Yes, ${practiceItems} items` : `是，${practiceItems} 題`) : (en ? 'No' : '否') },
    { label: en ? 'Estimated time' : '預估時間', value: `${duration(EstimatedSeconds(settings))}${en ? ', plus rests' : '，另加休息時間'}` },
  ];
  const score = BuildGameScore(rows, settings);
  const summary = score.summary;
  const missing = en ? 'N/A' : '無';
  const ms = (item: number | null) => item === null ? missing : `${item} ms`;
  const percent = (item: number | null) => item === null ? missing : `${item}%`;
  const pads = <div className="number-letter-pads">
    {(['z', 'm'] as Answer[]).map(answer => <button key={answer} type="button" className={`number-letter-pad number-letter-pad-${answer}`}
      onPointerDown={event => { event.preventDefault(); runRef.current?.respond(answer); }}>
      <span className="number-letter-pad-rule">{answer === 'z' ? (en ? 'Odd' : '奇數') : (en ? 'Even' : '偶數')}</span>
      <span className="number-letter-pad-rule">{answer === 'z' ? (en ? 'Consonant' : '子音') : (en ? 'Vowel' : '母音')}</span>
      <small>{answer === 'z' ? 'Z / ←' : 'M / →'}</small></button>)}
  </div>;
  return <div ref={rootRef} className="number-letter-game-root">
    <div ref={jsPsychHostRef} className="number-letter-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <NumberLetterTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog number-letter-phase-menu" aria-labelledby="number-letter-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="number-letter-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            {rangeSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}：<output>{value(field)}</output>
              <input name={field.key} type="range" min={field.min} max={field.max} step={field.step} value={settings[field.key]}
                onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })} />
              <small className="training-setting-description">{hints[field.key]}</small></label>)}
            <label className="number-letter-checkbox"><input name="practice" type="checkbox" checked={settings.practice}
              onChange={event => setSettings({ ...settings, practice: event.target.checked })} />{en ? 'Practice first' : '先練習'}
              <small className="training-setting-description">{hints.practice}</small></label>
            <p className="number-letter-estimate">{en ? 'Estimated time' : '預估時間'}：{duration(EstimatedSeconds(settings))}</p>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="number-letter-stage number-letter-running" aria-label={title}>
      <header className="number-letter-hud">
        <p ref={progressLabelRef} className="number-letter-progress-label" aria-live="off">{en ? 'Get ready' : '準備開始'}</p>
        <p className="number-letter-rule">{RuleLabel(kind, en)}</p>
        <div className="number-letter-progress-track"><div ref={progressFillRef} className="number-letter-progress-fill" /></div>
        <button type="button" className="btn btn-ghost number-letter-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <div className="number-letter-field">
        <p className="number-letter-half number-letter-half-top">{en ? 'Top half: number' : '上半部：看數字'}</p>
        <div ref={boardRef} className="number-letter-board" data-state="ready" data-position="topleft" aria-hidden="true">
          <p ref={pairRef} className="number-letter-pair">G9</p>
          <p ref={feedbackRef} className="number-letter-feedback" aria-live="off" />
        </div>
        <p className="number-letter-half number-letter-half-bottom">{en ? 'Bottom half: letter' : '下半部：看字母'}</p>
      </div>
      {pads}
      {intro && <section className="training-panel number-letter-intro" role="dialog" aria-modal="true" aria-labelledby="number-letter-intro-title">
        <div className="training-config training-confirmation">
          <header className="training-config-header"><h2 id="number-letter-intro-title">{intro.afterPractice ? (en ? 'Practice done' : '練習結束')
            : intro.part > 1 ? (en ? `Part ${intro.part - 1} of ${intro.parts} done` : `第 ${intro.part - 1} 段完成（共 ${intro.parts} 段）`)
              : (en ? 'Counted items' : '正式題目')}</h2></header>
          <div className="training-config-body"><section className="training-setting">
            {intro.previousAccuracy !== null && <p className="training-config-summary-item"><strong>{en ? 'Correct in the last part' : '上一段正確率'}：</strong>{percent(intro.previousAccuracy)}</p>}
            <h3>{en ? `Next: part ${intro.part} of ${intro.parts}, ${RuleLabel(intro.kind, true)} (${intro.items} items)` : `下一段：第 ${intro.part} 段（共 ${intro.parts} 段），${RuleLabel(intro.kind, false)}（${intro.items} 題）`}</h3>
            <p className="number-letter-intro-rule">{RuleText(intro.kind, en)}</p>
            <p>{intro.afterPractice ? (en ? 'Counted items give no feedback. Take a short rest if you need one.' : '正式題目不提示對錯。需要的話先休息一下。')
              : (en ? 'Take a short rest and start when you are ready.' : '休息一下，準備好再開始。')}</p>
          </section></div>
          <footer className="config-actions"><div className="training-config-navigation-buttons">
            <button ref={continueButtonRef} type="button" className="btn btn-primary number-letter-continue" onClick={startNextPart}>{en ? 'Start this part' : '開始這一段'}</button>
          </div></footer>
        </div>
      </section>}
    </main>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Correct' : '正確率'}</p><strong>{percent(summary.accuracy)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Extra time when the rule changes' : '換規則時多花的時間'}</p><strong>{ms(summary.switchCostMs)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Mean answer time' : '平均作答時間'}</p><strong>{ms(summary.meanResponseMs)}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.slice(0, -1).map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Correct, single-rule parts' : '單一規則段正確率'}</dt><dd>{percent(summary.singleAccuracy)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Correct, switching part' : '切換段正確率'}</dt><dd>{percent(summary.mixedAccuracy)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Correct answers, single-rule parts' : '單一規則段答對的平均時間'}</dt><dd>{ms(summary.singleMeanMs)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Correct answers after a rule change' : '換規則後答對的平均時間'}</dt><dd>{ms(summary.switchMeanMs)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Correct answers with the same rule' : '同規則連續時答對的平均時間'}</dt><dd>{ms(summary.repeatMeanMs)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'No answer in time' : '未及時作答'}</dt><dd>{summary.misses}</dd></div>
      </dl>
        <p className="score-note">{en ? 'In the switching part the rule changes every two items. "Extra time" compares correct answers right after a change with correct answers when the rule stayed the same. Practice items are listed below but not counted here.'
          : '切換段每兩題換一次規則。「多花的時間」比較剛換規則時與規則沒變時答對的平均時間。練習題列在下方明細，但不計入這些統計。'}</p></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}
