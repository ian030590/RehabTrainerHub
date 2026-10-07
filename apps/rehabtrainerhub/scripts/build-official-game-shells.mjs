import { spawnSync } from 'node:child_process';
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

const missingGameIds = gameIds.filter((gameId) => !existsSync(resolve(gamesRoot, gameId, 'dist')));
if (missingGameIds.length > 0) {
  console.log(`Building ${missingGameIds.length} missing official game shells with Turborepo...`);
  const isWindows = process.platform === 'win32';
  const command = isWindows ? (process.env.ComSpec ?? 'cmd.exe') : 'npx';
  const args = isWindows
    ? ['/d', '/s', '/c', 'npx', 'turbo', 'run', 'build', '--filter=./apps/rehabtrainerhub/games/*']
    : ['turbo', 'run', 'build', '--filter=./apps/rehabtrainerhub/games/*'];
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`Failed to build missing game shells with exit code ${result.status}`);
  }
}

console.log(`Copying ${gameIds.length} built official game shells to Hub output...`);

await Promise.all(gameIds.map(async (gameId) => {
  const gameDistDir = resolve(gamesRoot, gameId, 'dist');
  const outDir = resolve(shellOutputRoot, gameId);
  if (!existsSync(gameDistDir)) {
    throw new Error(`Missing built output for ${gameId}. Expected ${gameDistDir} to exist.`);
  }
  await cp(gameDistDir, outDir, { recursive: true });
}));

console.log(`Successfully copied ${gameIds.length} official game shells.`);
