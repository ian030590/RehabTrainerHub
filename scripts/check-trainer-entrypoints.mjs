import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appsRoot = join(repoRoot, 'apps');
const forbiddenRuntimeImports = [
  '@jspsych',
  '@mediapipe',
  '@tensorflow',
  '@tensorflow-models',
  'jspsych',
  'pixi.js',
  'three',
  'vosk-browser',
];

const appEntrypoints = readdirSync(appsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `apps/${entry.name}/src/App.tsx`)
  .filter((file) => existsSync(resolve(repoRoot, file)));

const viteConfigFiles = readdirSync(appsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `apps/${entry.name}/vite.config.ts`)
  .filter((file) => existsSync(resolve(repoRoot, file)));

const protectedEntrypoints = unique([
  ...appEntrypoints,
  'apps/stroketrainer/src/pages/HomePage.tsx',
  'apps/stroketrainer/src/pages/training/MotorTraining.tsx',
  'apps/stroketrainer/src/pages/training/CognitiveTraining.tsx',
  'apps/stroketrainer/src/pages/training/SpeechTraining.tsx',
  'apps/visiontrainer/src/pages/HomePage.tsx',
  'apps/braintrainer/src/pages/ModulePage.tsx',
]);

const violations = [];

for (const entrypoint of protectedEntrypoints) {
  const absolutePath = resolve(repoRoot, entrypoint);
  if (!existsSync(absolutePath)) {
    violations.push(`${entrypoint}: protected entrypoint is missing`);
    continue;
  }

  scanStaticImportGraph(absolutePath, entrypoint, new Set());
}

for (const viteConfigFile of viteConfigFiles) {
  checkViteBaseConfig(viteConfigFile);
}

if (violations.length > 0) {
  throw new Error(`White-screen smoke test failed:\n${violations.map((line) => `- ${line}`).join('\n')}`);
}

console.log(`White-screen smoke test passed for ${protectedEntrypoints.length} trainer entrypoints.`);

function scanStaticImportGraph(filePath, entrypoint, visited) {
  if (visited.has(filePath)) return;
  visited.add(filePath);

  const source = readFileSync(filePath, 'utf8');
  for (const specifier of getStaticImports(source)) {
    const forbiddenImport = getForbiddenRuntimeImport(specifier);
    if (forbiddenImport) {
      violations.push(`${entrypoint}: ${relativeToRepo(filePath)} statically imports ${specifier}`);
      continue;
    }

    const resolved = resolveProjectImport(filePath, specifier);
    if (resolved && isScannableSourceFile(resolved)) {
      scanStaticImportGraph(resolved, entrypoint, visited);
    }
  }
}

function checkViteBaseConfig(configFile) {
  const source = readFileSync(resolve(repoRoot, configFile), 'utf8');

  if (/\bbase\s*:\s*['"]\.\/['"]/.test(source)) {
    violations.push(
      `${configFile}: uses Vite base './'; use '/' so direct nested trainer routes load production assets`,
    );
  }
}

function getStaticImports(source) {
  const imports = [];
  const pattern = /^\s*import\s+(type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"];?/gm;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    if (match[1]) continue;
    imports.push(match[2]);
  }

  return imports;
}

function getForbiddenRuntimeImport(specifier) {
  return forbiddenRuntimeImports.find((name) => specifier === name || specifier.startsWith(`${name}/`));
}

function resolveProjectImport(importerPath, specifier) {
  if (specifier.startsWith('.')) {
    return resolveModule(dirname(importerPath), specifier);
  }

  if (specifier === '@rehab-trainer/ui') {
    return resolveModule(resolve(repoRoot, 'packages/ui/src'), 'index');
  }

  if (specifier.startsWith('@rehab-trainer/ui/')) {
    return resolveModule(resolve(repoRoot, 'packages/ui/src'), specifier.slice('@rehab-trainer/ui/'.length));
  }

  return null;
}

function resolveModule(baseDir, specifier) {
  const basePath = resolve(baseDir, specifier);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.mjs`,
    join(basePath, 'index.ts'),
    join(basePath, 'index.tsx'),
    join(basePath, 'index.js'),
    join(basePath, 'index.jsx'),
    join(basePath, 'index.mjs'),
  ];

  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

function isScannableSourceFile(filePath) {
  return /\.(mjs|js|jsx|ts|tsx)$/.test(filePath);
}

function relativeToRepo(filePath) {
  return filePath.slice(repoRoot.length + 1);
}

function unique(items) {
  return [...new Set(items)];
}
