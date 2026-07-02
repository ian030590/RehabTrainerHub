#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appsRoot = join(repoRoot, 'apps');
const dryRun = process.argv.includes('--dry-run');

function toPosixPath(path) {
  return path.replaceAll('\\', '/');
}

function discoverBuildableApps() {
  return readdirSync(appsRoot)
    .map((entry) => join(appsRoot, entry))
    .filter((entryPath) => statSync(entryPath).isDirectory())
    .map((appDir) => {
      const packagePath = join(appDir, 'package.json');
      if (!existsSync(packagePath)) {
        return null;
      }

      const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
      if (!pkg.scripts?.build) {
        return null;
      }

      return {
        name: pkg.name ?? toPosixPath(relative(repoRoot, appDir)),
        path: toPosixPath(relative(repoRoot, appDir)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.path.localeCompare(b.path));
}

function runBuild(app) {
  console.log(`\n=== Building ${app.name} (${app.path}) ===`);

  if (dryRun) {
    console.log(`$ npm --prefix ${app.path} run build`);
    return;
  }

  const command = getCommand('npm', ['--prefix', app.path, 'run', 'build']);
  const result = spawnSync(command.file, command.args, {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    if (result.error) {
      throw result.error;
    }

    throw new Error(`Build failed for ${app.name} with exit code ${result.status}`);
  }
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

const apps = discoverBuildableApps();

if (apps.length === 0) {
  throw new Error('No buildable apps found under apps/*/package.json.');
}

for (const app of apps) {
  runBuild(app);
}
