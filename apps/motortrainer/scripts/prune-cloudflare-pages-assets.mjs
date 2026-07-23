import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cloudflarePagesAssetLimitBytes = 25 * 1024 * 1024;
const force = process.argv.includes('--force');
const isCloudflarePagesBuild = process.env.CF_PAGES === '1';
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');

if (!force && !isCloudflarePagesBuild) {
  process.exit(0);
}

const oversizedFiles = await FindOversizedFiles(distDir);
if (oversizedFiles.length > 0) {
  const details = oversizedFiles
    .map((file) => `${path.relative(distDir, file.path)} (${FormatMiB(file.size)})`)
    .join('\n');
  throw new Error(`Cloudflare Pages only supports files up to 25 MiB. Oversized files remain:\n${details}`);
}

async function FindOversizedFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await FindOversizedFiles(entryPath));
      continue;
    }
    if (!entry.isFile()) continue;
    const entryStat = await stat(entryPath);
    if (entryStat.size > cloudflarePagesAssetLimitBytes) {
      files.push({ path: entryPath, size: entryStat.size });
    }
  }

  return files;
}

function FormatMiB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}
