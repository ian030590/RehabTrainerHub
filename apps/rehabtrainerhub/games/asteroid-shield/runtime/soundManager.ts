import { Context, Filter, Limiter, NoiseSynth, PolySynth, Synth } from 'tone/build/esm/classes.js';
import { setContext } from 'tone/build/esm/core/Global.js';

export type MusicWaveform = 'sine' | 'square' | 'triangle' | 'sawtooth' | 'white-noise';
export interface MidiNote { midi: number; time: number; duration: number; velocity: number }
export interface MidiScore { tracks: { notes: MidiNote[]; instrument?: { number?: number; percussion?: boolean } }[] }
export interface MidiMusicOptions { waveforms?: MusicWaveform[]; loop?: boolean; loopEnd?: number }
type FeedbackTone = { frequency: number; duration: number; delay?: number };

let audio: Context | null = null;
let feedback: PolySynth<Synth> | null = null;
let alerts: PolySynth<Synth> | null = null;
let fallingNoise: NoiseSynth | null = null;
let fallingFilter: Filter | null = null;
let output: Limiter | null = null;
let lastDamageAt = -Infinity;
let lastFallAt = -Infinity;
let musicVoices: (PolySynth<Synth> | NoiseSynth)[] = [];
let enabled = true;
let musicGeneration = 0;
const waveforms: MusicWaveform[] = ['sine', 'square', 'triangle', 'sawtooth', 'white-noise'];
const sequences = {
  success: [{ frequency: 523.25, duration: .07 }, { frequency: 659.25, duration: .08, delay: .06 }, { frequency: 783.99, duration: .1, delay: .13 }],
  failure: [{ frequency: 987.77, duration: .1 }, { frequency: 739.99, duration: .12, delay: .1 }, { frequency: 554.37, duration: .22, delay: .22 }],
  victory: [{ frequency: 523.25, duration: .08 }, { frequency: 659.25, duration: .08, delay: .07 }, { frequency: 783.99, duration: .08, delay: .14 }, { frequency: 1046.5, duration: .16, delay: .21 }],
  defeat: [{ frequency: 880, duration: .16 }, { frequency: 659.25, duration: .18, delay: .15 }, { frequency: 440, duration: .36, delay: .32 }],
};

function GetAudio(): Context | null {
  if (!audio) {
    try {
      // The official package CSP prohibits Worker/blob clocks. Every node uses this game-owned context.
      audio = new Context({ clockSource: 'timeout', lookAhead: .05 });
      setContext(audio);
      if (typeof window !== 'undefined') window.addEventListener('pagehide', DisposeAudioFeedback);
    } catch { return null; }
  }
  return audio;
}

export function SetSoundEnabled(value: boolean) {
  enabled = value;
  if (!enabled) DisposeAudioFeedback();
}

export function PrepareAudioFeedback(_source?: unknown) {
  if (enabled) void GetAudio()?.resume().catch(() => undefined);
}

function GetOutput(context: Context): Limiter {
  return output ??= new Limiter({ context, threshold: -3 }).connect(context.destination);
}

function PlaySequence(tones: FeedbackTone[], _source?: unknown, warning = false) {
  if (!enabled) return;
  const context = GetAudio();
  if (!context) return;
  void context.resume().catch(() => undefined);
  const voice = warning
    ? alerts ??= new PolySynth({ context, voice: Synth, maxPolyphony: 16, volume: -9,
      options: { oscillator: { type: 'square' }, envelope: { attack: .003, decay: .03, sustain: .7, release: .05 } },
    }).connect(GetOutput(context))
    : feedback ??= new PolySynth({ context, voice: Synth, maxPolyphony: 16, volume: -21,
    options: { oscillator: { type: 'sine' }, envelope: { attack: .015, decay: .02, sustain: .8, release: .02 } },
  }).connect(GetOutput(context));
  const startAt = context.now() + .01;
  for (const tone of tones) voice.triggerAttackRelease(tone.frequency, tone.duration, startAt + (tone.delay ?? 0), 1);
}

export const PlaySuccessSound = (source?: unknown) => PlaySequence(sequences.success, source);
export function PlayFailureSound(source?: unknown) {
  if (!enabled) return;
  const context = GetAudio();
  if (!context || context.now() - lastDamageAt < .15) return;
  lastDamageAt = context.now();
  PlaySequence(sequences.failure, source, true);
}

export function PlayAsteroidFallSound() {
  if (!enabled) return;
  const context = GetAudio();
  if (!context) return;
  const startAt = context.now() + .01;
  if (startAt - lastFallAt < .1) return;
  lastFallAt = startAt;
  void context.resume().catch(() => undefined);
  fallingFilter ??= new Filter({ context, type: 'bandpass', frequency: 1800, Q: .8 }).connect(GetOutput(context));
  fallingNoise ??= new NoiseSynth({ context, volume: -12, noise: { type: 'white' },
    envelope: { attack: .01, decay: .12, sustain: .4, release: .1 },
  }).connect(fallingFilter);
  fallingFilter.frequency.setValueAtTime(1800, startAt);
  fallingFilter.frequency.exponentialRampToValueAtTime(650, startAt + .28);
  fallingNoise.triggerAttackRelease(.32, startAt, .8);
}

function StopFallingSound() {
  fallingNoise?.dispose(); fallingNoise = null;
  fallingFilter?.dispose(); fallingFilter = null;
  lastFallAt = -Infinity;
}

export const PlayGameEndSound = (result: string, source?: unknown) => {
  StopMidiMusic();
  alerts?.dispose(); alerts = null;
  lastDamageAt = -Infinity;
  if (result === 'Victory') PlaySequence(sequences.victory, source);
  if (result === 'Defeat') PlaySequence(sequences.defeat, source, true);
};

function ValidateMidiScore(score: MidiScore, options: MidiMusicOptions): number {
  if (!score || !Array.isArray(score.tracks) || score.tracks.length > 16) throw new Error('Invalid MIDI tracks (maximum 16).');
  if (options.waveforms && (!Array.isArray(options.waveforms) || options.waveforms.some(wave => !waveforms.includes(wave)))) {
    throw new Error('Invalid music waveform.');
  }
  let duration = 0;
  let count = 0;
  for (const track of score.tracks) {
    if (!track || !Array.isArray(track.notes)) throw new Error('Invalid MIDI notes.');
    count += track.notes.length;
    if (count > 20000) throw new Error('MIDI score exceeds 20000 notes.');
    for (const note of track.notes) {
      if (!note || !Number.isInteger(note.midi) || note.midi < 0 || note.midi > 127
        || !Number.isFinite(note.time) || note.time < 0 || !Number.isFinite(note.duration) || note.duration <= 0
        || !Number.isFinite(note.velocity) || note.velocity < 0 || note.velocity > 1) throw new Error('Invalid MIDI note.');
      duration = Math.max(duration, note.time + note.duration);
    }
  }
  if (duration > 3600) throw new Error('MIDI score exceeds one hour.');
  if (options.loopEnd !== undefined && (!Number.isFinite(options.loopEnd) || options.loopEnd <= 0 || options.loopEnd < duration)) {
    throw new Error('Music loop end must include every note.');
  }
  return duration;
}

// Tonejs/Midi already converts tempo maps into seconds; do not reinterpret these values as beats.
export async function PlayMidiMusic(score: MidiScore, options: MidiMusicOptions = {}): Promise<boolean> {
  const duration = ValidateMidiScore(score, options);
  StopMidiMusic();
  if (!enabled || duration === 0) return false;
  const context = GetAudio();
  if (!context) return false;
  const generation = musicGeneration;
  try { await context.resume(); } catch { return false; }
  if (!enabled || generation !== musicGeneration || context !== audio) return false;
  const transport = context.transport;
  try {
    score.tracks.forEach((track, index) => {
      if (!track.notes.length) return;
      const waveform = options.waveforms?.[index] ?? (track.instrument?.percussion ? 'white-noise' : 'square');
      const voice = waveform === 'white-noise'
        ? new NoiseSynth({ context, volume: -24, noise: { type: 'white' }, envelope: { attack: .001, decay: .05, sustain: 0, release: .02 } })
        : new PolySynth({ context, voice: Synth, maxPolyphony: 16, volume: -24,
          options: { oscillator: { type: waveform }, envelope: { attack: .005, decay: .02, sustain: .6, release: .02 } } });
      musicVoices.push(voice);
      voice.connect(GetOutput(context));
      let lastNoiseTime = -Infinity;
      for (const note of track.notes) {
        transport.schedule(time => {
          if (!enabled || generation !== musicGeneration || time < context.currentTime) return;
          if (voice instanceof NoiseSynth) {
            // The timeout clock can revisit a percussion tick with sub-microsecond rounding.
            if (time <= lastNoiseTime + .000001) return;
            lastNoiseTime = time;
            voice.triggerAttackRelease(note.duration, time, note.velocity);
          } else voice.triggerAttackRelease(440 * 2 ** ((note.midi - 69) / 12), note.duration, time, note.velocity);
        }, note.time);
      }
    });
    transport.loop = options.loop ?? false;
    transport.loopStart = 0;
    transport.loopEnd = options.loopEnd ?? duration + .05;
    if (!transport.loop) transport.schedule(() => StopMidiMusic(), duration + .05);
    transport.start(context.now() + .01, 0);
    return true;
  } catch (error) { StopMidiMusic(); throw error; }
}

export function StopMidiMusic() {
  StopFallingSound();
  musicGeneration++;
  audio?.transport.stop();
  audio?.transport.cancel();
  musicVoices.forEach(voice => voice.dispose());
  musicVoices = [];
}

export function DisposeAudioFeedback() {
  StopMidiMusic();
  feedback?.dispose();
  feedback = null;
  alerts?.dispose(); alerts = null;
  output?.dispose(); output = null;
  lastDamageAt = -Infinity;
  if (audio) {
    void audio.close().catch(() => undefined);
    audio.dispose();
    audio = null;
  }
  if (typeof window !== 'undefined') window.removeEventListener('pagehide', DisposeAudioFeedback);
}

export const soundManager = { playSuccess: PlaySuccessSound, playFailure: PlayFailureSound, playFall: PlayAsteroidFallSound, playEnd: PlayGameEndSound, prepare: PrepareAudioFeedback,
  playMidi: PlayMidiMusic, stopMusic: StopMidiMusic, dispose: DisposeAudioFeedback };
