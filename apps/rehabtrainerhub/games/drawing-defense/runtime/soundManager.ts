let audio: AudioContext | null = null;
let enabled = true;
export const SetSoundEnabled = (value: boolean) => { enabled = value; };
export function PrepareAudioFeedback(_ref?: unknown) {
  if (!enabled) return;
  audio ??= new AudioContext();
  void audio.resume().catch(() => undefined);
}
function PlayTone(frequency: number) {
  if (!enabled || !audio || audio.state !== 'running') return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.12, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.18);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.2);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}
export const PlaySuccessSound = (_ref?: unknown) => PlayTone(660);
export const PlayFailureSound = (_ref?: unknown) => PlayTone(220);
export const PlayGameEndSound = (result: string, _ref?: unknown) => PlayTone(result === 'Victory' ? 880 : 165);
