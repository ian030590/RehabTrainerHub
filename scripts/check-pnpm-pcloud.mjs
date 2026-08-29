#!/usr/bin/env node
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(join(fileURLToPath(new URL('.', import.meta.url)), '..'));
const packagePath = join(repoRoot, 'package.json');
const workspacePath = join(repoRoot, 'pnpm-workspace.yaml');
const npmrcPath = join(repoRoot, '.npmrc');
const nodeVersionPath = join(repoRoot, '.node-version');

function Fail(message) {
  throw new Error(`[pnpm-pcloud] ${message}`);
}

function ReadJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    Fail(`Cannot parse ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function AssertPackageManager(pkg) {
  const packageManager = typeof pkg.packageManager === 'string' ? pkg.packageManager : '';
  if (!packageManager.startsWith('pnpm@11.24.0')) {
    Fail('packageManager must pin pnpm 11.24.0.');
  }
  if (Object.hasOwn(pkg, 'workspaces')) {
    Fail('root package.json must not declare npm workspaces.');
  }
  if (Object.hasOwn(pkg, 'pnpm')) {
    Fail('pnpm project settings belong in pnpm-workspace.yaml, not package.json.');
  }
  if (typeof pkg.scripts?.preinstall === 'string') {
    Fail('root preinstall must not mutate pCloud pnpm metadata after dependency linking; use install:pcloud.');
  }
  if (!/prepare-pnpm-pcloud\.mjs\s*&&\s*corepack pnpm install --frozen-lockfile/.test(pkg.scripts?.['install:pcloud'] ?? '')) {
    Fail('install:pcloud must prepare pCloud metadata before a frozen corepack pnpm install.');
  }
  AssertNodeVersion(pkg);
}

function AssertNodeVersion(pkg) {
  if (!existsSync(nodeVersionPath)) Fail('.node-version is missing.');
  // Windows tooling may keep this tiny file as UTF-16LE with a BOM. Decode
  // that representation explicitly so the policy gate checks the value,
  // rather than depending on the editor's line-ending/encoding choice.
  const nodeVersionBytes = readFileSync(nodeVersionPath);
  const nodeVersion = (nodeVersionBytes[0] === 0xff && nodeVersionBytes[1] === 0xfe
    ? nodeVersionBytes.toString('utf16le')
    : nodeVersionBytes.toString('utf8'))
    .replace(/^\uFEFF/, '')
    .trim();
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(nodeVersion);
  if (!match) Fail('.node-version must contain one exact vMAJOR.MINOR.PATCH value.');
  const [, major, minor, patch] = match;
  const expectedRange = `>=${major}.${minor}.${patch} <${Number(major) + 1}`;
  if (pkg.engines?.node !== expectedRange) {
    Fail(`root engines.node must match .node-version (${expectedRange}).`);
  }
}

function AssertWorkspaceSettings() {
  if (!existsSync(workspacePath)) Fail('pnpm-workspace.yaml is missing.');
  const workspace = readFileSync(workspacePath, 'utf8');
  for (const setting of [
    /nodeLinker:\s*hoisted/,
    /packageImportMethod:\s*copy/,
    /injectWorkspacePackages:\s*true/,
    /dedupeInjectedDeps:\s*false/,
    /preferSymlinkedExecutables:\s*false/,
    /symlink:\s*false/,
  ]) {
    if (!setting.test(workspace)) Fail(`pnpm-workspace.yaml is missing ${setting}.`);
  }

  if (existsSync(npmrcPath)) {
    const activeNpmrcSettings = readFileSync(npmrcPath, 'utf8')
      .split(/\r?\n/)
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');
    if (/^\s*(node-linker|package-import-method|prefer-symlinked-executables|symlink)\s*=/m.test(activeNpmrcSettings)) {
      Fail('.npmrc must not duplicate pnpm project settings.');
    }
  }
}

function AssertLockfiles() {
  if (existsSync(join(repoRoot, 'package-lock.json'))) {
    Fail('package-lock.json must be removed after the pnpm migration.');
  }
  if (!existsSync(join(repoRoot, 'pnpm-lock.yaml'))) {
    Fail('pnpm-lock.yaml is missing.');
  }
}

function WorkspaceDependencyPaths() {
  const paths = [join(repoRoot, 'node_modules')];
  for (const parent of ['apps', 'packages']) {
    const parentPath = join(repoRoot, parent);
    if (!existsSync(parentPath)) continue;
    for (const entry of readdirSync(parentPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const workspacePath = join(parentPath, entry.name);
      if (existsSync(join(workspacePath, 'package.json'))) {
        paths.push(join(workspacePath, 'node_modules'));
      }
    }
  }
  return paths.filter((path) => existsSync(path));
}

function AssertNoSymlinks(rootPath) {
  const candidates = new Set([rootPath]);
  const packageMapPath = join(rootPath, '.package-map.json');
  const modulesStatePath = join(rootPath, '.modules.yaml');
  const pnpmLockPath = join(rootPath, '.pnpm', 'lock.yaml');

  if (rootPath === join(repoRoot, 'node_modules')
    && !existsSync(packageMapPath)
    && !existsSync(modulesStatePath)
    && !existsSync(pnpmLockPath)) {
    Fail('pnpm node_modules metadata is missing; run pnpm run install:pcloud.');
  }

  if (existsSync(packageMapPath)) {
    const packageMap = ReadJson(packageMapPath);
    for (const packageEntry of Object.keys(packageMap.packages ?? {})) {
      const candidate = resolve(rootPath, packageEntry);
      const candidateRelative = relative(repoRoot, candidate);
      if (candidateRelative.startsWith('..') || isAbsolute(candidateRelative)) {
        Fail(`pnpm package map escapes the repository: ${candidate}`);
      }
      candidates.add(candidate);
    }
  }
  if (existsSync(modulesStatePath)) candidates.add(modulesStatePath);
  if (existsSync(pnpmLockPath)) candidates.add(pnpmLockPath);

  let entries;
  try {
    entries = readdirSync(rootPath, { withFileTypes: true });
  } catch (error) {
    Fail(`Cannot inspect ${rootPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  for (const entry of entries) candidates.add(join(rootPath, entry.name));

  for (const candidate of candidates) {
    let stats;
    try {
      stats = lstatSync(candidate);
    } catch (error) {
      Fail(`Cannot inspect ${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (stats.isSymbolicLink()) {
      Fail(`symlink/reparse dependency entry is not allowed on pCloud: ${candidate}`);
    }
  }
}

const rootPackage = ReadJson(packagePath);
AssertPackageManager(rootPackage);
AssertWorkspaceSettings();
AssertLockfiles();
for (const dependencyRoot of WorkspaceDependencyPaths()) AssertNoSymlinks(dependencyRoot);

console.log('[pnpm-pcloud] package manager, lockfiles, workspace settings, and dependency trees are pCloud-safe.');
