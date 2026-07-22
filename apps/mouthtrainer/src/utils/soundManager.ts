import { GetSetting } from './settings';

type SoundKind = 'success' | 'failure' | 'victory' | 'defeat';
type JsPsychAudioProvider = { pluginAPI?: { audioContext?: () => AudioContext | null } };

const soundSteps: Record<SoundKind, readonly [number, number, number?][]> = {
  success: [[523.25, 0.07], [659.25, 0.08, 0.06], [783.99, 0.1, 0.13]],
  failure: [[246.94, 0.11], [185, 0.16, 0.1]],
  victory: [[523.25, 0.08], [659.25, 0.08, 0.07], [783.99, 0.08, 0.14], [1046.5, 0.16, 0.21]],
  defeat: [[220, 0.1], [164.81, 0.12, 0.09], [130.81, 0.18, 0.19]],
};

let fallbackContext: AudioContext | null = null;

export function PrepareAudioFeedback(source?: unknown) {
  if (IsEnabled()) Resume(GetContext(source));
}

export function PlaySuccessSound(source?: unknown) { Play('success', source); }
export function PlayFailureSound(source?: unknown) { Play('failure', source); }
export function PlayGameEndSound(result: 'Victory' | 'Defeat' | 'Draw' | 'Stopped', source?: unknown) {
  if (result === 'Victory') Play('victory', source);
  if (result === 'Defeat') Play('defeat', source);
}

function Play(kind: SoundKind, source?: unknown) {
  if (!IsEnabled()) return;
  const context = GetContext(source);
  if (!context) return;
  Resume(context);
  const startAt = context.currentTime + 0.01;
  const volume = Math.max(0, Math.min(1, GetSetting('soundVolume') / 100)) * 0.18;
  soundSteps[kind].forEach(([frequency, duration, delay = 0]) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const toneStart = startAt + delay;
    const toneEnd = toneStart + duration;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, toneStart);
    gain.gain.setValueAtTime(0.0001, toneStart);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), toneStart + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, toneEnd);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(toneStart);
    oscillator.stop(toneEnd + 0.02);
  });
}

function IsEnabled() { return GetSetting('auditoryFeedbackEnabled') && GetSetting('soundVolume') > 0; }
function GetContext(source?: unknown): AudioContext | null {
  try {
    const candidate = ((source as { current?: unknown } | undefined)?.current ?? source) as JsPsychAudioProvider | undefined;
    const context = candidate?.pluginAPI?.audioContext?.();
    if (context) return context;
  } catch { /* Use the browser fallback. */ }
  if (typeof window === 'undefined' || !window.AudioContext) return null;
  fallbackContext ??= new AudioContext();
  return fallbackContext;
}
function Resume(context: AudioContext | null) { if (context && context.state !== 'running') void context.resume().catch(() => undefined); }
