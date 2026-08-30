#!/usr/bin/env node

/**
 * Static bundle-budget contract.
 *
 * This gate intentionally runs before a production build. It verifies that
 * the source-level budgets and chunk-boundary controls cannot be removed
 * accidentally. The generated-output gates remain responsible for checking
 * actual byte totals after a build; pass --require-output when an output tree
 * is available and that stronger check is desired.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { offlinePackLimits } from '../packages/training-contracts/src/index.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requireOutput = process.argv.includes('--require-output');

const rootPwaSource = Read('scripts/emit-pwa-assets.mjs');
const officialPwaSource = Read('scripts/emit-official-game-pwas.mjs');
const rootWorkerSource = Read('packages/ui/src/pwa-service-worker.js');
const runtimeManifestCheckerSource = Read('scripts/check-runtime-build-manifest.mjs');
const officialOutputCheckerSource = Read('scripts/check-official-game-pwa-output.mjs');

const rootBudget = ParseMegabyteBudget(rootPwaSource, 'maximumRootShellPrecacheBytes');
const officialShellBudget = ParseMegabyteBudget(officialPwaSource, 'maximumShellPrecacheBytes');
assert.ok(rootBudget <= 8 * 1024 * 1024, 'root shell budget must stay at or below 8 MiB.');
assert.ok(officialShellBudget <= 12 * 1024 * 1024, 'official game shell budget must stay at or below 12 MiB.');

assert.match(rootPwaSource, /IsRootShellFile/);
assert.match(rootPwaSource, /maximumRootShellPrecacheBytes/);
assert.match(rootWorkerSource, /root Hub worker owns only the application shell/);
for (const excludedPath of ['/runtimes/', '/games/', '/runtime-assets/', '/offline-manifests/']) {
  assert.match(rootWorkerSource, new RegExp(`startsWith\\('${EscapeRegExp(excludedPath)}'\\)`));
}

assert.match(officialPwaSource, /ResolvePwaShellModulePath/);
assert.match(officialPwaSource, /includeDynamicImports:\s*false/);
assert.match(officialPwaSource, /PrecacheShell/);
assert.match(officialPwaSource, /stagingCachePrefix/);
assert.match(officialPwaSource, /allowedRuntimePrefixes/);
assert.match(officialPwaSource, /IsAllowedRuntimePath/);
assert.match(officialPwaSource, /maximumOfflinePackResourceCount/);
assert.match(officialPwaSource, /maximumOfflinePackBytes/);
assert.equal(
  Number.isSafeInteger(offlinePackLimits.maximumResourceCount),
  true,
  'offline resource count must be a bounded integer.',
);
assert.equal(
  Number.isSafeInteger(offlinePackLimits.maximumTotalBytes),
  true,
  'offline byte budget must be a bounded integer.',
);
assert.equal(
  offlinePackLimits.maximumResourceCount,
  512,
  'offline resource count must come from the shared contract.',
);
assert.equal(
  offlinePackLimits.maximumTotalBytes,
  256 * 1024 * 1024,
  'offline byte budget must come from the shared contract.',
);
assert.match(runtimeManifestCheckerSource, /staticClosure/);
assert.match(runtimeManifestCheckerSource, /IsHeavySource/);
assert.match(officialOutputCheckerSource, /ValidateOfflineResources/);
assert.match(officialOutputCheckerSource, /ValidateGameOutput/);

const hubOutput = resolve(repoRoot, 'apps/rehabtrainerhub/out');
if (existsSync(hubOutput)) {
  RunOutputGate('scripts/check-runtime-build-manifest.mjs');
  RunOutputGate('scripts/check-official-game-pwa-output.mjs', 'apps/rehabtrainerhub/out');
} else if (requireOutput) {
  throw new Error('Hub output is missing; run the Hub build before --require-output.');
} else {
  console.log('Generated output is absent; source bundle-budget contract only was evaluated.');
}

console.log(
  `Bundle budget contract passed (root shell ${FormatMiB(rootBudget)}, official shell ${FormatMiB(officialShellBudget)}, offline pack ${FormatMiB(offlinePackLimits.maximumTotalBytes)}).`,
);

function Read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

function ParseMegabyteBudget(source, constantName) {
  const match = source.match(new RegExp(`const\\s+${EscapeRegExp(constantName)}\\s*=\\s*(\\d+)\\s*\\*\\s*1024\\s*\\*\\s*1024`));
  assert.ok(match, `${constantName} must be declared as a MiB budget.`);
  const value = Number(match[1]) * 1024 * 1024;
  assert.ok(Number.isSafeInteger(value) && value > 0, `${constantName} must be a positive safe integer.`);
  return value;
}

function RunOutputGate(script, ...args) {
  const result = spawnSync(process.execPath, [resolve(repoRoot, script), ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  assert.equal(result.status, 0, `${script} failed with exit code ${result.status}.`);
}

function FormatMiB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function EscapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&');
}
