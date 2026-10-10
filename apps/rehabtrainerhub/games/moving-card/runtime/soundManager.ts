let fallbackAudio: AudioContext | null = null;
let enabled = true;
type AudioSource = { pluginAPI?: { audioContext?: () => AudioContext | null } };
type Tone = { frequency: number; duration: number; delay?: number };
const sequences = {
  success: [{ frequency: 523.25, duration: .07 }, { frequency: 659.25, duration: .08, delay: .06 }, { frequency: 783.99, duration: .1, delay: .13 }],
  failure: [{ frequency: 246.94, duration: .11 }, { frequency: 185, duration: .16, delay: .1 }],
  victory: [{ frequency: 523.25, duration: .08 }, { frequency: 659.25, duration: .08, delay: .07 }, { frequency: 783.99, duration: .08, delay: .14 }, { frequency: 1046.5, duration: .16, delay: .21 }],
  defeat: [{ frequency: 220, duration: .1 }, { frequency: 164.81, duration: .12, delay: .09 }, { frequency: 130.81, duration: .18, delay: .19 }],
};
export const SetSoundEnabled = (value: boolean) => { enabled = value; };

function GetAudio(source?: unknown) {
  const provider = ((source as { current?: AudioSource } | null)?.current ?? source) as AudioSource | null;
  try {
    const existing = provider?.pluginAPI?.audioContext?.();
    if (existing) return existing;
  } catch { /* Use the browser fallback if jsPsych has no audio context. */ }
  if (typeof AudioContext === 'undefined') return null;
  fallbackAudio ??= new AudioContext();
  return fallbackAudio;
}
export function PrepareAudioFeedback(source?: unknown) {
  if (!enabled) return;
  const audio = GetAudio(source);
  if (audio && audio.state !== 'running') void audio.resume().catch(() => undefined);
}
function PlaySequence(tones: Tone[], source?: unknown) {
  if (!enabled) return;
  const audio = GetAudio(source);
  if (!audio) return;
  if (audio.state !== 'running') void audio.resume().catch(() => undefined);
  const startAt = audio.currentTime + .01;
  for (const tone of tones) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = startAt + (tone.delay ?? 0);
    const end = start + tone.duration;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(tone.frequency, start);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(.09, start + .015); // Original fixed 50% volume.
    gain.gain.exponentialRampToValueAtTime(.0001, end);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(end + .02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}
export const PlaySuccessSound = (source?: unknown) => PlaySequence(sequences.success, source);
export const PlayFailureSound = (source?: unknown) => PlaySequence(sequences.failure, source);
export const PlayGameEndSound = (result: string, source?: unknown) => {
  if (result === 'Victory') PlaySequence(sequences.victory, source);
  if (result === 'Defeat') PlaySequence(sequences.defeat, source);
};

export const soundManager = { playSuccess: PlaySuccessSound, playFailure: PlayFailureSound };
