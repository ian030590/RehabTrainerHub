import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));

await rm(join(appRoot, '.next'), { recursive: true, force: true });
await rm(join(appRoot, 'out'), { recursive: true, force: true });
