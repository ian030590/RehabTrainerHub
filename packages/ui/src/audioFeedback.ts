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

export interface AudioFeedbackSettings {
  enabled: boolean;
  volumePercent?: number;
}

export interface AudioFeedbackController {
  PrepareAudioFeedback: (jsPsychSource?: unknown) => void;
  PlaySuccessSound: (jsPsychSource?: unknown) => void;
  PlayFailureSound: (jsPsychSource?: unknown) => void;
  PlayGameEndSound: (
    result: 'Victory' | 'Defeat' | 'Draw' | 'Stopped',
    jsPsychSource?: unknown,
  ) => void;
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

export function CreateAudioFeedbackController(
  getSettings: () => AudioFeedbackSettings,
): AudioFeedbackController {
  let fallbackAudioContext: AudioContext | null = null;

  const getActiveSettings = (): Required<AudioFeedbackSettings> => {
    try {
      const settings = getSettings();
      return {
        enabled: settings.enabled,
        volumePercent: Clamp(settings.volumePercent ?? 50, 0, 100),
      };
    } catch {
      return { enabled: false, volumePercent: 0 };
    }
  };

  const getAudioContext = (source?: unknown): AudioContext | null => {
    const jsPsych = UnwrapJsPsych(source);
    try {
      const jsPsychAudioContext = jsPsych?.pluginAPI?.audioContext?.();
      if (jsPsychAudioContext) return jsPsychAudioContext;
    } catch (error) {
      console.warn('Unable to access jsPsych audio context.', error);
    }

    if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return null;
    fallbackAudioContext ??= new AudioContext();
    return fallbackAudioContext;
  };

  const playSound = (kind: SoundKind, source?: unknown): void => {
    const settings = getActiveSettings();
    if (!settings.enabled || settings.volumePercent <= 0) return;
    const audioContext = getAudioContext(source);
    if (!audioContext) return;

    ResumeAudioContext(audioContext);
    const volume = (settings.volumePercent / 100) * 0.18;
    const startAt = audioContext.currentTime + 0.01;
    soundSequences[kind].forEach((step) => PlayTone(audioContext, step, startAt, volume));
  };

  return {
    PrepareAudioFeedback(source?: unknown) {
      const settings = getActiveSettings();
      if (!settings.enabled || settings.volumePercent <= 0) return;
      ResumeAudioContext(getAudioContext(source));
    },
    PlaySuccessSound(source?: unknown) {
      playSound('success', source);
    },
    PlayFailureSound(source?: unknown) {
      playSound('failure', source);
    },
    PlayGameEndSound(result, source?: unknown) {
      if (result === 'Victory') playSound('victory', source);
      if (result === 'Defeat') playSound('defeat', source);
    },
  };
}

function UnwrapJsPsych(source: unknown): JsPsychAudioProvider | null {
  const current = (source as JsPsychRef | null)?.current;
  const candidate = current ?? source;
  if (!candidate || typeof candidate !== 'object') return null;
  return candidate as JsPsychAudioProvider;
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
