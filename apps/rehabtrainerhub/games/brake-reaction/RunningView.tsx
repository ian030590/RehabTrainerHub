import { useEffect, useRef, type RefObject, type ReactNode } from 'react';
import { useT } from './i18n/useT';
import { MakeRoad } from './src/road';
import { DrivingFrame, IsBrakeKey } from './src/drivePresentation';
import { ImpactAt, impactProfiles } from './src/impact';
import { ModelFor, Severity, Simulate, step } from './src/physics';
import { distractionRoundIndex, Judge, RandomFrom, sessionRoundCount, type MakeRound } from './src/round';
import type { Row } from './src/score';
import type { Settings, Scenario } from './settings';
import { PlayBrakeCue, PlayTyreScreech, PrepareAudioFeedback, SetSoundEnabled } from './runtime/soundManager';

export function RunningView({ round, settings, scenario, index, demo, paused, frozen, falseStarts, lastBrakeInput,
  onFalseStart, onFeedback, onPause, sound, onSound, stopControl }: {
  round: ReturnType<typeof MakeRound>;
  settings: Settings;
  scenario: Scenario;
  index: number;
  demo: boolean;
  paused: boolean;
  frozen: boolean;
  falseStarts: number;
  lastBrakeInput: RefObject<number>;
  onFalseStart: () => void;
  onFeedback: (row: Row) => void;
  onPause: () => void;
  sound: boolean;
  onSound: (enabled: boolean) => void;
  stopControl: ReactNode;
}) {
  const { copy: t, lang } = useT();
  const rootRef = useRef<HTMLElement>(null);
  const repaint = useRef<(() => void) | undefined>(undefined);
  const distraction = index === distractionRoundIndex;
  const title = demo ? t.demo : distraction ? t.distraction : (lang === 'zh' ? '第 ' : t.round + ' ') + (index + 1) + ' / ' + sessionRoundCount;
  useEffect(() => {
    if (paused || frozen) {
      const redraw = repaint.current;
      const canvas = rootRef.current?.querySelector('canvas');
      if (!redraw || !canvas) return;
      const observer = new ResizeObserver(redraw);
      observer.observe(canvas);
      return () => observer.disconnect();
    }
    const root = rootRef.current!;
    const Element = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
    const model = ModelFor(settings);
    const stream = RandomFrom(round.messageSeed);
    const canvas = Element<HTMLCanvasElement>('canvas');
    delete canvas.dataset.brakeLitAt;
    const draw = MakeRoad(canvas, round, settings, Element('.drive-bottom'));
    let frame = 0;
    const unbrakedEnd = Simulate(model, round.gap, 10).end;
    const banner = Element('#banner');
    const brake = Element<HTMLButtonElement>('#brake');
    const speed = Element('#speed');
    const started = performance.now();
    const events = new AbortController();
    const listeners = { signal: events.signal };
    let status: 'waiting' | 'settling' | 'done' = 'waiting';
    let onset: number | undefined;
    let settledAt = 0;
    let impactAt: number | undefined;
    let playerDelay = 10;
    let record: Row | undefined;
    let messageAt = 1500 + MessageWait();
    let answered = 0;
    let answerValues: number[] = [];
    let correct = 0;
    const answerButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-answer]')];
    const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');

    function MessageWait() { return 350 + stream() * 450; }

    function ShowMessage() {
      const first = 2 + Math.floor(stream() * 8);
      const second = 2 + Math.floor(stream() * 8);
      const multiply = stream() < .5;
      correct = multiply ? first * second : first + second;
      const offset = 1 + Math.floor(stream() * 3);
      answerValues = [correct, correct + offset, correct - offset].sort((a, b) => a - b);
      const shift = Math.floor(stream() * answerValues.length);
      answerValues = [...answerValues.slice(shift), ...answerValues.slice(0, shift)];
      const left = document.createElement('strong');
      const right = document.createElement('strong');
      left.textContent = String(first);
      right.textContent = String(second);
      Element('#message').replaceChildren(left, multiply ? ' × ' : ' + ', right, ' = ?');
      answerButtons.forEach((button, i) => {
        button.textContent = String(answerValues[i]);
        button.disabled = false;
      });
      PlayBrakeCue('ping');
    }

    for (const [i, button] of answerButtons.entries()) button.addEventListener('click', () => {
      if (status !== 'waiting' || !answerValues.length) return;
      if (answerValues[i] !== correct) {
        if (!motionPreference.matches) {
          button.animate([{ translate: '-3px' }, { translate: '3px' }, { translate: '0' }], 145);
        }
        return;
      }
      answered++;
      answerValues = [];
      messageAt = performance.now() - started + MessageWait();
      Element('#message').textContent = t.noMessage;
      answerButtons.forEach(choice => { choice.disabled = true; });
      if (answerButtons.includes(document.activeElement as HTMLButtonElement)) brake.focus({ preventScroll: true });
    }, listeners);

    function Pause() {
      if (status === 'done') return;
      Finish();
      onPause();
    }

    function Finish() {
      if (status === 'done') return;
      status = 'done';
      cancelAnimationFrame(frame);
      events.abort();
      if (impactAt !== undefined) navigator.vibrate?.(0);
    }

    function React(input: number) {
      if (status !== 'waiting' || input < started) return;
      const judgment = onset === undefined ? { kind: 'falseStart' } as const : Judge(onset, input);
      if (judgment.kind === 'falseStart') {
        Finish();
        onFalseStart();
        return;
      }
      status = 'settling';
      playerDelay = judgment.r + .2;
      settledAt = performance.now();
      record = { scenario, r: judgment.r, timedOut: judgment.kind === 'timeout', falseStarts, answered,
        gap: round.gap, outcome: Simulate(model, round.gap, playerDelay) };
      answerButtons.forEach(button => { button.disabled = true; });
      brake.disabled = true;
    }

    function InputTime(event: Event) {
      const now = performance.now();
      const stamp = event.timeStamp;
      if (stamp <= 0 || stamp > now + 50 ||
          (onset !== undefined && stamp < onset - 50 && now - stamp > 50)) return now;
      return stamp;
    }

    function BrakeInput(event: Event) {
      const input = InputTime(event);
      if (input < started || input - lastBrakeInput.current < 1000 * step) return;
      lastBrakeInput.current = input;
      React(input);
    }

    let brakePlayed = false;
    function Paint() {
      if (status === 'done') return;
      const now = performance.now();
      const sinceStart = now - started;
      if (sinceStart >= 1500 && onset === undefined && sinceStart >= round.onset) {
        onset = now;
        canvas.dataset.brakeLitAt = String(onset);
        PlayBrakeCue('brake');
      } else if (sinceStart >= 1500 && onset === undefined && banner.textContent) {
        banner.textContent = '';
      }
      if (onset !== undefined && status === 'waiting' && now - onset >= 2500) React(onset + 2500);
      if (status === 'waiting' && distraction && !answerValues.length && sinceStart >= messageAt) ShowMessage();

      const elapsed = onset === undefined ? 0 : Math.floor((now - onset) / (1000 * step)) * step;
      const end = record?.outcome.end ?? unbrakedEnd;
      const timeline = onset === undefined ? sinceStart : round.onset + 1000 * elapsed;
      const drive = DrivingFrame(model, round.gap, sinceStart, onset === undefined ? undefined : onset - started,
        elapsed, playerDelay, end);
      if (record && !brakePlayed && elapsed >= playerDelay && playerDelay < end) {
        brakePlayed = true;
        PlayTyreScreech(Math.min(model.speed / model.own, end - playerDelay));
      }
      const grade = record?.outcome.rel == null ? undefined : Severity(record.outcome.rel);
      if (grade && elapsed >= end && impactAt === undefined) {
        impactAt = now;
        PlayBrakeCue(grade);
        if (!motionPreference.matches) navigator.vibrate?.([...impactProfiles[grade].vibration]);
      }
      const impactTime = impactAt === undefined ? 0 : (now - impactAt) / 1000;
      const impact = grade && impactAt !== undefined ? ImpactAt(grade, impactTime, motionPreference.matches) : undefined;
      const speedLabel = Math.round((impact ? 0 : drive.speed) * 3.6) + ' km/h';
      if (speed.textContent !== speedLabel) speed.textContent = speedLabel;
      repaint.current = () => draw(impact ? { ...drive, speed: 0, pitch: 0 } : drive, {
        time: timeline, elapsed: Math.min(elapsed, end), reducedMotion: motionPreference.matches,
        impact: grade && impactAt !== undefined ? ImpactAt(grade, impactTime, motionPreference.matches) : undefined,
      });
      repaint.current();
      const finished = grade ? impactTime >= impactProfiles[grade].feedbackDelay : elapsed >= end + .65;
      if (record && finished && now - settledAt >= 650) {
        Finish();
        onFeedback(record);
        return;
      }
      frame = requestAnimationFrame(Paint);
    }

    window.addEventListener('blur', Pause, listeners);
    let enteredFullscreen = Boolean(document.fullscreenElement);
    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) enteredFullscreen = true;
      else if (enteredFullscreen) Pause();
    }, listeners);
    window.addEventListener('pagehide', Finish, listeners);
    document.addEventListener('visibilitychange', () => { if (document.hidden) Pause(); }, listeners);
    window.addEventListener('keydown', event => {
      if (event.code !== 'Space' || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      if (IsBrakeKey(event)) BrakeInput(event);
    }, { ...listeners, capture: true });
    brake.addEventListener('pointerdown', event => {
      if (event.isPrimary && event.button === 0) BrakeInput(event);
    }, listeners);
    brake.addEventListener('click', event => {
      if (event.detail === 0) BrakeInput(event);
    }, listeners);
    Paint();
    return Finish;
  }, [paused, frozen, round, settings, scenario, distraction, falseStarts, t, lastBrakeInput, onFalseStart, onFeedback, onPause]);

  return <section className="driving" ref={rootRef} inert={paused || frozen} aria-labelledby={paused || frozen ? undefined : "title"}>
    <div className="road-frame">
      <canvas aria-hidden="true" />
    </div>
    <div className="drive-top">
      <header className="drive-toolbar">
        <h2 id={paused || frozen ? undefined : "title"} tabIndex={-1}>{title}</h2>
        <span id="speed" className="drive-speed">{settings.speedKmh} km/h</span>
        <div className="drive-actions">
          <button type="button" className="btn btn-ghost" id="sound" aria-pressed={sound} onClick={() => {
            SetSoundEnabled(!sound);
            if (!sound) PrepareAudioFeedback();
            onSound(!sound);
          }}>{t.sound}</button>
          {stopControl}
        </div>
      </header>
      {distraction && <section className="drive-notification messages" aria-label={t.messages}>
        <div className="notification-copy">
          <p className="notification-sender">{t.messageSender}</p>
          <p className="notification-question" id="message" aria-live="polite">{t.noMessage}</p>
        </div>
        <div id="answers" className="answers">{[0, 1, 2].map(i =>
          <button type="button" key={i} className="btn btn-ghost" data-answer={i} disabled>…</button>,
        )}</div>
      </section>}
      <p id="banner" className="road-caption" role="status">{t.ready}</p>
    </div>
    <div className="drive-stimulus" aria-hidden="true" />
    <div className="drive-bottom">
      <div className="brake-controls">
        <button type="button" className="btn btn-primary" id="brake" aria-describedby="brake-help">{t.brake}</button>
        <p id="brake-help">{t.pressHelp}</p>
      </div>
    </div>
  </section>;
}
