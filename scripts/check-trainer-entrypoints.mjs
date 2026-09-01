import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appsRoot = join(repoRoot, 'apps');
const trainingRuntimesRoot = join(appsRoot, 'rehabtrainerhub', 'training-runtimes');
const trainingRuntimeDirectories = readdirSync(trainingRuntimesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(trainingRuntimesRoot, entry.name));
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
appEntrypoints.push(...trainingRuntimeDirectories
  .map((directory) => join(directory, 'src', 'App.tsx'))
  .filter(existsSync));

const appRuntimeEntrypoints = readdirSync(appsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `apps/${entry.name}/src/main.tsx`)
  .filter((file) => existsSync(resolve(repoRoot, file)));
appRuntimeEntrypoints.push(...trainingRuntimeDirectories
  .map((directory) => join(directory, 'src', 'main.tsx'))
  .filter(existsSync));

const viteConfigFiles = readdirSync(appsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `apps/${entry.name}/vite.config.ts`)
  .filter((file) => existsSync(resolve(repoRoot, file)));
viteConfigFiles.push(...trainingRuntimeDirectories
  .map((directory) => join(directory, 'vite.config.ts'))
  .filter(existsSync));

const trainerHtmlEntrypoints = trainingRuntimeDirectories
  .map((directory) => join(directory, 'index.html'))
  .filter(existsSync);

const trainerSourceFiles = trainingRuntimeDirectories
  .flatMap((directory) => CollectSourceFiles(join(directory, 'src')));
const hubTrainingModuleSourceFiles = CollectSourceFiles(
  resolve(appsRoot, 'rehabtrainerhub', 'training-modules'),
);

const protectedEntrypoints = Unique([
  ...appRuntimeEntrypoints,
  ...appEntrypoints,
  'apps/rehabtrainerhub/training-runtimes/motor/src/App.tsx',
  'apps/rehabtrainerhub/training-modules/motor/pages/training/UpperLimbTraining.tsx',
  'apps/rehabtrainerhub/training-modules/brain/pages/thinking/ThinkingTraining.tsx',
  'apps/rehabtrainerhub/training-modules/mouth/pages/training/OralTraining.tsx',
  'apps/rehabtrainerhub/training-modules/vision/pages/HomePage.tsx',
  'apps/rehabtrainerhub/training-modules/brain/pages/ModulePage.tsx',
]);

const violations = [];

for (const entrypoint of protectedEntrypoints) {
  const absolutePath = resolve(repoRoot, entrypoint);
  if (!existsSync(absolutePath)) {
    violations.push(`${entrypoint}: protected entrypoint is missing`);
    continue;
  }

  ScanStaticImportGraph(absolutePath, entrypoint, new Set());
}

for (const viteConfigFile of viteConfigFiles) {
  CheckViteBaseConfig(viteConfigFile);
}

for (const htmlEntrypoint of trainerHtmlEntrypoints) {
  CheckHtmlEntrypoint(htmlEntrypoint);
}

for (const runtimeDirectory of trainingRuntimeDirectories) {
  CheckRuntimeModuleOwnership(runtimeDirectory);
}

for (const sourceFile of [...trainerSourceFiles, ...hubTrainingModuleSourceFiles]) {
  CheckTrainingUiContract(sourceFile);
}

if (violations.length > 0) {
  throw new Error(`White-screen smoke test failed:\n${violations.map((line) => `- ${line}`).join('\n')}`);
}

console.log(`White-screen smoke test passed for ${protectedEntrypoints.length} trainer entrypoints.`);

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

function CheckViteBaseConfig(configFile) {
  const absoluteConfigFile = resolve(repoRoot, configFile);
  const source = readFileSync(absoluteConfigFile, 'utf8');
  const isOfficialGameAdapter = absoluteConfigFile.startsWith(`${trainingRuntimesRoot}\\`)
    || absoluteConfigFile.startsWith(`${trainingRuntimesRoot}/`);

  if (isOfficialGameAdapter && !/\bbase\s*:\s*['"]\.\/['"]/.test(source)) {
    violations.push(
      `${configFile}: official game adapters must use relative assets inside /games/{gameId}/`,
    );
  } else if (!isOfficialGameAdapter && /\bbase\s*:\s*['"]\.\/['"]/.test(source)) {
    violations.push(`${configFile}: uses Vite base './'; direct nested app routes require an absolute base`);
  }
  if (isOfficialGameAdapter && /out[\\/]runtimes/.test(source)) {
    violations.push(`${configFile}: retired /runtimes/* output must not be restored`);
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

function CheckRuntimeModuleOwnership(runtimeDirectory) {
  const trainer = basename(runtimeDirectory);
  const appFile = join(runtimeDirectory, 'src', 'App.tsx');
  const relativeAppFile = RelativeToRepo(appFile);
  const appSource = readFileSync(appFile, 'utf8');
  const trainerModulePrefix = `@rehab-trainer/hub-modules/${trainer}/`;

  if (!appSource.includes(trainerModulePrefix)) {
    violations.push(
      `${relativeAppFile}: runtime shell must load trainer-owned implementations from ${trainerModulePrefix}`,
    );
  }

  for (const specifier of GetStaticImports(appSource)) {
    if (specifier.startsWith('@rehab-trainer/hub-modules/')) {
      violations.push(
        `${relativeAppFile}: statically imports ${specifier}; runtime shells must lazy-load trainer modules`,
      );
    }

    if (/^\.\.?\/(?:.*\/)?pages\//.test(specifier)) {
      violations.push(
        `${relativeAppFile}: loads local page ${specifier}; move trainer implementation to training-modules/${trainer}`,
      );
    }
  }

  for (const sourceFile of CollectSourceFiles(join(runtimeDirectory, 'src', 'pages'))) {
    violations.push(
      `${RelativeToRepo(sourceFile)}: runtime-local page implementations are forbidden; move this file to training-modules/${trainer}`,
    );
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

  if (specifier.startsWith('@rehab-trainer/hub-modules/')) {
    return ResolveModule(
      resolve(repoRoot, 'apps/rehabtrainerhub/training-modules'),
      specifier.slice('@rehab-trainer/hub-modules/'.length),
    );
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
