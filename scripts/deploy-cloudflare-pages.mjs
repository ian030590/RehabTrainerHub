#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appsRoot = join(repoRoot, 'apps');
const wranglerPrefix = ['--yes', 'wrangler@4'];
const cloudflarePagesAssetLimitBytes = 25 * 1024 * 1024;
const deployTimeoutMs = 5 * 60 * 1000; // 5 minutes per deploy

function ToPosixPath(path) {
  return path.replaceAll('\\', '/');
}

function GetArg(name) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const branch = GetArg('--branch') ?? process.env.GITHUB_REF_NAME ?? 'main';
const productionBranch =
  GetArg('--production-branch') ?? process.env.CLOUDFLARE_PAGES_PRODUCTION_BRANCH ?? 'main';
const dryRun = process.argv.includes('--dry-run');
const validateOutput = !dryRun || process.argv.includes('--validate-output');
const syncAuthEnv = !process.argv.includes('--skip-auth-env-sync');

function ReadTomlString(toml, key) {
  const match = toml.match(new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']+)["']\\s*$`, 'm'));
  return match?.[1];
}

function DiscoverPagesProjects() {
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
        throw new Error(`${ToPosixPath(relative(repoRoot, appDir))} has wrangler.toml but no package.json.`);
      }

      const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
      if (!pkg.scripts?.build) {
        throw new Error(`${ToPosixPath(relative(repoRoot, packagePath))} must define scripts.build.`);
      }

      const toml = readFileSync(wranglerPath, 'utf8');
      const projectName = ReadTomlString(toml, 'name');
      const outputDir = ReadTomlString(toml, 'pages_build_output_dir');
      const compatibilityDate = ReadTomlString(toml, 'compatibility_date');
      const databaseName = ReadTomlString(toml, 'database_name');
      const migrationsDir = ReadTomlString(toml, 'migrations_dir');

      if (!projectName) {
        throw new Error(`${ToPosixPath(relative(repoRoot, wranglerPath))} must define name.`);
      }

      if (!outputDir) {
        throw new Error(`${ToPosixPath(relative(repoRoot, wranglerPath))} must define pages_build_output_dir.`);
      }

      const appPath = ToPosixPath(relative(repoRoot, appDir));

      return {
        appPath,
        compatibilityDate,
        databaseName,
        hasD1Migrations: Boolean(databaseName && migrationsDir),
        outputDir,
        outputPath: ToPosixPath(join(appPath, outputDir)),
        projectName,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.appPath.localeCompare(b.appPath));
}

function ShellQuote(value) {
  return /[\s"'`$]/.test(value) ? JSON.stringify(value) : value;
}

function RunWrangler(args, options = {}) {
  const commandArgs = [...wranglerPrefix, ...args];
  console.log(`$ npx ${commandArgs.map(ShellQuote).join(' ')}`);

  if (dryRun) {
    return '';
  }

  const shouldCapture = options.capture || options.allowProjectAlreadyExists;
  const command = GetCommand('npx', commandArgs);
  const spawnOptions = {
    cwd: repoRoot,
    encoding: shouldCapture ? 'utf8' : undefined,
    env: process.env,
    stdio: shouldCapture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  };

  if (options.timeout) {
    spawnOptions.timeout = options.timeout;
  }

  const result = spawnSync(command.file, command.args, spawnOptions);

  if (shouldCapture && !options.capture) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
  }

  if (result.error) {
    // spawnSync sets result.error for ETIMEDOUT, spawn failures, etc.
    if (result.error.code === 'ETIMEDOUT') {
      throw new Error(`Wrangler timed out after ${options.timeout / 1000}s: npx ${commandArgs.join(' ')}`);
    }
    throw result.error;
  }

  if (result.status !== 0 || result.signal) {
    const exitInfo = result.signal
      ? `killed by signal ${result.signal}`
      : `exit code ${result.status}`;

    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    if (options.allowProjectAlreadyExists && IsProjectAlreadyExistsOutput(output)) {
      return result.stdout ?? '';
    }

    if (options.capture) {
      process.stdout.write(result.stdout ?? '');
      process.stderr.write(result.stderr ?? '');
    }

    throw new Error(`Wrangler failed (${exitInfo}): npx ${commandArgs.join(' ')}`);
  }

  return result.stdout ?? '';
}

function IsProjectAlreadyExistsOutput(output) {
  return output.includes('8000002') || /project with this name already exists/i.test(output);
}

function GetCommand(file, args) {
  if (process.platform !== 'win32') {
    return { file, args };
  }

  return {
    file: process.env.ComSpec ?? 'cmd.exe',
    args: ['/d', '/s', '/c', file, ...args],
  };
}

function ParseJsonOutput(output) {
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

function GetProjectItems(payload) {
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

function ListExistingProjectNames() {
  if (dryRun) {
    return new Set();
  }

  try {
    const output = RunWrangler(['pages', 'project', 'list', '--json'], { capture: true });
    const items = GetProjectItems(ParseJsonOutput(output));

    const names = new Set(
      items
        .map((item) => item?.name ?? item?.project_name)
        .filter((name) => typeof name === 'string' && name.length > 0),
    );

    if (names.size > 0) {
      console.log(`Found ${names.size} existing project(s): ${[...names].join(', ')}`);
    }

    return names;
  } catch (error) {
    console.warn(`⚠ Failed to list existing projects (will try create): ${error.message}`);
    return new Set();
  }
}

function EnsureProject(project, existingProjectNames) {
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

  RunWrangler(args, { allowProjectAlreadyExists: true });
  existingProjectNames.add(project.projectName);
}

function DeployProject(project, attempt = 1) {
  const maxAttempts = 3;
  const args = [
    `--cwd=${project.appPath}`,
    'pages',
    'deploy',
    project.outputDir,
    `--project-name=${project.projectName}`,
    `--branch=${branch}`,
  ];

  try {
    RunWrangler(args, { timeout: deployTimeoutMs });
  } catch (error) {
    console.error(`\n❌ Deploy failed for ${project.projectName} (attempt ${attempt}/${maxAttempts}): ${error.message}`);

    if (attempt < maxAttempts) {
      const delaySec = attempt * 10;
      console.log(`⏳ Retrying in ${delaySec}s...`);
      spawnSync(process.platform === 'win32' ? 'timeout' : 'sleep', [String(delaySec)], { stdio: 'ignore' });
      return DeployProject(project, attempt + 1);
    }

    throw error;
  }
}

function ApplyProjectMigrations(project) {
  if (!project.hasD1Migrations) return;

  RunWrangler([
    `--cwd=${project.appPath}`,
    'd1',
    'migrations',
    'apply',
    project.databaseName,
    '--remote',
  ]);
}

function SyncAuthEnvironment() {
  if (!syncAuthEnv) {
    console.log('Skipping auth environment sync.');
    return;
  }

  const args = ['scripts/sync-cloudflare-auth-env.mjs'];
  if (dryRun) args.push('--dry-run');
  console.log(`$ node ${args.map(ShellQuote).join(' ')}`);
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

function ValidateProjectOutput(project) {
  const absoluteOutputPath = join(repoRoot, project.outputPath);
  if (!existsSync(absoluteOutputPath)) {
    throw new Error(
      `${project.outputPath} does not exist. Run npm run build:cloudflare before deploying ${project.projectName}.`,
    );
  }

  const oversizedFiles = FindOversizedFiles(absoluteOutputPath);
  if (oversizedFiles.length > 0) {
    const details = oversizedFiles
      .map((file) => `${ToPosixPath(relative(repoRoot, file.path))} (${FormatMiB(file.size)})`)
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

function FindOversizedFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...FindOversizedFiles(entryPath));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }

    const entryStat = statSync(entryPath);
    if (entryStat.size > cloudflarePagesAssetLimitBytes) {
      files.push({ path: entryPath, size: entryStat.size });
    }
  }

  return files;
}

function FormatMiB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

const projects = DiscoverPagesProjects();

if (projects.length === 0) {
  throw new Error('No Cloudflare Pages apps found under apps/*/wrangler.toml.');
}

console.log(`Discovered ${projects.length} Cloudflare Pages project(s):`);
for (const project of projects) {
  console.log(`- ${project.projectName}: ${project.outputPath}`);
}

if (validateOutput) {
  for (const project of projects) {
    ValidateProjectOutput(project);
  }
}

const existingProjectNames = ListExistingProjectNames();

for (const project of projects) {
  EnsureProject(project, existingProjectNames);
}

SyncAuthEnvironment();

for (const project of projects) {
  ApplyProjectMigrations(project);
}

for (const project of projects) {
  DeployProject(project);
}
