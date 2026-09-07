import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

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

console.log(`Building ${gameIds.length} official game shells from games/...`);

const reactPlugin = react();
const concurrency = 4;

for (let i = 0; i < gameIds.length; i += concurrency) {
  const batch = gameIds.slice(i, i + concurrency);
  await Promise.all(batch.map(async (gameId) => {
    const gameSourceDir = resolve(gamesRoot, gameId);
    await build({
      root: gameSourceDir,
      base: './',
      plugins: [reactPlugin],
      resolve: {
        alias: {
          '@rehab-trainer/ui': resolve(repoRoot, 'packages/ui/src'),
          '@rehab-trainer/games': gamesRoot,
          '@rehab-trainer/hub-modules': gamesRoot,
        },
      },
      build: {
        assetsDir: 'assets',
        emptyOutDir: true,
        outDir: resolve(shellOutputRoot, gameId),
      },
      logLevel: 'error',
    });
  }));
  console.log(`Built ${Math.min(i + concurrency, gameIds.length)}/${gameIds.length} official game shells.`);
}
