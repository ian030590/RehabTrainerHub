#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const configPath = resolve(repoRoot, 'apps/rehabtrainerhub/tsconfig.json');
const configJson = ts.readConfigFile(configPath, ts.sys.readFile);
assert.equal(configJson.error, undefined, 'Hub TypeScript configuration must be readable.');
const parsed = ts.parseJsonConfigFileContent(configJson.config, ts.sys, resolve(repoRoot, 'apps/rehabtrainerhub'));
assert.equal(parsed.errors.length, 0, 'Hub TypeScript configuration must be valid.');

const setupFiles = [
  'apps/rehabtrainerhub/training-modules/shared/nativeTimelineEngine.ts',
  'apps/rehabtrainerhub/training-modules/shared/createTimelineSetup.tsx',
  'apps/rehabtrainerhub/training-modules/shared/componentTrainingEngine.ts',
  'apps/rehabtrainerhub/training-modules/shared/trainingRunResult.ts',
  'apps/rehabtrainerhub/training-modules/vision/nativeTimelineEngine.ts',
  'apps/rehabtrainerhub/training-modules/vision/createTimelineSetup.tsx',
  'apps/rehabtrainerhub/training-modules/vision/utils/trainingRunResult.ts',
  'apps/rehabtrainerhub/training-modules/vision/moving-card/setup.tsx',
  'apps/rehabtrainerhub/training-modules/vision/oculomotor/setup.tsx',
  'apps/rehabtrainerhub/training-modules/vision/gabor-patching/setup.tsx',
  'apps/rehabtrainerhub/training-modules/vision/reading-training/setup.tsx',
  'apps/rehabtrainerhub/training-modules/motor/drawing-defense/config.ts',
  'apps/rehabtrainerhub/training-modules/motor/drawing-defense/setup.tsx',
  'apps/rehabtrainerhub/training-modules/motor/asteroid-shield/config.ts',
  'apps/rehabtrainerhub/training-modules/motor/asteroid-shield/setup.tsx',
  'apps/rehabtrainerhub/training-modules/motor/gesture-battler/config.ts',
  'apps/rehabtrainerhub/training-modules/motor/gesture-battler/setup.tsx',
  'apps/rehabtrainerhub/training-modules/motor/motor-cortex-rehab/config.ts',
  'apps/rehabtrainerhub/training-modules/motor/motor-cortex-rehab/setup.tsx',
  'apps/rehabtrainerhub/training-modules/mouth/tongue-catch/config.ts',
  'apps/rehabtrainerhub/training-modules/mouth/tongue-catch/setup.tsx',
  'apps/rehabtrainerhub/training-modules/brain/every-ball-response/config.ts',
  'apps/rehabtrainerhub/training-modules/brain/every-ball-response/setup.tsx',
  'apps/rehabtrainerhub/training-modules/brain/pages/peripheral-attention/peripheralAttentionRunResult.ts',
  'apps/rehabtrainerhub/training-modules/brain/ufov/setup.tsx',
];
const rootNames = [...new Set([...parsed.fileNames, ...setupFiles.map((file) => resolve(repoRoot, file))])];
const program = ts.createProgram(rootNames, {
  ...parsed.options,
  noEmit: true,
  incremental: false,
});
const diagnostics = [
  ...program.getConfigFileParsingDiagnostics(),
  ...program.getSyntacticDiagnostics(),
  ...program.getSemanticDiagnostics(),
].filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);

if (diagnostics.length > 0) {
  const formatHost = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => repoRoot,
    getNewLine: () => '\n',
  };
  throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost));
}

console.log(`Native setup type gate passed for ${setupFiles.length} files.`);
