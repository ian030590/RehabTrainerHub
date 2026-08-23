import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'vite';

const appRoot = resolve(import.meta.dirname, '..');
const outputRoot = resolve(appRoot, 'out');
if (!existsSync(outputRoot)) {
  throw new Error('Next.js static output is missing. Build the Hub before its training runtimes.');
}

for (const trainer of ['motor', 'vision', 'brain', 'mouth']) {
  const runtimeRoot = resolve(appRoot, 'training-runtimes', trainer);
  console.log(`Building Hub training runtime: ${trainer}`);
  await build({
    configFile: resolve(runtimeRoot, 'vite.config.ts'),
    root: runtimeRoot,
  });
}
