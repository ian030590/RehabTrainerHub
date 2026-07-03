#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appsRoot = join(repoRoot, 'apps');
const wranglerPrefix = ['--yes', 'wrangler@4'];
const CLOUDFLARE_PAGES_ASSET_LIMIT_BYTES = 25 * 1024 * 1024;

function toPosixPath(path) {
  return path.replaceAll('\\', '/');
}

function getArg(name) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const branch = getArg('--branch') ?? process.env.GITHUB_REF_NAME ?? 'main';
const productionBranch =
  getArg('--production-branch') ?? process.env.CLOUDFLARE_PAGES_PRODUCTION_BRANCH ?? 'main';
const dryRun = process.argv.includes('--dry-run');
const validateOutput = !dryRun || process.argv.includes('--validate-output');
const syncAuthEnv = !process.argv.includes('--skip-auth-env-sync');

function readTomlString(toml, key) {
  const match = toml.match(new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']+)["']\\s*$`, 'm'));
  return match?.[1];
}

function discoverPagesProjects() {
  return readdirSync(appsRoot)
    .map((entry) => join(appsRoot, entry))
    .filter((entryPath) => statSync(entryPath).isDirectory())
    .map((appDir) => {
      const wranglerPath = join(appDir, 'wrangler.toml');
      if (!existsSync(wranglerPath)) {
        return null;
      }

      const packagePath = join(appDir, 'package.json');
      if (!existsSync(packagePath)) {
        throw new Error(`${toPosixPath(relative(repoRoot, appDir))} has wrangler.toml but no package.json.`);
      }

      const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
      if (!pkg.scripts?.build) {
        throw new Error(`${toPosixPath(relative(repoRoot, packagePath))} must define scripts.build.`);
      }

      const toml = readFileSync(wranglerPath, 'utf8');
      const projectName = readTomlString(toml, 'name');
      const outputDir = readTomlString(toml, 'pages_build_output_dir');
      const compatibilityDate = readTomlString(toml, 'compatibility_date');

      if (!projectName) {
        throw new Error(`${toPosixPath(relative(repoRoot, wranglerPath))} must define name.`);
      }

      if (!outputDir) {
        throw new Error(`${toPosixPath(relative(repoRoot, wranglerPath))} must define pages_build_output_dir.`);
      }

      const appPath = toPosixPath(relative(repoRoot, appDir));

      return {
        appPath,
        compatibilityDate,
        outputDir,
        outputPath: toPosixPath(join(appPath, outputDir)),
        projectName,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.appPath.localeCompare(b.appPath));
}

function shellQuote(value) {
  return /[\s"'`$]/.test(value) ? JSON.stringify(value) : value;
}

function runWrangler(args, options = {}) {
  const commandArgs = [...wranglerPrefix, ...args];
  console.log(`$ npx ${commandArgs.map(shellQuote).join(' ')}`);

  if (dryRun) {
    return '';
  }

  const shouldCapture = options.capture || options.allowProjectAlreadyExists;
  const command = getCommand('npx', commandArgs);
  const result = spawnSync(command.file, command.args, {
    cwd: repoRoot,
    encoding: shouldCapture ? 'utf8' : undefined,
    env: process.env,
    stdio: shouldCapture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

  if (shouldCapture && !options.capture) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
  }

  if (result.status !== 0) {
    if (result.error) {
      throw result.error;
    }

    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    if (options.allowProjectAlreadyExists && isProjectAlreadyExistsOutput(output)) {
      return result.stdout ?? '';
    }

    if (options.capture) {
      process.stdout.write(result.stdout ?? '');
      process.stderr.write(result.stderr ?? '');
    }

    throw new Error(`Wrangler failed with exit code ${result.status}: npx ${commandArgs.join(' ')}`);
  }

  return result.stdout ?? '';
}

function isProjectAlreadyExistsOutput(output) {
  return output.includes('8000002') || /project with this name already exists/i.test(output);
}

function getCommand(file, args) {
  if (process.platform !== 'win32') {
    return { file, args };
  }

  return {
    file: process.env.ComSpec ?? 'cmd.exe',
    args: ['/d', '/s', '/c', file, ...args],
  };
}

function parseJsonOutput(output) {
  const firstBrace = output.indexOf('{');
  const firstBracket = output.indexOf('[');
  const starts = [firstBrace, firstBracket].filter((index) => index >= 0);
  const start = Math.min(...starts);
  const end = Math.max(output.lastIndexOf('}'), output.lastIndexOf(']'));

  if (!Number.isFinite(start) || end < start) {
    throw new Error('Wrangler did not return JSON output.');
  }

  return JSON.parse(output.slice(start, end + 1));
}

function getProjectItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  for (const key of ['result', 'projects', 'items']) {
    if (Array.isArray(payload?.[key])) {
      return payload[key];
    }
  }

  return [];
}

function listExistingProjectNames() {
  if (dryRun) {
    return new Set();
  }

  const output = runWrangler(['pages', 'project', 'list', '--json'], { capture: true });
  const items = getProjectItems(parseJsonOutput(output));

  return new Set(
    items
      .map((item) => item?.name ?? item?.project_name)
      .filter((name) => typeof name === 'string' && name.length > 0),
  );
}

function ensureProject(project, existingProjectNames) {
  if (existingProjectNames.has(project.projectName)) {
    console.log(`Cloudflare Pages project exists: ${project.projectName}`);
    return;
  }

  const args = [
    'pages',
    'project',
    'create',
    project.projectName,
    `--production-branch=${productionBranch}`,
  ];

  if (project.compatibilityDate) {
    args.push(`--compatibility-date=${project.compatibilityDate}`);
  }

  runWrangler(args, { allowProjectAlreadyExists: true });
  existingProjectNames.add(project.projectName);
}

function deployProject(project) {
  runWrangler([
    `--cwd=${project.appPath}`,
    'pages',
    'deploy',
    project.outputDir,
    `--project-name=${project.projectName}`,
    `--branch=${branch}`,
  ]);
}

function syncAuthEnvironment() {
  if (!syncAuthEnv) {
    console.log('Skipping auth environment sync.');
    return;
  }

  const args = ['scripts/sync-cloudflare-auth-env.mjs'];
  if (dryRun) args.push('--dry-run');
  console.log(`$ node ${args.map(shellQuote).join(' ')}`);
  if (dryRun) {
    const result = spawnSync(process.execPath, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      env: process.env,
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      if (result.error) throw result.error;
      throw new Error(`Auth environment dry-run failed with exit code ${result.status}.`);
    }
    return;
  }

  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    if (result.error) throw result.error;
    throw new Error(`Auth environment sync failed with exit code ${result.status}.`);
  }
}

function validateProjectOutput(project) {
  const absoluteOutputPath = join(repoRoot, project.outputPath);
  if (!existsSync(absoluteOutputPath)) {
    throw new Error(
      `${project.outputPath} does not exist. Run npm run build:cloudflare before deploying ${project.projectName}.`,
    );
  }

  const oversizedFiles = findOversizedFiles(absoluteOutputPath);
  if (oversizedFiles.length > 0) {
    const details = oversizedFiles
      .map((file) => `${toPosixPath(relative(repoRoot, file.path))} (${formatMiB(file.size)})`)
      .join('\n');
    throw new Error(
      [
        `${project.projectName} output contains files larger than Cloudflare Pages' 25 MiB limit:`,
        details,
        'Rebuild with npm run build:cloudflare before deploying.',
      ].join('\n'),
    );
  }
}

function findOversizedFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...findOversizedFiles(entryPath));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }

    const entryStat = statSync(entryPath);
    if (entryStat.size > CLOUDFLARE_PAGES_ASSET_LIMIT_BYTES) {
      files.push({ path: entryPath, size: entryStat.size });
    }
  }

  return files;
}

function formatMiB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

const projects = discoverPagesProjects();

if (projects.length === 0) {
  throw new Error('No Cloudflare Pages apps found under apps/*/wrangler.toml.');
}

console.log(`Discovered ${projects.length} Cloudflare Pages project(s):`);
for (const project of projects) {
  console.log(`- ${project.projectName}: ${project.outputPath}`);
}

if (validateOutput) {
  for (const project of projects) {
    validateProjectOutput(project);
  }
}

const existingProjectNames = listExistingProjectNames();

for (const project of projects) {
  ensureProject(project, existingProjectNames);
}

syncAuthEnvironment();

for (const project of projects) {
  deployProject(project);
}
