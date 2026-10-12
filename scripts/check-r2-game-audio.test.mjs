import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import midiPackage from '@tonejs/midi';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const root = resolve(import.meta.dirname, '..');
const gameIds = Object.keys(JSON.parse(await readFile(resolve(root, 'packages/ui/src/officialGameReleases.json'), 'utf8')));
// The seconds and normalized velocities are the fields exported by Tonejs/Midi.toJSON().
const song = { header: { ppq: 480, tempos: [{ ticks: 0, bpm: 120 }, { ticks: 480, bpm: 60 }] }, tracks: [
  { notes: [{ midi: 60, time: 0, duration: .5, velocity: .8 }, { midi: 64, time: 0, duration: .5, velocity: .4 },
    { midi: 67, time: .5, duration: 1, velocity: .7 }], instrument: { number: 0, percussion: false } },
  { notes: [{ midi: 36, time: .25, duration: .1, velocity: .6 }], instrument: { percussion: true } },
] };

test('asteroid-shield: supplied tracks and triangle bass one octave higher play together in a complete 48-second loop', async () => {
  const gameRoot = resolve(root, 'apps/rehabtrainerhub/games/asteroid-shield');
  const source = await readFile(resolve(gameRoot, 'music.ts'), 'utf8');
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText)(createRequire(resolve(gameRoot, 'music.ts')), module, module.exports);
  const { backgroundMusic: score, backgroundMusicOptions: options } = module.exports;
  assert.ok(score, 'The supplied composition must be configured for gameplay.');
  assert.deepEqual(options, { loop: true, loopEnd: 48, waveforms: ['square', 'square', 'white-noise', 'triangle'] });
  const originals = [];
  for (const [file, count, hash] of [
    ['melody.json', 167, 'd41eaae7ea8dfa2e76a841df6a039b3df914364ce551bad62267132ef0e3fcbe'],
    ['harmony.json', 480, 'db24a3f4147482bba99ad144c3369a058902a08d68af4d822a46602b22d40913'],
    ['percussion.json', 246, 'd17765c4bb85d6184fcb6c8305af647fbbd0d6a6ccb4877fc22764e7783b5d9d'],
    ['bass.json', 156, '75b5ce7cf1e7d6c37a67acf6b7ce909e0607be95e78d92b9f7af1af8f345d213'],
  ]) {
    const bytes = await readFile(resolve(gameRoot, 'music', file));
    const original = JSON.parse(bytes.toString('utf8'));
    assert.equal(createHash('sha256').update(JSON.stringify(original)).digest('hex'), hash, `${file}: retain the supplied JSON data across checkout line endings.`);
    assert.equal(original.tracks[0].notes.length, count);
    originals.push(...original.tracks);
  }
  assert.deepEqual(score.tracks.slice(0, 3), originals.slice(0, 3), 'Keep the original melody, harmony and drums.');
  assert.equal(score.tracks[3].notes[0].midi, 57, 'The original A2 bass starts at A3.');
  assert.equal(score.tracks[3].notes.at(-1).midi, 61, 'The final C#3 bass ends at C#4.');
  assert.deepEqual(score.tracks[3].notes.map(note => ({ ...note, midi: note.midi - 12 })), originals[3].notes,
    'Only the bass MIDI pitch changes; retain every original note, timing and velocity.');
  const { api, state } = await LoadSound('asteroid-shield');
  assert.equal(await api.PlayMidiMusic(score, options), true);
  const transport = state.contexts[0].transport;
  assert.equal(transport.loop, true);
  assert.equal(transport.loopEnd, 48, 'Loop on the original bar boundary without an added gap.');
  assert.equal(transport.events.length, 1049);
  assert.deepEqual(transport.events.map(event => event.time), originals.flatMap(track => track.notes.map(note => note.time)));
  for (const event of transport.events) event.callback(10 + event.time);
  assert.deepEqual(state.instruments.map(instrument => instrument.kind), ['poly', 'poly', 'noise', 'poly']);
  assert.deepEqual(state.instruments.filter(instrument => instrument.kind === 'poly').map(instrument => instrument.options.options.oscillator.type), ['square', 'square', 'triangle']);
  assert.equal(state.instruments[2].options.noise.type, 'white');
  originals.forEach((track, index) => {
    assert.deepEqual(state.instruments[index].played, track.notes.map(note => index === 2
      ? [note.duration, 10 + note.time, note.velocity]
      : [440 * 2 ** ((note.midi + (index === 3 ? 12 : 0) - 69) / 12), note.duration, 10 + note.time, note.velocity]));
  });
  assert.equal(state.instruments[3].played[0][0], 220, 'Triangle bass must actually sound at A3.');
  api.SetSoundEnabled(false);
  assert.equal(transport.events.length, 0);
  assert.ok(state.instruments.every(instrument => instrument.disposed));
  assert.equal(state.contexts[0].closed, true);
});

test('asteroid-shield: a delayed browser clock skips expired notes and resumes on the shared timeline', async () => {
  const { api, state } = await LoadSound('asteroid-shield');
  await api.PlayMidiMusic(song, { waveforms: ['square', 'white-noise'], loop: true });
  const context = state.contexts[0];
  context.currentTime = 1;
  for (const event of context.transport.events) event.callback(event.time);
  assert.ok(state.instruments.every(instrument => instrument.played.length === 0),
    'Late hits must not collapse onto one noise start time or play out of sync.');
  context.transport.events[2].callback(1.5);
  assert.deepEqual(state.instruments[0].played, [[391.99543598174927, 1, 1.5, .7]]);
  api.DisposeAudioFeedback();
});

test('asteroid-shield: repeated percussion ticks do not double-trigger noise or suppress pitched chords', async () => {
  const { api, state } = await LoadSound('asteroid-shield');
  await api.PlayMidiMusic(song, { waveforms: ['square', 'white-noise'], loop: true });
  const events = state.contexts[0].transport.events;
  events[3].callback(10.25);
  events[3].callback(10.25 + Number.EPSILON * 8);
  assert.deepEqual(state.instruments[1].played, [[.1, 10.25, .6]], 'A revisited clock tick must play the drum once.');
  events[3].callback(12.25);
  assert.deepEqual(state.instruments[1].played, [[.1, 10.25, .6], [.1, 12.25, .6]], 'The next loop must still play the drum.');
  events[0].callback(10);
  events[1].callback(10);
  assert.equal(state.instruments[0].played.length, 2, 'Pitched voices must keep simultaneous chord notes.');
  api.DisposeAudioFeedback();
});

test('MIDI converter produces unmodified Tonejs/Midi JSON that every migrated game can play', async () => {
  const { Midi } = midiPackage;
  const midi = new Midi();
  midi.header.tempos = [{ ticks: 0, bpm: 120 }, { ticks: 480, bpm: 60 }];
  midi.header.update();
  const track = midi.addTrack();
  track.addNote({ midi: 60, ticks: 0, durationTicks: 480, velocity: .8 });
  track.addNote({ midi: 64, ticks: 480, durationTicks: 480, velocity: .6 });
  await mkdir(resolve(root, '.tmp'), { recursive: true });
  const directory = await mkdtemp(resolve(root, '.tmp/midi-converter-'));
  const input = resolve(directory, 'theme.mid');
  const output = resolve(directory, 'music/theme.json');
  await writeFile(input, midi.toArray());
  const result = spawnSync(process.execPath, [resolve(root, 'scripts/convert-game-midi.mjs'), input, output], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const score = JSON.parse(await readFile(output, 'utf8'));
  assert.deepEqual(score, new Midi(await readFile(input)).toJSON());
  assert.deepEqual(score.tracks[0].notes.map(note => [note.time, note.duration]), [[0, .5], [.5, 1]]);
  for (const gameId of gameIds) {
    const { api, state } = await LoadSound(gameId);
    assert.equal(await api.PlayMidiMusic(score), true);
    for (const event of state.contexts[0].transport.events.slice(0, 2)) event.callback(event.time);
    assert.equal(state.instruments[0].played.length, 2);
    api.DisposeAudioFeedback();
  }
});

for (const gameId of gameIds) {
  test(`${gameId}: MIDI JSON plays chords, tempo changes and white noise through Tone`, async () => {
    const { api, state } = await LoadSound(gameId);
    assert.equal(state.contexts.length, 0, 'Loading the settings must not create or resume audio.');
    assert.equal(await api.PlayMidiMusic(song, { waveforms: ['square', 'white-noise'], loop: true, loopEnd: 2 }), true);
    const context = state.contexts[0];
    assert.equal(context.options.clockSource, 'timeout', 'The package CSP prohibits Workers.');
    assert.equal(context.transport.loopEnd, 2);
    assert.equal(context.transport.loop, true);
    assert.deepEqual(context.transport.events.map(event => event.time), [0, 0, .5, .25]);
    for (const event of context.transport.events) event.callback(10 + event.time);
    const pitched = state.instruments.find(instrument => instrument.kind === 'poly');
    const noise = state.instruments.find(instrument => instrument.kind === 'noise');
    assert.equal(pitched.options.options.oscillator.type, 'square');
    assert.deepEqual(pitched.played, [[261.6255653005986, .5, 10, .8], [329.6275569128699, .5, 10, .4],
      [391.99543598174927, 1, 10.5, .7]]);
    assert.deepEqual(noise.played, [[.1, 10.25, .6]]);
    api.StopMidiMusic();
    assert.equal(context.transport.events.length, 0);
    assert.ok(pitched.disposed && noise.disposed, 'Stopping music must silence active notes as well as future notes.');
  });

  test(`${gameId}: muting, replacement, exit and pending startup cannot leak music`, async () => {
    const { api, state } = await LoadSound(gameId);
    api.SetSoundEnabled(false);
    assert.equal(await api.PlayMidiMusic(song), false);
    api.PlaySuccessSound();
    assert.equal(state.contexts.length, 0);
    api.SetSoundEnabled(true);
    await api.PlayMidiMusic(song);
    const first = [...state.instruments];
    await api.PlayMidiMusic(song, { waveforms: ['sawtooth', 'triangle'], loop: true });
    assert.ok(first.every(instrument => instrument.disposed));
    assert.equal(state.contexts[0].transport.events.length, 4, 'Replacement must not retain the old song.');
    api.SetSoundEnabled(false);
    assert.ok(state.instruments.every(instrument => instrument.disposed));
    assert.equal(state.contexts[0].transport.events.length, 0);
    api.SetSoundEnabled(true);
    api.PrepareAudioFeedback();
    const current = state.contexts.at(-1);
    let resume;
    current.resume = () => new Promise(resolveResume => { resume = resolveResume; });
    const pending = api.PlayMidiMusic(song);
    api.StopMidiMusic();
    resume();
    assert.equal(await pending, false, 'A late resume after cancellation must not start music.');
    api.DisposeAudioFeedback();
    assert.equal(current.closed, true);
    assert.equal(current.disposed, true);
  });

  test(`${gameId}: malformed notes and unsupported waveforms are rejected before audio starts`, async () => {
    const { api, state } = await LoadSound(gameId);
    for (const patch of [{ midi: 128 }, { midi: 1.5 }, { time: -1 }, { duration: 0 }, { duration: Infinity }, { velocity: 2 }]) {
      const invalid = structuredClone(song);
      Object.assign(invalid.tracks[0].notes[0], patch);
      await assert.rejects(api.PlayMidiMusic(invalid), /MIDI/);
    }
    await assert.rejects(api.PlayMidiMusic({ tracks: null }), /MIDI/);
    await assert.rejects(api.PlayMidiMusic(song, { waveforms: ['sampler'] }), /waveform/i);
    await assert.rejects(api.PlayMidiMusic(song, { loop: true, loopEnd: 1 }), /loop/i);
    assert.equal(state.contexts.length, 0);
  });

  test(`${gameId}: existing feedback and lifecycle remain usable with a local Tone dependency`, async () => {
    const { api, state } = await LoadSound(gameId);
    api.PrepareAudioFeedback({ current: { pluginAPI: { audioContext() { throw new Error('Do not borrow the jsPsych context'); } } } });
    api.PlaySuccessSound(); api.PlayFailureSound(); api.PlayGameEndSound('Victory'); api.PlayGameEndSound('Defeat');
    assert.ok(state.instruments.some(instrument => instrument.played.length > 0));
    api.DisposeAudioFeedback();
    assert.ok(state.instruments.every(instrument => instrument.disposed));
    const pkg = JSON.parse(await readFile(resolve(root, `apps/rehabtrainerhub/games/${gameId}/package.json`), 'utf8'));
    assert.ok(pkg.dependencies.tone);
    const source = await readFile(resolve(root, `apps/rehabtrainerhub/games/${gameId}/runtime/soundManager.ts`), 'utf8');
    assert.doesNotMatch(source, /@rehab-trainer\/|packages\/ui|fetch\(|https?:\/\/|new Worker/);
  });

  test(`${gameId}: configured music starts in gameplay and stops on results, settings and unmount`, async () => {
    const components = { 'asteroid-shield': ['AsteroidShieldGame.tsx', 'playing'], 'drawing-defense': ['DrawingTowerDefenseGame.tsx', 'playing'],
      'gesture-battler': ['GestureBattlerGame.tsx', 'combat'], 'motor-cortex-rehab': ['MotorCortexRehabGame.tsx', 'playing'],
      'moving-card': ['MovingCardGame.tsx', 'running'], 'oculomotor-training': ['OculomotorTrainingGame.tsx', 'running'] };
    const [file, playingPhase] = components[gameId];
    const source = await readFile(resolve(root, `apps/rehabtrainerhub/games/${gameId}/${file}`), 'utf8');
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const effects = [];
    const visit = node => {
      if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect') effects.push(node.arguments[0].getText(ast));
      ts.forEachChild(node, visit);
    };
    visit(ast);
    const musicEffect = effects.find(effect => effect.includes('PlayMidiMusic('));
    assert.ok(musicEffect, 'A composer must be able to configure a song without editing the training loop.');
    const calls = [];
    const run = phase => new Function('phase', 'backgroundMusic', 'backgroundMusicOptions', 'PlayMidiMusic', 'StopMidiMusic',
      `return (${musicEffect})();`)(phase, song, {}, () => { calls.push('play'); return Promise.resolve(true); }, () => calls.push('stop'));
    for (const phase of ['menu', 'rules', 'results']) { run(phase)?.(); }
    assert.ok(!calls.includes('play'));
    const cleanup = run(playingPhase);
    assert.equal(calls.at(-1), 'play');
    cleanup();
    assert.equal(calls.at(-1), 'stop');
    assert.ok(effects.some(effect => effect.includes('DisposeAudioFeedback')), 'Unmount must release the game audio context.');
  });
}

async function LoadSound(gameId) {
  const state = { contexts: [], instruments: [] };
  class Context {
    constructor(options) {
      this.options = options; this.currentTime = 0; this.destination = {};
      this.transport = { events: [], loop: false, loopEnd: 0, started: false,
        schedule(callback, time) { this.events.push({ callback, time }); },
        start() { this.started = true; }, stop() { this.started = false; }, cancel() { this.events = []; } };
      state.contexts.push(this);
    }
    resume() { return Promise.resolve(); }
    now() { return 0; }
    close() { this.closed = true; return Promise.resolve(); }
    dispose() { this.disposed = true; }
  }
  class PolySynth {
    constructor(options) { this.kind = 'poly'; this.options = options; this.played = []; state.instruments.push(this); }
    connect() { return this; }
    triggerAttackRelease(...args) { this.played.push(args); }
    dispose() { this.disposed = true; return this; }
  }
  class NoiseSynth extends PolySynth { constructor(options) { super(options); this.kind = 'noise'; } }
  const tone = { Context, PolySynth, NoiseSynth, Synth: class {} };
  const source = await readFile(resolve(root, `apps/rehabtrainerhub/games/${gameId}/runtime/soundManager.ts`), 'utf8');
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(name => {
    if (name === 'tone/build/esm/classes.js') return tone;
    if (name === 'tone/build/esm/core/Global.js') return { setContext: context => { state.defaultContext = context; } };
    throw new Error(`Importing ${name} could eagerly create Tone's Worker context.`);
  }, module, module.exports);
  return { api: module.exports, state };
}
