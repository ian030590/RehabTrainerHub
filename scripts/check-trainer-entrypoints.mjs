import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appsRoot = join(repoRoot, 'apps');
const hubRoot = join(appsRoot, 'rehabtrainerhub');
const gamesRoot = join(hubRoot, 'games');

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

const retiredDirectories = [
  join(hubRoot, 'training-runtimes'),
  join(hubRoot, 'training-modules'),
  join(gamesRoot, '_shared'),
];

const hubAppSourceFiles = CollectSourceFiles(join(hubRoot, 'app'));

const protectedEntrypoints = Unique([
  ...hubAppSourceFiles
    .filter((file) => basename(file).startsWith('page.') || basename(file).startsWith('layout.'))
    .map(RelativeToRepo),
]);

const gameDirectories = readdirSync(gamesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(gamesRoot, entry.name));

const htmlEntrypoints = [
  ...gameDirectories.map((directory) => join(directory, 'index.html')).filter(existsSync),
  join(appsRoot, 'usergamerunner', 'public', 'index.html'),
].filter(existsSync);

const gameSourceFiles = gameDirectories
  .flatMap((directory) => CollectSourceFiles(directory));

const violations = [];

for (const retiredPath of retiredDirectories) {
  if (existsSync(retiredPath)) {
    violations.push(`Retired path must not exist: ${RelativeToRepo(retiredPath)}`);
  }
}

for (const entrypoint of protectedEntrypoints) {
  const absolutePath = resolve(repoRoot, entrypoint);
  if (!existsSync(absolutePath)) {
    violations.push(`${entrypoint}: protected entrypoint is missing`);
    continue;
  }

  ScanStaticImportGraph(absolutePath, entrypoint, new Set());
}

for (const htmlEntrypoint of htmlEntrypoints) {
  CheckHtmlEntrypoint(htmlEntrypoint);
}

for (const sourceFile of [...gameSourceFiles, ...hubAppSourceFiles]) {
  CheckTrainingUiContract(sourceFile);
}

if (violations.length > 0) {
  throw new Error(`White-screen smoke test failed:\n${violations.map((line) => `- ${line}`).join('\n')}`);
}

console.log(`White-screen smoke test passed for ${protectedEntrypoints.length} protected entrypoints and ${gameDirectories.length} independent games.`);

function ScanStaticImportGraph(filePath, entrypoint, visited) {
  if (visited.has(filePath)) return;
  visited.add(filePath);

  const source = readFileSync(filePath, 'utf8');
  for (const specifier of GetStaticImports(source)) {
    const forbiddenImport = GetForbiddenRuntimeImport(specifier);
    if (forbiddenImport) {
      violations.push(`${entrypoint}: ${RelativeToRepo(filePath)} statically imports ${specifier}`);
      continue;
    }

    const resolved = ResolveProjectImport(filePath, specifier);
    if (resolved && IsScannableSourceFile(resolved)) {
      ScanStaticImportGraph(resolved, entrypoint, visited);
    }
  }
}

function GetStaticImports(source) {
  const imports = [];
  const pattern = /^\s*import\s+(type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"];?/gm;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    if (match[1]) continue;
    imports.push(match[2]);
  }

  return imports;
}

function GetForbiddenRuntimeImport(specifier) {
  if (/\.(?:css|less|sass|scss)(?:\?|$)/.test(specifier)) {
    return undefined;
  }

  return forbiddenRuntimeImports.find((name) => specifier === name || specifier.startsWith(`${name}/`));
}

function CheckHtmlEntrypoint(htmlFile) {
  const source = readFileSync(resolve(repoRoot, htmlFile), 'utf8');
  const heavyRuntimePattern = /(?:webgazer|mediapipe|tensorflow|tfjs|vosk)(?:[^\s"']*)\.js/i;

  for (const match of source.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    if (heavyRuntimePattern.test(match[1])) {
      violations.push(
        `${htmlFile}: eagerly loads heavy runtime ${match[1]}; load it from the owning module after config interaction`,
      );
    }
  }
}

function CheckTrainingUiContract(filePath) {
  const source = readFileSync(filePath, 'utf8');
  if (/from\s+['"]@rehab-trainer\/ui\/components\/StartTrainingButton['"]/.test(source)) {
    violations.push(
      `${RelativeToRepo(filePath)}: imports StartTrainingButton directly; config flows must use TrainingConfigNavigationActions and rules flows must use TrainingRulesPanel`,
    );
  }
}

function CollectSourceFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return CollectSourceFiles(path);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function ResolveProjectImport(importerPath, specifier) {
  if (specifier.startsWith('.')) {
    return ResolveModule(dirname(importerPath), specifier);
  }

  if (specifier === '@rehab-trainer/ui') {
    return ResolveModule(resolve(repoRoot, 'packages/ui/src'), 'index');
  }

  if (specifier.startsWith('@rehab-trainer/ui/')) {
    return ResolveModule(resolve(repoRoot, 'packages/ui/src'), specifier.slice('@rehab-trainer/ui/'.length));
  }

  if (specifier.startsWith('@rehab-trainer/games/')) {
    return ResolveModule(
      resolve(repoRoot, 'apps/rehabtrainerhub/games'),
      specifier.slice('@rehab-trainer/games/'.length),
    );
  }

  if (specifier === '@rehab-trainer/game-settings') {
    return ResolveModule(resolve(repoRoot, 'packages/game-settings/src'), 'index');
  }

  return null;
}

function ResolveModule(baseDir, specifier) {
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

function IsScannableSourceFile(filePath) {
  return /\.(mjs|js|jsx|ts|tsx)$/.test(filePath);
}

function RelativeToRepo(filePath) {
  return filePath.slice(repoRoot.length + 1);
}

function Unique(items) {
  return [...new Set(items)];
}
