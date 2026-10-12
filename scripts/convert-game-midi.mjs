import midiPackage from '@tonejs/midi';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath || !outputPath.endsWith('.json') || resolve(inputPath) === resolve(outputPath)) {
  console.error('Usage: node scripts/convert-game-midi.mjs input.mid games/game-id/music/theme.json');
  process.exitCode = 1;
} else {
  const { Midi } = midiPackage;
  const midi = new Midi(await readFile(inputPath));
  await mkdir(dirname(resolve(outputPath)), { recursive: true });
  await writeFile(outputPath, JSON.stringify(midi.toJSON(), null, 2) + '\n');
  console.log(`Converted ${midi.tracks.length} tracks to ${outputPath}`);
}
