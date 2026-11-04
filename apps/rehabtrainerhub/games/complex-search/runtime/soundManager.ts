import { Context, NoiseSynth, PolySynth, Synth } from 'tone/build/esm/classes.js';
import { setContext } from 'tone/build/esm/core/Global.js';

export type MusicWaveform = 'sine' | 'square' | 'triangle' | 'sawtooth' | 'white-noise';
export interface MidiNote { midi: number; time: number; duration: number; velocity: number }
export interface MidiScore { tracks: { notes: MidiNote[]; instrument?: { percussion?: boolean } }[] }
export interface MidiMusicOptions { waveforms?: MusicWaveform[]; loop?: boolean; loopEnd?: number }
type FeedbackTone = { frequency: number; duration: number; delay?: number };

let audio: Context | null = null;
let feedback: PolySynth<Synth> | null = null;
let musicVoices: (PolySynth<Synth> | NoiseSynth)[] = [];
let enabled = true;
let musicGeneration = 0;
const waveforms: MusicWaveform[] = ['sine', 'square', 'triangle', 'sawtooth', 'white-noise'];
const sequences = {
  success: [{ frequency: 523.25, duration: .07 }, { frequency: 659.25, duration: .08, delay: .06 }, { frequency: 783.99, duration: .1, delay: .13 }],
  failure: [{ frequency: 246.94, duration: .11 }, { frequency: 185, duration: .16, delay: .1 }],
  victory: [{ frequency: 523.25, duration: .08 }, { frequency: 659.25, duration: .08, delay: .07 }, { frequency: 783.99, duration: .08, delay: .14 }, { frequency: 1046.5, duration: .16, delay: .21 }],
  defeat: [{ frequency: 220, duration: .1 }, { frequency: 164.81, duration: .12, delay: .09 }, { frequency: 130.81, duration: .18, delay: .19 }],
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

function PlaySequence(tones: FeedbackTone[], _source?: unknown) {
  if (!enabled) return;
  const context = GetAudio();
  if (!context) return;
  void context.resume().catch(() => undefined);
  feedback ??= new PolySynth({ context, voice: Synth, maxPolyphony: 16, volume: -21,
    options: { oscillator: { type: 'sine' }, envelope: { attack: .015, decay: .02, sustain: .8, release: .02 } },
  }).connect(context.destination);
  const startAt = context.now() + .01;
  for (const tone of tones) feedback.triggerAttackRelease(tone.frequency, tone.duration, startAt + (tone.delay ?? 0), 1);
}

export const PlaySuccessSound = (source?: unknown) => PlaySequence(sequences.success, source);
export const PlayFailureSound = (source?: unknown) => PlaySequence(sequences.failure, source);
export const PlayGameEndSound = (result: string, source?: unknown) => {
  StopMidiMusic();
  if (result === 'Victory') PlaySequence(sequences.victory, source);
  if (result === 'Defeat') PlaySequence(sequences.defeat, source);
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
      voice.connect(context.destination);
      for (const note of track.notes) {
        transport.schedule(time => {
          if (!enabled || generation !== musicGeneration) return;
          if (voice instanceof NoiseSynth) voice.triggerAttackRelease(note.duration, time, note.velocity);
          else voice.triggerAttackRelease(440 * 2 ** ((note.midi - 69) / 12), note.duration, time, note.velocity);
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
  if (audio) {
    void audio.close().catch(() => undefined);
    audio.dispose();
    audio = null;
  }
  if (typeof window !== 'undefined') window.removeEventListener('pagehide', DisposeAudioFeedback);
}

export const soundManager = { playSuccess: PlaySuccessSound, playFailure: PlayFailureSound, playEnd: PlayGameEndSound, prepare: PrepareAudioFeedback,
  playMidi: PlayMidiMusic, stopMusic: StopMidiMusic, dispose: DisposeAudioFeedback };
