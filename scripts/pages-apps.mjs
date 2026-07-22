import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const defaultRepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function DiscoverPagesApps(repoRoot = defaultRepoRoot) {
  const appsRoot = join(repoRoot, 'apps');
  const apps = readdirSync(appsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const appDir = join(appsRoot, entry.name);
      const packagePath = join(appDir, 'package.json');
      const wranglerPath = join(appDir, 'wrangler.toml');
      if (!existsSync(packagePath) || !existsSync(wranglerPath)) return null;

      const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
      const toml = readFileSync(wranglerPath, 'utf8');
      const projectName = ReadTomlString(toml, 'name');
      const outputDir = ReadTomlString(toml, 'pages_build_output_dir');
      const role = pkg.rehabTrainer?.role;

      if (!projectName || !outputDir) {
        throw new Error(`${ToPosixPath(relative(repoRoot, wranglerPath))} must define name and pages_build_output_dir.`);
      }
      if (!['hub', 'trainer'].includes(role)) {
        throw new Error(`${ToPosixPath(relative(repoRoot, packagePath))} must define rehabTrainer.role as hub or trainer.`);
      }
      if (!pkg.homepage) {
        throw new Error(`${ToPosixPath(relative(repoRoot, packagePath))} must define its canonical homepage URL.`);
      }

      const siteUrl = NormalizeSiteUrl(pkg.homepage, packagePath);
      const appPath = ToPosixPath(relative(repoRoot, appDir));
      return {
        appName: entry.name,
        appPath,
        appDir,
        outputDir,
        outputPath: ToPosixPath(join(appPath, outputDir)),
        packageName: pkg.name,
        projectName,
        deploymentUrl: `https://${projectName}.pages.dev`,
        role,
        siteUrl,
        hostname: new URL(siteUrl).hostname,
        urlEnvName: `${ToEnvironmentName(projectName)}_URL`,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.appPath.localeCompare(right.appPath));

  EnsureUnique(apps, 'projectName');
  EnsureUnique(apps, 'siteUrl');
  EnsureUnique(apps, 'urlEnvName');
  return apps;
}

export function SelectChangedTrainers(pagesApps, changedFiles) {
  const trainers = pagesApps.filter((app) => app.role === 'trainer');
  if (!changedFiles) return trainers;

  const selectedNames = new Set();
  let sharedChange = false;
  for (const rawFile of changedFiles) {
    const file = ToPosixPath(rawFile).replace(/^\.\//, '');
    if (!file.startsWith('apps/')) {
      sharedChange ||= IsRuntimeOrPipelineFile(file);
      continue;
    }

    const trainer = trainers.find((app) => file === app.appPath || file.startsWith(`${app.appPath}/`));
    if (trainer) selectedNames.add(trainer.appName);
  }

  return sharedChange
    ? trainers
    : trainers.filter((app) => selectedNames.has(app.appName));
}

function IsRuntimeOrPipelineFile(file) {
  return /\.(?:cjs|css|js|json|jsx|mjs|sass|scss|toml|ts|tsx|ya?ml)$/.test(file);
}

function ReadTomlString(toml, key) {
  const match = toml.match(new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']+)["']\\s*$`, 'm'));
  return match?.[1];
}

function NormalizeSiteUrl(value, packagePath) {
  const url = new URL(String(value).trim());
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${packagePath} homepage must be an HTTPS origin without a path, query, or hash.`);
  }
  return url.origin;
}

function ToEnvironmentName(value) {
  return value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
}

function EnsureUnique(items, key) {
  const values = new Set();
  for (const item of items) {
    if (values.has(item[key])) throw new Error(`Duplicate Cloudflare Pages ${key}: ${item[key]}`);
    values.add(item[key]);
  }
}

function ToPosixPath(value) {
  return value.replaceAll('\\', '/');
}
