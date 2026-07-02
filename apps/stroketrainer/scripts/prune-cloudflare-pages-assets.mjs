import { access, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLOUDFLARE_PAGES_ASSET_LIMIT_BYTES = 25 * 1024 * 1024;
const force = process.argv.includes('--force');
const isCloudflarePagesBuild = process.env.CF_PAGES === '1';
const hasExternalZhModelUrl = Boolean(process.env.VITE_VOSK_MODEL_ZH_URL?.trim());
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');
const bundledZhModelPath = path.join(distDir, 'models', 'vosk-model-small-zh-tw-0.3.tar.gz');
const bundledEnModelPath = path.join(distDir, 'models', 'vosk-model-small-en-us-0.15.tar.gz');

if (!force && !isCloudflarePagesBuild && !hasExternalZhModelUrl) {
  process.exit(0);
}

await removeIfExists(bundledZhModelPath);
await removeIfExists(bundledEnModelPath);

const oversizedFiles = await findOversizedFiles(distDir);
if (oversizedFiles.length > 0) {
  const details = oversizedFiles
    .map((file) => `${path.relative(distDir, file.path)} (${formatMiB(file.size)})`)
    .join('\n');
  throw new Error(`Cloudflare Pages only supports files up to 25 MiB. Oversized files remain:\n${details}`);
}

async function removeIfExists(filePath) {
  try {
    await access(filePath);
  } catch {
    return;
  }
  await rm(filePath);
  console.log(`Removed Cloudflare-incompatible asset: ${path.relative(rootDir, filePath)}`);
}

async function findOversizedFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findOversizedFiles(entryPath));
      continue;
    }
    if (!entry.isFile()) continue;
    const entryStat = await stat(entryPath);
    if (entryStat.size > CLOUDFLARE_PAGES_ASSET_LIMIT_BYTES) {
      files.push({ path: entryPath, size: entryStat.size });
    }
  }

  return files;
}

function formatMiB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}
