import melody from './music/melody.json';
import harmony from './music/harmony.json';
import percussion from './music/percussion.json';
import bass from './music/bass.json';
import type { MidiMusicOptions, MidiScore } from './runtime/soundManager';

export const backgroundMusic: MidiScore = {
  tracks: [...melody.tracks, ...harmony.tracks, ...percussion.tracks, ...bass.tracks.map(track => ({
    ...track,
    notes: track.notes.map(note => ({ ...note, midi: note.midi + 12 })),
  }))],
};
export const backgroundMusicOptions: MidiMusicOptions = {
  loop: true,
  loopEnd: 48,
  waveforms: ['square', 'square', 'white-noise', 'triangle'],
};
