import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { centerCheckTiming, defaultSettings, rangeSettings, ValidateSettings, type HexSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { HexTutorial } from './rules/HexTutorial';
import { HexBoard } from './HexBoard';
import { CreateHexBoard, CreateRandom, OrderedSearch, type HexCell, type HexRow } from './logic/hexBoard';
import { CenterChecks, type CenterClock } from './logic/centerChecks';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayFailureSound, PlayGameEndSound, PlayMidiMusic, PlaySuccessSound, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

type Phase = 'menu' | 'rules' | 'running' | 'results';

const browserClock: CenterClock = {
  now: () => performance.now(),
  set: (callback, ms) => window.setTimeout(callback, ms),
  clear: timer => window.clearTimeout(timer),
};

export function HexSchulteGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<HexSettings>({ ...defaultSettings });
  const [rows, setRows] = useState<HexRow[]>([]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [board, setBoard] = useState<HexCell[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [interlude, setInterlude] = useState<HexRow | null>(null);
  const [wrong, setWrong] = useState<number | null>(null);
  const [centerShowing, setCenterShowing] = useState(false);
  const [, setVersion] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const clockRef = useRef<HTMLParagraphElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const searchRef = useRef<OrderedSearch | null>(null);
  const checksRef = useRef<CenterChecks | null>(null);
  const rowsRef = useRef<HexRow[]>([]);
  const randomRef = useRef(CreateRandom(Date.now()));
  const wrongTimerRef = useRef(0);
  const generationRef = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => OnSavedSettings(saved => {
    const restored = RestoreSettings(saved, defaultSettings, ValidateSettings);
    if (restored && phaseRef.current === 'menu') setSettings(restored);
  }), []);
  const stopRound = useCallback(() => {
    checksRef.current?.stop();
    checksRef.current = null;
    setCenterShowing(false);
  }, []);
  const stopRuntime = useCallback(() => {
    generationRef.current++;
    stopRound();
    searchRef.current = null;
    window.clearTimeout(wrongTimerRef.current);
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
  }, [stopRound]);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setRows([]); setPhase('menu'); };
    const keys = (event: KeyboardEvent) => {
      if (phaseRef.current === 'running' && event.key === 'Escape') { event.preventDefault(); exit(); }
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

  const beginRound = useCallback((index: number) => {
    const cells = CreateHexBoard(settings.rings, randomRef.current);
    setBoard(cells);
    searchRef.current = new OrderedSearch(cells.length, performance.now());
    setRoundIndex(index);
    setInterlude(null);
    setWrong(null);
    setVersion(version => version + 1);
    if (settings.centerChecks) {
      const checks = new CenterChecks(centerCheckTiming, browserClock, randomRef.current, {
        show: () => setCenterShowing(true),
        hide: () => { setCenterShowing(false); setVersion(version => version + 1); },
      });
      checksRef.current = checks;
      checks.start();
    }
  }, [settings]);
  const finish = useCallback((completed: HexRow[]) => {
    searchRef.current = null;
    const score = BuildGameScore(completed, settings.rounds);
    jsPsychLifecycleRef.current?.finish({ rounds: completed.length, total_time_ms: score.summary.totalTimeMs, errors: score.summary.totalErrors });
    PlayGameEndSound('Victory');
    setRows(completed);
    setSaveState(IsHubGame() ? 'saving' : 'local');
    SendGameResult({ ...settings }, score.summary, score.rounds);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setPhase('results');
  }, [settings]);
  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (phase !== 'running' || !host) return;
    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:hex-schulte', onStart: () => {
      rowsRef.current = [];
      randomRef.current = CreateRandom(Date.now());
      beginRound(0);
    } });
    return () => {
      stopRound();
      searchRef.current = null;
      lifecycle.dispose();
      if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null;
    };
  }, [phase, beginRound, stopRound]);
  useEffect(() => {
    if (phase !== 'running' || interlude) return;
    const timer = window.setInterval(() => {
      const search = searchRef.current;
      if (search && clockRef.current) clockRef.current.textContent = `${((performance.now() - search.startedAt) / 1000).toFixed(1)} ${en ? 's' : '秒'}`;
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase, interlude, en]);

  const seconds = (ms: number | null) => ms === null ? (en ? 'N/A' : '無') : `${(ms / 1000).toFixed(1)} ${en ? 's' : '秒'}`;
  const tapCell = (value: number) => {
    const search = searchRef.current;
    if (phaseRef.current !== 'running' || !search || interlude) return;
    const outcome = search.tap(value, performance.now());
    if (outcome.ignored) return;
    window.clearTimeout(wrongTimerRef.current);
    if (!outcome.correct) {
      PlayFailureSound();
      setWrong(value);
      wrongTimerRef.current = window.setTimeout(() => setWrong(null), 900);
      return;
    }
    setWrong(null);
    setVersion(version => version + 1);
    if (!outcome.done) return;
    const counts = checksRef.current?.counts() ?? { shown: 0, hits: 0, missed: 0 };
    stopRound();
    const row: HexRow = { round: roundIndex + 1, rings: settings.rings, ...search.result(),
      centerChecks: counts.shown, centerHits: counts.hits, centerMissed: counts.missed };
    if (clockRef.current) clockRef.current.textContent = seconds(row.timeMs);
    rowsRef.current = [...rowsRef.current, row];
    if (rowsRef.current.length >= settings.rounds) finish(rowsRef.current);
    else { PlaySuccessSound(); setInterlude(row); }
  };
  const tapCenter = () => { if (checksRef.current?.respond()) PlaySuccessSound(); };

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

  const count = 3 * settings.rings * (settings.rings + 1);
  const yesNo = (value: boolean) => value ? (en ? 'On' : '開啟') : (en ? 'Off' : '關閉');
  const summaryItems = [
    { label: en ? 'Rings' : '圈數', value: en ? `${settings.rings} (${count} numbers)` : `${settings.rings} 圈（${count} 個數字）` },
    { label: en ? 'Rounds' : '回合數', value: String(settings.rounds) },
    { label: en ? 'Centre checks' : '中央提示', value: yesNo(settings.centerChecks) },
  ];
  const hints: Record<string, string> = en ? {
    rings: 'Two rings hold 18 numbers; three rings hold 36 and reach further from the centre.',
    rounds: 'Each round uses a new layout. You can rest between rounds.',
  } : {
    rings: '2 圈有 18 個數字；3 圈有 36 個數字，離中央更遠。',
    rounds: '每回合重新排列數字，回合之間可以休息。',
  };
  const score = BuildGameScore(rows, settings.rounds);
  const summary = score.summary;
  const search = searchRef.current;
  return <div ref={rootRef} className="hex-schulte-game-root">
    <div ref={jsPsychHostRef} className="hex-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <HexTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog hex-schulte-phase-menu" aria-labelledby="hex-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="hex-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            {rangeSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}：<output>{settings[field.key]}</output>
              <input name={field.key} type="range" min={field.min} max={field.max} step={field.step} value={settings[field.key]}
                onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })} />
              <small className="training-setting-description">{hints[field.key]}</small></label>)}
            <label className="hex-checkbox"><input name="centerChecks" type="checkbox" checked={settings.centerChecks}
              onChange={event => setSettings({ ...settings, centerChecks: event.target.checked })} /> {en ? 'Centre checks' : '中央提示'}
              <small className="training-setting-description">{en ? 'Now and then the centre mark lights up. Tap it while it is lit, which keeps your eyes on the centre.'
                : '中央記號偶爾會亮起，亮起時點一下中央，幫助眼睛停在中央。'}</small></label>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="hex-stage hex-running" aria-label={title}>
      <header className="hex-hud">
        <p className="hex-round">{en ? `Round ${roundIndex + 1} of ${settings.rounds}` : `第 ${roundIndex + 1} 回合，共 ${settings.rounds} 回合`}</p>
        <p className="hex-next">{en ? 'Find' : '下一個'} <strong>{search && !search.done ? search.next : ''}</strong></p>
        <p ref={clockRef} className="hex-clock">0.0 {en ? 's' : '秒'}</p>
        <button type="button" className="btn btn-ghost hex-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <p className="hex-feedback" role="status" data-tone={wrong === null && centerShowing ? 'center' : undefined}>{wrong !== null && search
        ? (en ? `${wrong} is not next. Find ${search.next}.` : `${wrong} 不是下一個，請找 ${search.next}。`)
        : centerShowing ? (en ? 'The centre is lit. Tap it.' : '中央亮起，請點中央。') : ''}</p>
      <HexBoard rings={settings.rings} cells={board} found={search?.found} wrong={wrong} centerShowing={centerShowing}
        label={en ? 'Number hexagons' : '數字六角格'} centerLabel={en ? 'Centre mark' : '中央記號'} foundLabel={en ? 'found' : '已找到'}
        onCell={tapCell} onCenter={tapCenter} />
      {interlude && <section className="hex-interlude" aria-labelledby="hex-interlude-title">
        <div className="hex-interlude-panel">
          <h2 id="hex-interlude-title">{en ? `Round ${interlude.round} complete` : `第 ${interlude.round} 回合完成`}</h2>
          <p>{en ? `Time ${seconds(interlude.timeMs)}, wrong taps ${interlude.errors}` : `用時 ${seconds(interlude.timeMs)}，點錯 ${interlude.errors} 次`}</p>
          {settings.centerChecks && <p>{en ? `Centre checks caught ${interlude.centerHits} of ${interlude.centerChecks}` : `中央提示按到 ${interlude.centerHits} / ${interlude.centerChecks} 次`}</p>}
          <button type="button" className="btn btn-primary hex-next-round" autoFocus onClick={() => beginRound(interlude.round)}>{en ? 'Next round' : '下一回合'}</button>
        </div>
      </section>}
    </main>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Mean time per round' : '平均每回合時間'}</p><strong>{seconds(summary.meanRoundMs)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Wrong taps' : '點錯次數'}</p><strong>{summary.totalErrors}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Centre checks caught' : '中央提示按到'}</p><strong>{summary.centerChecks ? `${summary.centerHits} / ${summary.centerChecks}` : (en ? 'Off' : '未開啟')}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Rounds completed' : '完成回合'}</dt><dd>{summary.roundsCompleted} / {summary.roundsPlanned}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Fastest round' : '最快回合'}</dt><dd>{seconds(summary.bestRoundMs)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Centre checks caught' : '中央提示按到比例'}</dt><dd>{summary.centerHitPercent === null ? (en ? 'N/A' : '無') : `${summary.centerHitPercent}%`}</dd></div>
      </dl></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}
