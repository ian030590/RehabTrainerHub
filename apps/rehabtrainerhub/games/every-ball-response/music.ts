import type { MidiMusicOptions, MidiScore } from './runtime/soundManager';

// Import this game's Tonejs/Midi JSON here and assign it to backgroundMusic.
// Microphone mode counts loud sounds as claps, so music played through speakers would be heard as responses.
export const backgroundMusic: MidiScore | null = null;
export const backgroundMusicOptions: MidiMusicOptions = { loop: true };
