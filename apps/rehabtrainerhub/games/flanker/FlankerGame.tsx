import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, EstimatedSeconds, leadInMs, practiceItems, rangeSettings, ValidateSettings, type FlankerSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { FlankerTutorial } from './rules/FlankerTutorial';
import { CreateFlankerSteps, CreateRandom, type FlankerTrial, type Side } from './logic/flankerTrials';
import { TrialRun, type RunClock, type TrialOutcome } from './logic/trialRun';
import type { FlankerRow } from './logic/flankerScore';
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

const keySides: Record<string, Side> = { f: 'left', arrowleft: 'left', j: 'right', h: 'right', arrowright: 'right' };
const letters: Record<Side, string> = { left: 'F', right: 'H' };

function ToRow(outcome: TrialOutcome<FlankerTrial>): FlankerRow {
  const { trial } = outcome;
  return { trial: outcome.index + 1, practice: trial.practice, congruent: trial.congruent, target: trial.target === 'left' ? 0 : 1,
    response: outcome.response === null ? null : outcome.response === 'left' ? 0 : 1, correct: outcome.response === trial.target, rtMs: outcome.rtMs };
}

type Phase = 'menu' | 'rules' | 'running' | 'results';

export function FlankerGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<FlankerSettings>({ ...defaultSettings });
  const [rows, setRows] = useState<FlankerRow[]>([]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLParagraphElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const progressLabelRef = useRef<HTMLParagraphElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const runRef = useRef<TrialRun<FlankerTrial> | null>(null);
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
      if (event.key === 'Escape') { event.preventDefault(); exit(); return; }
      const side = keySides[event.key.toLowerCase()];
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
    const steps = CreateFlankerSteps(settings, CreateRandom(Date.now()));
    const practiceCount = steps.filter(step => step.trial.practice).length;
    const finish = (outcomes: TrialOutcome<FlankerTrial>[]) => {
      runRef.current = null;
      const completed = outcomes.map(ToRow);
      const score = BuildGameScore(completed, settings);
      jsPsychLifecycleRef.current?.finish({ trials: score.summary.trials, accuracy_percent: score.summary.accuracy, interference_ms: score.summary.interferenceMs });
      PlayGameEndSound('Victory');
      setRows(completed);
      setSaveState(IsHubGame() ? 'saving' : 'local');
      SendGameResult({ ...settings }, score.summary, score.rounds);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      setPhase('results');
    };
    const setState = (state: string) => { if (areaRef.current) areaRef.current.dataset.state = state; };
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:flanker', onStart: () => {
      const run = new TrialRun<FlankerTrial>(steps.length, index => steps[index], {
        lead: (state, _step, index) => {
          setState(state);
          if (feedbackRef.current) feedbackRef.current.textContent = '';
          const practice = index < practiceCount;
          const number = practice ? index + 1 : index - practiceCount + 1;
          const total = practice ? practiceCount : steps.length - practiceCount;
          if (progressLabelRef.current) progressLabelRef.current.textContent = practice
            ? (enRef.current ? `Practice ${number} of ${total}` : `練習 ${number}／${total}`)
            : (enRef.current ? `Item ${number} of ${total}` : `第 ${number} 題，共 ${total} 題`);
          if (progressFillRef.current) progressFillRef.current.style.width = `${number / total * 100}%`;
        },
        show: step => {
          const row = rowRef.current;
          if (row) {
            Object.assign(row.dataset, { target: step.trial.target, congruent: String(step.trial.congruent) });
            row.querySelectorAll<HTMLElement>('.flanker-item').forEach((item, position) => {
              const side = position === 2 ? step.trial.target : step.trial.flanker;
              item.dataset.dir = side;
              item.querySelector('.flanker-letter')!.textContent = letters[side];
            });
          }
          setState('target');
        },
        hide: () => undefined,
        signal: () => undefined,
        end: outcome => {
          setState('feedback');
          if (!feedbackRef.current) return;
          const correct = outcome.response === outcome.trial.target;
          feedbackRef.current.dataset.result = correct ? 'correct' : 'wrong';
          feedbackRef.current.textContent = correct ? (enRef.current ? 'Correct' : '答對了')
            : outcome.response === null ? (enRef.current ? 'Too slow. Answer a little faster.' : '太慢了，請快一點。')
              : (enRef.current ? 'Wrong side.' : '按錯邊了。');
        },
        clear: () => setState('blank'),
      }, browserClock, finish, leadInMs);
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
  const respond = (side: Side) => (event: ReactPointerEvent) => { event.preventDefault(); runRef.current?.respond(side); };

  const duration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60), rest = seconds % 60;
    const parts = en ? [minutes && `${minutes} min`, rest && `${rest} s`] : [minutes && `${minutes} 分`, rest && `${rest} 秒`];
    return `${en ? 'about' : '約'} ${parts.filter(Boolean).join(' ')}`;
  };
  const unit = (field: typeof rangeSettings[number]) => en ? (field.unitEn ? ` ${field.unitEn}` : '') : ` ${field.unitZh}`;
  const arrows = settings.stimulus === 'arrows';
  const hints: Record<string, string> = en ? {
    responseWindowMs: 'A row with no answer by this time counts as missed.',
    rounds: 'Items that count toward the results. Half of them have flankers pointing the other way.',
    practice: `${practiceItems} practice items with the same feedback come first. They are saved but left out of the results.`,
    stimulus: 'Arrows: answer the direction of the middle arrow. Letters: answer whether the middle letter is F or H, as in the earlier version.',
  } : {
    responseWindowMs: '超過這個時間還沒作答，就算漏答。',
    rounds: '計入成果的題數，其中一半兩側方向與中央相反。',
    practice: `正式開始前先做 ${practiceItems} 題練習，一樣會提示對錯。練習題會保存，但不列入成果統計。`,
    stimulus: '箭頭：回答中央箭頭的方向。字母：回答中央字母是 F 還是 H，與舊版相同。',
  };
  const stimulusLabel = (value: FlankerSettings['stimulus']) => value === 'arrows' ? (en ? 'Arrows' : '箭頭') : (en ? 'Letters F and H' : '字母 F 與 H');
  const summaryItems = [
    { label: en ? 'Symbols' : '圖示', value: stimulusLabel(settings.stimulus) },
    ...rangeSettings.map(field => ({ label: en ? field.en : field.zh, value: `${settings[field.key]}${unit(field)}` })),
    { label: en ? 'Practice first' : '先練習', value: settings.practice ? (en ? `Yes, ${practiceItems} items` : `是，${practiceItems} 題`) : (en ? 'No' : '否') },
    { label: en ? 'Estimated time' : '預估時間', value: duration(EstimatedSeconds(settings)) },
  ];
  const score = BuildGameScore(rows, settings);
  const summary = score.summary;
  const missing = en ? 'N/A' : '無';
  const ms = (value: number | null) => value === null ? missing : `${value} ms`;
  const percent = (value: number | null) => value === null ? missing : `${value}%`;
  return <div ref={rootRef} className="flanker-game-root">
    <div ref={jsPsychHostRef} className="flanker-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <FlankerTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog flanker-phase-menu" aria-labelledby="flanker-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="flanker-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            <label>{en ? 'Symbols' : '圖示'}<select name="stimulus" value={settings.stimulus}
              onChange={event => setSettings({ ...settings, stimulus: event.target.value as FlankerSettings['stimulus'] })}>
              {(['arrows', 'letters'] as const).map(value => <option key={value} value={value}>{stimulusLabel(value)}</option>)}
            </select>
              <small className="training-setting-description">{hints.stimulus}</small></label>
            {rangeSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}：<output>{settings[field.key]}{unit(field)}</output>
              <input name={field.key} type="range" min={field.min} max={field.max} step={field.step} value={settings[field.key]}
                onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })} />
              <small className="training-setting-description">{hints[field.key]}</small></label>)}
            <label className="flanker-checkbox"><input name="practice" type="checkbox" checked={settings.practice}
              onChange={event => setSettings({ ...settings, practice: event.target.checked })} />{en ? 'Practice first' : '先練習'}
              <small className="training-setting-description">{hints.practice}</small></label>
            <p className="flanker-estimate">{en ? 'Estimated time' : '預估時間'}：{duration(EstimatedSeconds(settings))}</p>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="flanker-stage flanker-running" aria-label={title}>
      <header className="flanker-hud">
        <p ref={progressLabelRef} className="flanker-progress-label" aria-live="off">{en ? 'Get ready' : '準備開始'}</p>
        <div className="flanker-progress-track"><div ref={progressFillRef} className="flanker-progress-fill" /></div>
        <button type="button" className="btn btn-ghost flanker-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <div ref={areaRef} className="flanker-stimulus-area" data-state="ready">
        <p className="flanker-fixation" aria-hidden="true">+</p>
        <p ref={rowRef} className="flanker-row" data-mode={settings.stimulus} aria-hidden="true">
          {[0, 1, 2, 3, 4].map(position => <span key={position} className="flanker-item" data-dir="right">
            <svg className="flanker-arrow" viewBox="0 0 48 48"><path d="M6 24h34M26 10l14 14-14 14" /></svg>
            <span className="flanker-letter">H</span></span>)}
        </p>
        <p className="flanker-break">{en ? 'Practice done. The counted items start now.' : '練習結束，正式題目馬上開始。'}</p>
        <p ref={feedbackRef} className="flanker-feedback" aria-live="off" />
      </div>
      <div className="flanker-pads">
        <button type="button" className="flanker-pad flanker-pad-left" onPointerDown={respond('left')}>
          {arrows ? (en ? 'Left' : '左') : 'F'}<small>{arrows ? 'F / ←' : 'F'}</small></button>
        <button type="button" className="flanker-pad flanker-pad-right" onPointerDown={respond('right')}>
          {arrows ? (en ? 'Right' : '右') : 'H'}<small>{arrows ? 'J / →' : 'H'}</small></button>
      </div>
    </main>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Correct answers' : '正確率'}</p><strong>{percent(summary.accuracy)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Flanker effect (opposing minus matching)' : '側翼干擾（相反減相同）'}</p><strong>{ms(summary.interferenceMs)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Mean answer time' : '平均作答時間'}</p><strong>{ms(summary.meanResponseMs)}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.slice(0, -1).map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Counted items answered correctly' : '正式題答對'}</dt><dd>{summary.correct} / {summary.trials}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Matching flankers: mean time' : '兩側相同：平均時間'}</dt><dd>{ms(summary.congruentRtMs)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Opposing flankers: mean time' : '兩側相反：平均時間'}</dt><dd>{ms(summary.incongruentRtMs)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Matching flankers: correct' : '兩側相同：正確率'}</dt><dd>{percent(summary.congruentAccuracy)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Opposing flankers: correct' : '兩側相反：正確率'}</dt><dd>{percent(summary.incongruentAccuracy)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Missed (too slow)' : '漏答（太慢）'}</dt><dd>{summary.misses}</dd></div>
      </dl>
        <p className="score-note">{en ? 'Practice items are listed below but not counted here. The mean answer time includes wrong answers; the matching and opposing times use correct answers only.'
          : '練習題列在下方明細，但不計入這些統計。平均作答時間包含答錯的題目；兩側相同與相反兩項只計算答對的題目。'}</p></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}
