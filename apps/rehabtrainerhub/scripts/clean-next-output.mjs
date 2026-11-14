import { lstat, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const removeOptions = {
  recursive: true,
  force: true,
  maxRetries: 8,
  retryDelay: 250,
};

const nextRoot = join(appRoot, '.next');
const nextInfo = await lstat(nextRoot).catch(error => {
  if (error.code !== 'ENOENT') throw error;
  return null;
});
if (nextInfo?.isDirectory()) {
  for (const entry of await readdir(nextRoot, { withFileTypes: true })) {
    if (entry.name === 'cache' && entry.isDirectory()) continue;
    await rm(join(nextRoot, entry.name), removeOptions);
  }
} else {
  await rm(nextRoot, removeOptions);
}
await rm(join(appRoot, 'out'), removeOptions);
