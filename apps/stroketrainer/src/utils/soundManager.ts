import { GetSetting } from './settings';

type JsPsychAudioProvider = {
  pluginAPI?: {
    audioContext?: () => AudioContext | null;
  };
};

type JsPsychRef = {
  current?: unknown;
};

type SoundKind = 'success' | 'failure' | 'victory' | 'defeat';

interface ToneStep {
  frequency: number;
  duration: number;
  delay?: number;
}

const soundSequences: Record<SoundKind, ToneStep[]> = {
  success: [
    { frequency: 523.25, duration: 0.07 },
    { frequency: 659.25, duration: 0.08, delay: 0.06 },
    { frequency: 783.99, duration: 0.1, delay: 0.13 },
  ],
  failure: [
    { frequency: 246.94, duration: 0.11 },
    { frequency: 185, duration: 0.16, delay: 0.1 },
  ],
  victory: [
    { frequency: 523.25, duration: 0.08 },
    { frequency: 659.25, duration: 0.08, delay: 0.07 },
    { frequency: 783.99, duration: 0.08, delay: 0.14 },
    { frequency: 1046.5, duration: 0.16, delay: 0.21 },
  ],
  defeat: [
    { frequency: 220, duration: 0.1 },
    { frequency: 164.81, duration: 0.12, delay: 0.09 },
    { frequency: 130.81, duration: 0.18, delay: 0.19 },
  ],
};

let fallbackAudioContext: AudioContext | null = null;

export function PrepareAudioFeedback(jsPsychSource?: unknown): void {
  if (!IsAudioFeedbackEnabled()) return;
  ResumeAudioContext(GetAudioContext(jsPsychSource));
}

export function PlaySuccessSound(jsPsychSource?: unknown): void {
  PlaySound('success', jsPsychSource);
}

export function PlayFailureSound(jsPsychSource?: unknown): void {
  PlaySound('failure', jsPsychSource);
}

export function PlayGameEndSound(result: 'Victory' | 'Defeat' | 'Draw' | 'Stopped', jsPsychSource?: unknown): void {
  if (result === 'Victory') PlaySound('victory', jsPsychSource);
  if (result === 'Defeat') PlaySound('defeat', jsPsychSource);
}

function PlaySound(kind: SoundKind, jsPsychSource?: unknown): void {
  if (!IsAudioFeedbackEnabled()) return;
  const audioContext = GetAudioContext(jsPsychSource);
  if (!audioContext) return;

  ResumeAudioContext(audioContext);
  const volume = GetFeedbackVolume();
  const startAt = audioContext.currentTime + 0.01;
  soundSequences[kind].forEach((step) => PlayTone(audioContext, step, startAt, volume));
}

function GetAudioContext(jsPsychSource?: unknown): AudioContext | null {
  const jsPsych = UnwrapJsPsych(jsPsychSource);
  try {
    const jsPsychAudioContext = jsPsych?.pluginAPI?.audioContext?.();
    if (jsPsychAudioContext) return jsPsychAudioContext;
  } catch (error) {
    console.warn('Unable to access jsPsych audio context.', error);
  }

  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return null;
  fallbackAudioContext ??= new AudioContext();
  return fallbackAudioContext;
}

function UnwrapJsPsych(source: unknown): JsPsychAudioProvider | null {
  const current = (source as JsPsychRef | null)?.current;
  const candidate = current ?? source;
  if (!candidate || typeof candidate !== 'object') return null;
  return candidate as JsPsychAudioProvider;
}

function IsAudioFeedbackEnabled(): boolean {
  try {
    return GetSetting('auditoryFeedbackEnabled') && GetSetting('soundVolume') > 0;
  } catch {
    return false;
  }
}

function GetFeedbackVolume(): number {
  const settingVolume = Clamp(GetSetting('soundVolume') / 100, 0, 1);
  return settingVolume * 0.18;
}

function ResumeAudioContext(audioContext: AudioContext | null): void {
  if (!audioContext || audioContext.state === 'running') return;
  void audioContext.resume().catch(() => undefined);
}

function PlayTone(audioContext: AudioContext, step: ToneStep, startAt: number, volume: number): void {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const toneStart = startAt + (step.delay ?? 0);
  const toneEnd = toneStart + step.duration;

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(step.frequency, toneStart);
  gain.gain.setValueAtTime(0.0001, toneStart);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), toneStart + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, toneEnd);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(toneStart);
  oscillator.stop(toneEnd + 0.02);
}

function Clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
