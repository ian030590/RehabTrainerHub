import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const defaultRepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const pagesAppRoles = ['hub', 'gamehost'];

export function IsAuthPagesApp(app) {
  return app?.role === 'hub';
}

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
      if (!pagesAppRoles.includes(role)) {
        throw new Error(`${ToPosixPath(relative(repoRoot, packagePath))} must define rehabTrainer.role as ${FormatChoices(pagesAppRoles)}.`);
      }
      if (!pkg.homepage) {
        throw new Error(`${ToPosixPath(relative(repoRoot, packagePath))} must define its canonical homepage URL.`);
      }

      const siteUrl = NormalizeSiteUrl(pkg.homepage, packagePath);
      const redirectHostnames = ReadHostnameList(pkg.rehabTrainer?.redirectDomains, packagePath, 'redirectDomains');
      const retiredProjectNames = ReadProjectNameList(pkg.rehabTrainer?.retiredProjects, packagePath);
      const appPath = ToPosixPath(relative(repoRoot, appDir));
      const deploymentUrl = `https://${projectName}.pages.dev`;
      return {
        appName: entry.name,
        appPath,
        appDir,
        outputDir,
        outputPath: ToPosixPath(join(appPath, outputDir)),
        packageName: pkg.name,
        projectName,
        deploymentUrl,
        role,
        redirectHostnames,
        retiredProjectNames,
        siteUrl,
        hostname: new URL(siteUrl).hostname,
        usesBuiltInPagesDomain: siteUrl === deploymentUrl,
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

function ReadHostnameList(values, packagePath, field) {
  if (values === undefined) return [];
  if (!Array.isArray(values)) throw new Error(`${packagePath} rehabTrainer.${field} must be an array.`);
  return values.map((value) => {
    const hostname = String(value).trim().toLowerCase();
    if (!/^[a-z0-9.-]+$/.test(hostname) || hostname.includes('..')) {
      throw new Error(`${packagePath} contains an invalid ${field} hostname: ${value}`);
    }
    return hostname;
  });
}

function ReadProjectNameList(values, packagePath) {
  if (values === undefined) return [];
  if (!Array.isArray(values)) throw new Error(`${packagePath} rehabTrainer.retiredProjects must be an array.`);
  return values.map((value) => {
    const name = String(value).trim();
    if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`${packagePath} contains an invalid retired project name: ${value}`);
    return name;
  });
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

function FormatChoices(values) {
  return values.length === 1
    ? values[0]
    : `${values.slice(0, -1).join(', ')}, or ${values.at(-1)}`;
}
