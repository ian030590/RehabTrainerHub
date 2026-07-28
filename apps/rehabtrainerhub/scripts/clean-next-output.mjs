import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const removeOptions = {
  recursive: true,
  force: true,
  maxRetries: 8,
  retryDelay: 250,
};

await rm(join(appRoot, '.next'), removeOptions);
await rm(join(appRoot, 'out'), removeOptions);
