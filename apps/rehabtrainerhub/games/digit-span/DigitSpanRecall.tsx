import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, EstimatedSeconds, practiceItems, rangeSettings, ValidateSettings, type DigitSpanSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { DigitSpanTutorial } from './rules/DigitSpanTutorial';
import { CreateDigits, CreateDigitSchedule, CreateDigitSpanPlan, CreateRandom, IsRecallCorrect, NextLevel, startLoad, type DigitSpanSegment, type Level } from './logic/digitSpanTrials';
import { SummarizeDigitSpan, type DigitSpanRow } from './logic/digitSpanScore';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayGameEndSound, PlayMidiMusic, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

type Phase = 'menu' | 'rules' | 'running' | 'results';
type Kind = DigitSpanSegment['kind'];
interface IntroState { next: number; kind: Kind; count: number; afterPractice: boolean; previousAccuracy: number | null }
interface AnswerControls { press(digit: number): void; back(): void; clear(): void; submit(): void }

const maxEntry = 20;
const readyMs = 1000;
const pauseMs = 500;
export const DirectionLabel = (reverse: boolean, en: boolean) => reverse ? (en ? 'Reverse' : '逆向：倒過來') : (en ? 'Forward' : '順向：照順序');

export function DigitSpanRecall() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<DigitSpanSettings>({ ...defaultSettings });
  const [rows, setRows] = useState<DigitSpanRow[]>([]);
  const [intro, setIntro] = useState<IntroState | null>(null);
  const [reverse, setReverse] = useState(false);
  const [entry, setEntry] = useState<number[]>([]);
  const [answering, setAnswering] = useState(false);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const displayRef = useRef<HTMLParagraphElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const progressLabelRef = useRef<HTMLParagraphElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const answerRef = useRef<AnswerControls | null>(null);
  const stopRunRef = useRef<(() => void) | null>(null);
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
    stopRunRef.current?.();
    stopRunRef.current = null;
    answerRef.current = null;
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
      const controls = answerRef.current;
      if (!controls || event.repeat) return;
      const target = event.target as HTMLElement;
      if (/^[1-9]$/.test(event.key)) { event.preventDefault(); controls.press(Number(event.key)); }
      else if (event.key === 'Backspace') { event.preventDefault(); controls.back(); }
      else if (event.key === 'Delete') { event.preventDefault(); controls.clear(); }
      // Enter on a digit key submits, so clicking digits and pressing Enter does not repeat the last digit.
      else if (event.key === 'Enter' && (target.tagName !== 'BUTTON' || target.dataset.digit)) { event.preventDefault(); controls.submit(); }
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
    const random = CreateRandom(Date.now());
    const plan = CreateDigitSpanPlan(settings);
    const allRows: DigitSpanRow[] = [];
    const timers = new Set<number>();
    let stopped = false;
    const later = (callback: () => void, ms: number) => {
      const timer = window.setTimeout(() => { timers.delete(timer); if (!stopped) callback(); }, ms);
      timers.add(timer);
    };
    const stop = () => { stopped = true; for (const timer of timers) window.clearTimeout(timer); timers.clear(); answerRef.current = null; };
    stopRunRef.current = stop;
    const setState = (state: string) => { if (stageRef.current) stageRef.current.dataset.state = state; };
    const show = (text: string) => { if (displayRef.current) displayRef.current.textContent = text; };
    const finish = () => {
      stop();
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
    const showIntro = (index: number, previous: DigitSpanRow[] | null, afterPractice: boolean) => {
      const segment = plan[index];
      setIntro({ next: index, kind: segment.kind, count: segment.count, afterPractice,
        previousAccuracy: previous ? SummarizeDigitSpan(previous.map(row => ({ ...row, practice: false }))).accuracy : null });
    };
    const runSegment = (index: number) => {
      const segment = plan[index];
      const segmentRows: DigitSpanRow[] = [];
      let level: Level = { load: startLoad, errors: 0 };
      setIntro(null);
      setReverse(segment.reverse);
      setEntry([]);
      setAnswering(false);
      setState('ready');
      show('');
      if (progressLabelRef.current) progressLabelRef.current.textContent = enRef.current ? 'Get ready' : '準備開始';
      if (progressFillRef.current) progressFillRef.current.style.width = '0%';
      const runTrial = (item: number) => {
        const english = enRef.current;
        const load = segment.kind === 'practice' ? startLoad : level.load;
        const digits = CreateDigits(load, random);
        if (progressLabelRef.current) progressLabelRef.current.textContent = segment.kind === 'practice'
          ? (english ? `Practice ${item + 1} of ${segment.count}` : `練習 ${item + 1}／${segment.count}`)
          : `${DirectionLabel(segment.reverse, english).split('：')[0]} ${english ? `${item + 1} of ${segment.count}` : `${item + 1}／${segment.count}`}`;
        if (progressFillRef.current) progressFillRef.current.style.width = `${(item + 1) / segment.count * 100}%`;
        if (feedbackRef.current) { feedbackRef.current.textContent = ''; delete feedbackRef.current.dataset.result; }
        const schedule = CreateDigitSchedule(digits, settings.itemExposureMs);
        for (const event of schedule.events) later(() => {
          setState(event.state);
          show(event.state === 'count' ? (enRef.current ? `${load} digits` : `${load} 個數字`) : event.state === 'digit' ? String(event.digit) : '');
        }, event.at);
        later(() => {
          let typed: number[] = [];
          const onset = performance.now();
          setState('answer');
          setEntry([]);
          setAnswering(true);
          const update = (next: number[]) => { typed = next; setEntry(next); };
          answerRef.current = {
            press: digit => { if (typed.length < maxEntry) update([...typed, digit]); },
            back: () => update(typed.slice(0, -1)),
            clear: () => update([]),
            submit: () => {
              if (!typed.length) return;
              answerRef.current = null;
              setAnswering(false);
              const row: DigitSpanRow = { trial: allRows.length + 1, practice: segment.kind === 'practice', reverse: segment.reverse, load, sequence: digits,
                response: typed, rtMs: Math.round(performance.now() - onset) };
              allRows.push(row);
              segmentRows.push(row);
              const correct = IsRecallCorrect(digits, typed, segment.reverse);
              if (segment.kind !== 'practice') level = NextLevel(level, correct);
              setState('feedback');
              const expected = (segment.reverse ? [...digits].reverse() : digits).join(' ');
              const now = enRef.current;
              if (feedbackRef.current) {
                feedbackRef.current.dataset.result = correct ? 'correct' : 'wrong';
                feedbackRef.current.textContent = correct ? (now ? 'Correct' : '答對了')
                  : segment.reverse ? (now ? `Not quite. In reverse it was ${expected}.` : `不對，倒過來應是 ${expected}。`)
                    : (now ? `Not quite. The order was ${expected}.` : `不對，正確順序是 ${expected}。`);
              }
              later(() => {
                setState('blank');
                setEntry([]);
                if (feedbackRef.current) { feedbackRef.current.textContent = ''; delete feedbackRef.current.dataset.result; }
                later(() => {
                  if (item + 1 < segment.count) runTrial(item + 1);
                  else if (index === plan.length - 1) finish();
                  else showIntro(index + 1, segmentRows, segment.kind === 'practice');
                }, pauseMs);
              }, correct ? 1000 : 2000);
            },
          };
        }, schedule.answerAt);
      };
      later(() => runTrial(0), readyMs);
    };
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:digit-span', onStart: () => {
      runSegmentRef.current = runSegment;
      if (plan[0].kind === 'practice') runSegment(0);
      else showIntro(0, null, false);
    } });
    return () => {
      stop();
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
    setReverse(false);
    setEntry([]);
    setAnswering(false);
    setPhase('running');
  };

  const duration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60), extra = seconds % 60;
    const parts = en ? [minutes && `${minutes} min`, extra && `${extra} s`] : [minutes && `${minutes} 分`, extra && `${extra} 秒`];
    return `${en ? 'about' : '約'} ${parts.filter(Boolean).join(' ')}`;
  };
  const unit = (field: typeof rangeSettings[number]) => en ? (field.unitEn ? ` ${field.unitEn}` : '') : ` ${field.unitZh}`;
  const hints: Record<string, string> = en ? {
    itemExposureMs: 'How long each digit stays on screen. A 200 ms blank follows each digit.',
    rounds: 'Counted sequences: the first half forward, the second half in reverse. Each half starts at 3 digits.',
    practice: `${practiceItems} forward practice sequences of 3 digits come first. Every sequence, practice or counted, shows right or wrong.`,
  } : {
    itemExposureMs: '每個數字顯示多久；每個數字之後有 200 毫秒空白。',
    rounds: '計入成果的題數：前一半順向、後一半逆向，兩段都從 3 個數字開始。',
    practice: `正式開始前先做 ${practiceItems} 題 3 個數字的順向練習。練習與正式題目都會提示對錯。`,
  };
  const summaryItems = [
    ...rangeSettings.map(field => ({ label: en ? field.en : field.zh, value: `${settings[field.key]}${unit(field)}` })),
    { label: en ? 'Practice first' : '先練習', value: settings.practice ? (en ? `Yes, ${practiceItems} sequences` : `是，${practiceItems} 題`) : (en ? 'No' : '否') },
    { label: en ? 'Estimated time' : '預估時間', value: `${duration(EstimatedSeconds(settings))}${en ? ', plus rests' : '，另加休息時間'}` },
  ];
  const score = BuildGameScore(rows, settings);
  const summary = score.summary;
  const missing = en ? 'N/A' : '無';
  const ms = (value: number | null) => value === null ? missing : `${value} ms`;
  const percent = (value: number | null) => value === null ? missing : `${value}%`;
  const digitsText = (value: number | null) => value === null ? missing : en ? `${value} digits` : `${value} 個`;
  const keypad = <div className="digit-span-keypad">
    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => <button key={digit} type="button" className="digit-span-key" data-digit={digit} disabled={!answering}
      onClick={() => answerRef.current?.press(digit)}>{digit}</button>)}
    <button type="button" className="digit-span-key digit-span-back" disabled={!answering || !entry.length} onClick={() => answerRef.current?.back()}>{en ? 'Delete' : '刪除'}</button>
    <button type="button" className="digit-span-key digit-span-clear" disabled={!answering || !entry.length} onClick={() => answerRef.current?.clear()}>{en ? 'Clear' : '清除'}</button>
    <button type="button" className="digit-span-key digit-span-submit" disabled={!answering || !entry.length} onClick={() => answerRef.current?.submit()}>{en ? 'Submit' : '送出'}</button>
  </div>;
  return <div ref={rootRef} className="digit-span-game-root">
    <div ref={jsPsychHostRef} className="digit-span-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <DigitSpanTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog digit-span-phase-menu" aria-labelledby="digit-span-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="digit-span-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            {rangeSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}：<output>{settings[field.key]}{unit(field)}</output>
              <input name={field.key} type="range" min={field.min} max={field.max} step={field.step} value={settings[field.key]}
                onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })} />
              <small className="training-setting-description">{hints[field.key]}</small></label>)}
            <label className="digit-span-checkbox"><input name="practice" type="checkbox" checked={settings.practice}
              onChange={event => setSettings({ ...settings, practice: event.target.checked })} />{en ? 'Practice first' : '先練習'}
              <small className="training-setting-description">{hints.practice}</small></label>
            <p className="digit-span-estimate">{en ? 'Estimated time' : '預估時間'}：{duration(EstimatedSeconds(settings))}{en ? '; it depends on how many digits you reach and how fast you type' : '（依記住的位數與作答速度而定）'}</p>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main ref={stageRef} className="digit-span-stage digit-span-running" data-state="ready" aria-label={title}>
      <header className="digit-span-hud">
        <p ref={progressLabelRef} className="digit-span-progress-label" aria-live="off">{en ? 'Get ready' : '準備開始'}</p>
        <p className="digit-span-direction">{DirectionLabel(reverse, en)}</p>
        <div className="digit-span-progress-track"><div ref={progressFillRef} className="digit-span-progress-fill" /></div>
        <button type="button" className="btn btn-ghost digit-span-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <div className="digit-span-display-area">
        <p ref={displayRef} className="digit-span-display" aria-hidden="true" />
        <p ref={feedbackRef} className="digit-span-feedback" role="status" />
        <div className="digit-span-entry" aria-live="polite" aria-label={en ? 'Your answer' : '你的答案'}>
          {entry.length ? entry.map((digit, index) => <span key={index} className="digit-span-entry-digit">{digit}</span>)
            : <span className="digit-span-entry-hint">{answering ? (reverse ? (en ? 'Enter the digits from last to first' : '從最後一個數字開始輸入') : (en ? 'Enter the digits in order' : '依出現順序輸入數字')) : ''}</span>}
        </div>
      </div>
      {keypad}
      {intro && <section className="training-panel digit-span-intro" role="dialog" aria-modal="true" aria-labelledby="digit-span-intro-title">
        <div className="training-config training-confirmation">
          <header className="training-config-header"><h2 id="digit-span-intro-title">{intro.afterPractice ? (en ? 'Practice done' : '練習結束')
            : intro.kind === 'reverse' ? (en ? 'Forward part done' : '順向完成') : (en ? 'Counted sequences' : '正式題目')}</h2></header>
          <div className="training-config-body"><section className="training-setting">
            {intro.previousAccuracy !== null && <p className="training-config-summary-item"><strong>{en ? 'Correct in the last part' : '上一段正確率'}：</strong>{percent(intro.previousAccuracy)}</p>}
            <h3>{en ? `Next: ${DirectionLabel(intro.kind === 'reverse', true)}, ${intro.count} sequences` : `下一段：${DirectionLabel(intro.kind === 'reverse', false)}，共 ${intro.count} 題`}</h3>
            <p className="digit-span-intro-rule">{intro.kind === 'reverse'
              ? (en ? 'Enter the digits in reverse: the last digit first. If you saw 4 8 2, enter 2 8 4.' : '請倒過來輸入：最後出現的數字先輸入。例如看到 4 8 2，就輸入 2 8 4。')
              : (en ? 'Enter the digits in the order they appeared. If you saw 4 8 2, enter 4 8 2.' : '請依出現順序輸入。例如看到 4 8 2，就輸入 4 8 2。')}</p>
            <p>{en ? 'Each part starts at 3 digits. A correct answer adds a digit; every second mistake takes one away. Take a short rest and start when you are ready.'
              : '每段從 3 個數字開始，答對就多一個數字，每答錯兩次就少一個。休息一下，準備好再開始。'}</p>
          </section></div>
          <footer className="config-actions"><div className="training-config-navigation-buttons">
            <button ref={continueButtonRef} type="button" className="btn btn-primary digit-span-continue" onClick={startNextPart}>{en ? 'Start this part' : '開始這一段'}</button>
          </div></footer>
        </div>
      </section>}
    </main>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Longest correct, forward' : '順向最長答對'}</p><strong>{digitsText(summary.forwardSpan)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Longest correct, reverse' : '逆向最長答對'}</p><strong>{digitsText(summary.reverseSpan)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Correct' : '正確率'}</p><strong>{percent(summary.accuracy)}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.slice(0, -1).map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Correct, forward' : '順向正確率'}</dt><dd>{percent(summary.forwardAccuracy)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Correct, reverse' : '逆向正確率'}</dt><dd>{percent(summary.reverseAccuracy)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Correct sequences' : '答對題數'}</dt><dd>{summary.correct} / {summary.trials}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Mean time to enter an answer' : '平均輸入時間'}</dt><dd>{ms(summary.meanResponseMs)}</dd></div>
      </dl>
        <p className="score-note">{en ? 'Answer time runs from when the keypad opens to Submit. Practice sequences are listed below but not counted here.'
          : '輸入時間從鍵盤可用開始算到按下送出。練習題列在下方明細，但不計入這些統計。'}</p></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}
