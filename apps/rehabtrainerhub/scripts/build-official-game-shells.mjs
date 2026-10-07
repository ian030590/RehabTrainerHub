import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, cp } from 'node:fs/promises';
import { resolve } from 'node:path';

const appRoot = resolve(import.meta.dirname, '..');
const repoRoot = resolve(appRoot, '../..');
const outputRoot = resolve(appRoot, 'out');
const shellOutputRoot = resolve(outputRoot, '.official-game-shells');
const gamesRoot = resolve(appRoot, 'games');

if (!existsSync(outputRoot)) {
  throw new Error('Next.js static output is missing. Build the Hub before its official games.');
}

await rm(shellOutputRoot, { recursive: true, force: true });
await mkdir(shellOutputRoot, { recursive: true });

const catalogSource = await readFile(resolve(gamesRoot, 'catalog.ts'), 'utf8');
const gameIds = [...catalogSource.matchAll(
  /\{\s*id:\s*'([^']+)',\s*trainer:\s*'([^']+)'/g,
)].map((m) => m[1]);

console.log(`Copying ${gameIds.length} built official game shells to Hub output...`);

await Promise.all(gameIds.map(async (gameId) => {
  const gameDistDir = resolve(gamesRoot, gameId, 'dist');
  const outDir = resolve(shellOutputRoot, gameId);
  if (!existsSync(gameDistDir)) {
    throw new Error(`Missing built output for ${gameId}. Expected ${gameDistDir} to exist. Did you run 'turbo build'?`);
  }
  await cp(gameDistDir, outDir, { recursive: true });
}));

console.log(`Successfully copied ${gameIds.length} official game shells.`);
