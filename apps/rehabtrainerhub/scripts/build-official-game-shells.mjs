import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'vite';

const appRoot = resolve(import.meta.dirname, '..');
const outputRoot = resolve(appRoot, 'out');
const shellOutputRoot = resolve(outputRoot, '.official-game-shells');
if (!existsSync(outputRoot)) {
  throw new Error('Next.js static output is missing. Build the Hub before its official games.');
}

await rm(shellOutputRoot, { recursive: true, force: true });
await mkdir(shellOutputRoot, { recursive: true });

// These are build-time compatibility shells only. Nothing is published under
// /runtimes/*: the next step copies a complete shell into each game directory.
for (const trainer of ['motor', 'vision', 'brain', 'mouth']) {
  const compatibilityRoot = resolve(appRoot, 'training-runtimes', trainer);
  console.log(`Building game-owned compatibility shell: ${trainer}`);
  await build({
    base: './',
    build: {
      assetsDir: 'assets',
      emptyOutDir: true,
      outDir: resolve(shellOutputRoot, trainer),
    },
    configFile: resolve(compatibilityRoot, 'vite.config.ts'),
    root: compatibilityRoot,
  });
}
