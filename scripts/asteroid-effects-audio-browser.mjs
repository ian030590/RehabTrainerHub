import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Browser instrumentation only: measure real Tone output and a 500–3000 Hz small-speaker approximation.
export async function CheckAsteroidEffects({ evaluate, contextId, root }) {
  const directory = resolve(root, '.tmp/asteroid-audio-balance-release/audio');
  await mkdir(directory, { recursive: true });
  const measurements = {};
  for (const kind of ['baseline', 'fall', 'success', 'victory', 'damage', 'defeat', 'mix']) {
    const result = await evaluate(`window.captureEffect(${JSON.stringify(kind)})`, contextId);
    assert.ok(result.samples.length > 10000 && Number.isFinite(result.speakerBandRms), `${kind}: capture actual audio samples`);
    assert.ok(result.peak < 1, `${kind}: the waveform must not clip: ${result.peak}`);
    const wave = Buffer.alloc(44 + result.samples.length * 2);
    wave.write('RIFF'); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVEfmt ', 8);
    wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22);
    wave.writeUInt32LE(result.sampleRate, 24); wave.writeUInt32LE(result.sampleRate * 2, 28);
    wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34); wave.write('data', 36); wave.writeUInt32LE(wave.length - 44, 40);
    result.samples.forEach((sample, index) => wave.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + index * 2));
    await writeFile(resolve(directory, `${kind}.wav`), wave);
    const { samples, ...metrics } = result;
    measurements[kind] = { ...metrics, sampleCount: samples.length };
    console.log(`${kind}: peak ${result.peak.toFixed(4)}, RMS ${result.rms.toFixed(5)}, speaker-band RMS ${result.speakerBandRms.toFixed(5)}`);
  }
  assert.equal(measurements.mix.compressorNodes, 0, 'Remove the master compressor/limiter to reduce audio processing.');
  for (const [kind, reference] of [['damage', 'success'], ['defeat', 'victory']]) {
    for (const field of ['loudestRms', 'speakerBandLoudestRms']) {
      const differenceDb = 20 * Math.log10(measurements[kind][field] / measurements[reference][field]);
      measurements[kind][`${field}DifferenceDb`] = differenceDb;
      console.log(`${kind}/${reference}: ${differenceDb.toFixed(2)} dB in ${field}`);
      assert.ok(Math.abs(differenceDb) <= 3, `${kind}/${reference}: match perceived cue level within 3 dB in ${field}: ${differenceDb}`);
    }
  }
  assert.ok(measurements.fall.speakerBandRms > .003, 'The fall must remain audible in the speaker band.');
  for (const kind of ['damage', 'defeat']) {
    const improvementDb = 20 * Math.log10(measurements[kind].speakerBandRms / measurements.baseline.speakerBandRms);
    measurements[kind].speakerBandImprovementDb = improvementDb;
    assert.ok(improvementDb >= 12, `${kind}: at least 12 dB more speaker-band energy than the previous failure cue: ${improvementDb}`);
  }
  await writeFile(resolve(directory, 'measurements.json'), JSON.stringify({
    checkedAt: new Date().toISOString(), method: 'Actual Brave PCM output; loudest 100 ms RMS plus high-pass 500 Hz/low-pass 3000 Hz, not physical speaker acceptance',
    baseline: 'Previous 2.0.7 sine warning at -21 dB, 246.94/185 Hz, reproduced with the same Tone envelope', measurements,
  }, null, 2) + '\n');
  console.log('Asteroid audio balance passed: positive/negative cues within 3 dB; no compressor/limiter; falling sound audible; direct output does not clip.');
}
