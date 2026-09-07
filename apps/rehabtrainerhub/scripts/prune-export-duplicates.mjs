import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = resolve(appRoot, process.argv[2] ?? 'out');

const removeOptions = {
  recursive: true,
  force: true,
  maxRetries: 8,
  retryDelay: 250,
};

await rm(join(outDir, '404'), removeOptions);
await rm(join(outDir, '_not-found'), removeOptions);
console.log('Pruned duplicate export artifacts (404/ and _not-found/).');
