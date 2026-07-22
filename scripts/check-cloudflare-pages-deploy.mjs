#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { DiscoverPagesApps, defaultRepoRoot } from './pages-apps.mjs';

const pagesApps = DiscoverPagesApps();
const deployScript = resolve(defaultRepoRoot, 'scripts/deploy-cloudflare-pages.mjs');
const result = spawnSync(
  process.execPath,
  [deployScript, '--dry-run', '--branch=deployment-test', '--production-branch=main'],
  {
    cwd: defaultRepoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      VITE_SMOKE_PUBLIC_VALUE: 'deployment-test-value',
    },
  },
);

const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`Cloudflare Pages deployment dry-run failed with exit code ${result.status}:\n${output}`);
}

for (const app of pagesApps) {
  const createMarker = `pages project create ${app.projectName} --production-branch=main`;
  const syncMarker = `pages secret bulk ${app.projectName}.pages-env.json --project-name=${app.projectName}`;
  const deployMarker = `--cwd=${app.appPath} pages deploy ${app.outputDir} --project-name=${app.projectName} --branch=deployment-test`;
  const domainMarker = `cloudflare pages domain ensure ${app.projectName} ${app.hostname}`;

  for (const marker of [
    `${app.projectName}: ${app.outputPath}`,
    createMarker,
    `- ${app.projectName}:`,
    app.urlEnvName,
    `NEXT_PUBLIC_${app.urlEnvName}`,
    `VITE_${app.urlEnvName}`,
    'VITE_SMOKE_PUBLIC_VALUE',
    syncMarker,
    deployMarker,
    domainMarker,
  ]) {
    if (!output.includes(marker)) {
      throw new Error(`Cloudflare Pages deployment dry-run is missing ${JSON.stringify(marker)}:\n${output}`);
    }
  }

  const createIndex = output.indexOf(createMarker);
  const syncIndex = output.indexOf(syncMarker);
  const deployIndex = output.indexOf(deployMarker);
  const domainIndex = output.indexOf(domainMarker);
  if (!(createIndex < syncIndex && syncIndex < deployIndex && deployIndex < domainIndex)) {
    throw new Error(`Deployment order must be create -> sync variables -> deploy -> sync domain for ${app.projectName}:\n${output}`);
  }
}

console.log(`Cloudflare Pages provisioning check passed for ${pagesApps.length} discovered project(s).`);
