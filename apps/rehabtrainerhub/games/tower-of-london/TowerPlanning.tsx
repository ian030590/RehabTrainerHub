import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, EstimatedSeconds, rangeSettings, ValidateSettings, type TowerSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { TowerTutorial } from './rules/TowerTutorial';
import { CreateTowerProblems, Matches, PegClick, startBoard, type Board, type TowerState } from './logic/towerOfLondon';
import { BallLabel, BallName, countedTotal, TowerBoard } from './TowerBoard';
import type { TowerRow } from './logic/towerScore';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayGameEndSound, PlayMidiMusic, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

type Phase = 'menu' | 'rules' | 'running' | 'results';
interface ProblemView { practice: boolean; number: number; target: Board; minimumMoves: number }
interface IntroState { next: number; number: number; minimumMoves: number; afterPractice: boolean; previous: TowerRow | null }

const readyMs = 1000;
const feedbackMs = 2000;
const pauseMs = 500;
const noticeMs = 1200;

export function TowerPlanning() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<TowerSettings>({ ...defaultSettings });
  const [rows, setRows] = useState<TowerRow[]>([]);
  const [intro, setIntro] = useState<IntroState | null>(null);
  const [problem, setProblem] = useState<ProblemView | null>(null);
  const [tower, setTower] = useState<TowerState>({ board: startBoard, held: null, moves: 0 });
  const [playing, setPlaying] = useState(false);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const timerRef = useRef<HTMLParagraphElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const pegRef = useRef<((peg: number) => void) | null>(null);
  const stopRunRef = useRef<(() => void) | null>(null);
  const runProblemRef = useRef<((index: number) => void) | null>(null);
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
    pegRef.current = null;
    runProblemRef.current = null;
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
  }, []);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  const startNextProblem = useCallback(() => {
    const current = introRef.current;
    if (current) runProblemRef.current?.(current.next);
  }, []);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setRows([]); setIntro(null); setPhase('menu'); };
    const keys = (event: KeyboardEvent) => {
      if (phaseRef.current !== 'running') return;
      if (event.key === 'Escape') { event.preventDefault(); exit(); return; }
      if (introRef.current) {
        if ((event.key === 'Enter' || event.key === ' ') && !event.repeat && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); startNextProblem(); }
        return;
      }
      const peg = ['1', '2', '3'].indexOf(event.key);
      if (peg >= 0 && !event.repeat && pegRef.current) { event.preventDefault(); pegRef.current(peg); }
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
  }, [exit, stopRuntime, startNextProblem]);
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
    const plan = CreateTowerProblems(settings);
    const allRows: TowerRow[] = [];
    const timers = new Set<number>();
    let ticker = 0;
    let stopped = false;
    const later = (callback: () => void, ms: number) => {
      const timer = window.setTimeout(() => { timers.delete(timer); if (!stopped) callback(); }, ms);
      timers.add(timer);
      return timer;
    };
    const cancel = (timer: number) => { window.clearTimeout(timer); timers.delete(timer); };
    const stopTicker = () => { window.clearInterval(ticker); ticker = 0; };
    const stop = () => { stopped = true; stopTicker(); for (const timer of timers) window.clearTimeout(timer); timers.clear(); pegRef.current = null; };
    stopRunRef.current = stop;
    const setState = (state: string) => { if (stageRef.current) stageRef.current.dataset.state = state; };
    const say = (text: string, result?: string) => {
      const message = messageRef.current;
      if (!message) return;
      message.textContent = text;
      if (result) message.dataset.result = result; else delete message.dataset.result;
    };
    const showTime = (ms: number) => {
      if (timerRef.current) timerRef.current.textContent = enRef.current ? `${Math.ceil(ms / 1000)} s left` : `剩 ${Math.ceil(ms / 1000)} 秒`;
    };
    const counted = (index: number) => plan.slice(0, index + 1).filter(item => !item.practice).length;
    const finish = () => {
      stop();
      runProblemRef.current = null;
      const score = BuildGameScore(allRows, settings);
      jsPsychLifecycleRef.current?.finish({ trials: score.summary.trials, accuracy: score.summary.accuracy });
      PlayGameEndSound('Victory');
      setRows([...allRows]);
      setSaveState(IsHubGame() ? 'saving' : 'local');
      SendGameResult({ ...settings }, score.summary, score.rounds);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      setPhase('results');
    };
    const showIntro = (index: number, afterPractice: boolean) => {
      setProblem(null);
      setIntro({ next: index, number: counted(index), minimumMoves: plan[index].minimumMoves, afterPractice, previous: allRows.at(-1) ?? null });
    };
    const runProblem = (index: number) => {
      const item = plan[index];
      const prompt = () => enRef.current ? 'Make your board match the target' : '把你的盤面排成目標的樣子';
      let state: TowerState = { board: startBoard, held: null, moves: 0 };
      let firstMoveMs: number | null = null;
      let notice = 0;
      setIntro(null);
      setTower(state);
      setProblem({ practice: item.practice, number: counted(index), target: item.target, minimumMoves: item.minimumMoves });
      setPlaying(false);
      setState('ready');
      say(enRef.current ? 'Get ready' : '準備開始');
      showTime(settings.problemLimitMs);
      if (progressFillRef.current) progressFillRef.current.style.width = `${item.practice ? 0 : counted(index) / countedTotal * 100}%`;
      later(() => {
        const onset = performance.now();
        let deadline = 0;
        const end = (solved: boolean) => {
          pegRef.current = null;
          stopTicker();
          cancel(deadline);
          if (notice) cancel(notice);
          setPlaying(false);
          const problemMs = solved ? Math.round(performance.now() - onset) : settings.problemLimitMs;
          allRows.push({ trial: allRows.length + 1, practice: item.practice, problem: item.index, solved, moves: state.moves,
            minimumMoves: item.minimumMoves, problemMs, firstMoveMs });
          setState('feedback');
          const now = enRef.current;
          if (solved) say(now ? `Done in ${state.moves} moves (fewest: ${item.minimumMoves})` : `完成了！用了 ${state.moves} 步（最少 ${item.minimumMoves} 步）`, 'correct');
          else say(now ? 'Time is up. This problem was not finished.' : '時間到，這題沒有完成。', 'wrong');
          later(() => {
            setState('blank');
            say('');
            later(() => {
              if (index === plan.length - 1) finish();
              else showIntro(index + 1, item.practice);
            }, pauseMs);
          }, feedbackMs);
        };
        setState('play');
        setPlaying(true);
        say(prompt());
        ticker = window.setInterval(() => showTime(Math.max(0, settings.problemLimitMs - (performance.now() - onset))), 200);
        deadline = later(() => end(false), settings.problemLimitMs);
        pegRef.current = peg => {
          const next = PegClick(state, peg);
          if (next === state) {
            // A tap that does nothing says why, then the prompt comes back.
            const now = enRef.current;
            say(state.held === null ? (now ? 'That peg is empty.' : '這根柱子是空的。') : (now ? 'That peg is full.' : '這根柱子滿了。'), 'wrong');
            if (notice) cancel(notice);
            notice = later(() => { notice = 0; say(prompt()); }, noticeMs);
            return;
          }
          if (firstMoveMs === null && next.held !== null) firstMoveMs = Math.round(performance.now() - onset);
          state = next;
          setTower(next);
          if (next.held === null && Matches(next.board, item.target)) end(true);
        };
      }, readyMs);
    };
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:tower-of-london', onStart: () => {
      runProblemRef.current = runProblem;
      if (plan[0].practice) runProblem(0);
      else showIntro(0, false);
    } });
    return () => {
      stop();
      runProblemRef.current = null;
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
    setProblem(null);
    setTower({ board: startBoard, held: null, moves: 0 });
    setPlaying(false);
    setPhase('running');
  };

  const duration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60), extra = seconds % 60;
    const parts = en ? [minutes && `${minutes} min`, extra && `${extra} s`] : [minutes && `${minutes} 分`, extra && `${extra} 秒`];
    return parts.filter(Boolean).join(' ');
  };
  const unit = (field: typeof rangeSettings[number]) => en ? ` ${field.unitEn}` : ` ${field.unitZh}`;
  const hints: Record<string, string> = en ? {
    problemLimitMs: 'Time for each problem. When it runs out, the next problem comes. The original task gives 20 seconds.',
    practice: 'A one-move practice problem comes first, with the same time limit.',
  } : {
    problemLimitMs: '每題可用的時間，時間到就換下一題。原作業每題 20 秒。',
    practice: '正式開始前先做 1 題只要 1 步的練習，時限相同。',
  };
  const longest = duration(EstimatedSeconds(settings));
  const summaryItems = [
    ...rangeSettings.map(field => ({ label: en ? field.en : field.zh, value: `${settings[field.key] / field.scale}${unit(field)}` })),
    { label: en ? 'Practice first' : '先練習', value: settings.practice ? (en ? 'Yes, 1 problem' : '是，1 題') : (en ? 'No' : '否') },
    { label: en ? 'Longest time' : '最長時間', value: en ? `about ${longest}, plus rests` : `約 ${longest}，另加休息時間` },
  ];
  const score = BuildGameScore(rows, settings);
  const summary = score.summary;
  const missing = en ? 'N/A' : '無';
  const ms = (value: number | null) => value === null ? missing : `${value} ms`;
  const percent = (value: number | null) => value === null ? missing : `${value}%`;
  const progressText = problem ? problem.practice ? (en ? 'Practice' : '練習')
    : (en ? `Problem ${problem.number} of ${countedTotal}` : `第 ${problem.number}／${countedTotal} 題`) : (en ? 'Get ready' : '準備開始');
  const previous = intro?.previous;
  return <div ref={rootRef} className="tower-of-london-game-root">
    <div ref={jsPsychHostRef} className="tower-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <TowerTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog tower-of-london-phase-menu" aria-labelledby="tower-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="tower-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            {rangeSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}：<output>{settings[field.key] / field.scale}{unit(field)}</output>
              <input name={field.key} type="range" min={field.min} max={field.max} step={field.step} value={settings[field.key]}
                onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })} />
              <small className="training-setting-description">{hints[field.key]}</small></label>)}
            <label className="tower-checkbox"><input name="practice" type="checkbox" checked={settings.practice}
              onChange={event => setSettings({ ...settings, practice: event.target.checked })} />{en ? 'Practice first' : '先練習'}
              <small className="training-setting-description">{hints.practice}</small></label>
            <p className="tower-estimate">{en ? `At most about ${longest}, if every problem uses its full time` : `最多約 ${longest}（每題都用完時限時）`}</p>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main ref={stageRef} className="tower-stage tower-running" data-state="ready" aria-label={title}>
      <header className="tower-hud">
        <p className="tower-progress-label">{progressText}</p>
        <p ref={timerRef} className="tower-timer" aria-live="off" />
        <div className="tower-progress-track"><div ref={progressFillRef} className="tower-progress-fill" /></div>
        <button type="button" className="btn btn-ghost tower-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <p ref={messageRef} className="tower-message" role="status" />
      {problem && <div className="tower-boards">
        <section className="tower-panel tower-panel-target" aria-labelledby="tower-target-title">
          <h2 id="tower-target-title" className="tower-panel-title">{en ? 'Target' : '目標'}</h2>
          <TowerBoard board={problem.target} en={en} label={en ? 'Target board' : '目標盤面'} />
        </section>
        <section className="tower-panel tower-panel-yours" aria-labelledby="tower-yours-title">
          <h2 id="tower-yours-title" className="tower-panel-title">{en ? 'Your board' : '你的盤面'}</h2>
          <TowerBoard board={tower.board} en={en} label={en ? 'Your board' : '你的盤面'} disabled={!playing} onPeg={peg => pegRef.current?.(peg)} />
        </section>
      </div>}
      {problem && <div className="tower-status">
        <div className="tower-hand"><p className="tower-hand-label">{en ? 'In your hand' : '手上的球'}</p>
          <span className="tower-hand-slot" aria-live="polite">{tower.held === null ? <span className="tower-hand-empty">{en ? 'None' : '沒有'}</span>
            : <span className={`tower-ball tower-ball-${tower.held}`} aria-label={BallName(tower.held, en)}>{BallLabel(tower.held, en)}</span>}</span></div>
        <p className="tower-moves">{en ? `Moves: ${tower.moves}` : `已移動 ${tower.moves} 步`}<span className="tower-minimum">
          {en ? `Fewest possible: ${problem.minimumMoves}` : `這題最少 ${problem.minimumMoves} 步`}</span></p>
      </div>}
      {intro && <section className="training-panel tower-intro" role="dialog" aria-modal="true" aria-labelledby="tower-intro-title">
        <div className="training-config training-confirmation">
          <header className="training-config-header"><h2 id="tower-intro-title">{intro.afterPractice ? (en ? 'Practice done' : '練習結束')
            : intro.number === 1 ? (en ? 'Counted problems' : '正式題目') : (en ? 'Next problem' : '下一題')}</h2></header>
          <div className="training-config-body"><section className="training-setting">
            {previous && <p className="training-config-summary-item"><strong>{en ? 'Last problem' : '上一題'}：</strong>{previous.solved
              ? (en ? `done in ${previous.moves} moves (fewest ${previous.minimumMoves})` : `完成，用了 ${previous.moves} 步（最少 ${previous.minimumMoves} 步）`)
              : (en ? 'not finished in time' : '時間內沒有完成')}</p>}
            <h3>{en ? `Problem ${intro.number} of ${countedTotal}: fewest ${intro.minimumMoves} moves` : `第 ${intro.number} 題（共 ${countedTotal} 題）：最少 ${intro.minimumMoves} 步`}</h3>
            <p className="tower-intro-rule">{en ? 'Plan the moves before you lift the first ball. Lifting a ball counts as one move.'
              : '先想好怎麼移，再拿起第一顆球。每拿起一顆球算一步。'}</p>
            <p>{en ? `You have ${settings.problemLimitMs / 1000} seconds. Start when you are ready.` : `這題有 ${settings.problemLimitMs / 1000} 秒。準備好再開始。`}</p>
          </section></div>
          <footer className="config-actions"><div className="training-config-navigation-buttons">
            <button ref={continueButtonRef} type="button" className="btn btn-primary tower-continue" onClick={startNextProblem}>{en ? 'Start this problem' : '開始這一題'}</button>
          </div></footer>
        </div>
      </section>}
    </main>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Problems finished' : '完成題數'}</p><strong>{summary.correct} / {summary.trials}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Finished in the fewest moves' : '用最少步數完成'}</p><strong>{en ? `${summary.perfect}` : `${summary.perfect} 題`}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Mean planning time' : '平均規劃時間'}</p><strong>{ms(summary.planningMs)}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.slice(0, -1).map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Finished' : '完成率'}</dt><dd>{percent(summary.accuracy)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Extra moves on finished problems' : '完成的題目多走的步數'}</dt><dd>{en ? summary.extraMoves : `${summary.extraMoves} 步`}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Mean time to finish' : '平均完成時間'}</dt><dd>{ms(summary.meanSolveMs)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Time ran out' : '時間到未完成'}</dt><dd>{en ? summary.timeouts : `${summary.timeouts} 題`}</dd></div>
      </dl>
        <p className="score-note">{en ? 'Planning time runs from when a problem appears to lifting the first ball. Finish time counts finished problems only. The practice problem is listed below but not counted here.'
          : '規劃時間從題目出現算到拿起第一顆球；完成時間只算有完成的題目。練習題列在下方明細，但不計入這些統計。'}</p></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}
