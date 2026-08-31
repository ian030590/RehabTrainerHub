#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(join(fileURLToPath(new URL('.', import.meta.url)), '..'));

function ReadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function Fail(message) {
  throw new Error(`[pnpm-policy] ${message}`);
}

const rootPackage = ReadJson(join(repoRoot, 'package.json'));
if (!/^pnpm@11\.24\.0(?:\+|$)/.test(rootPackage.packageManager ?? '')) {
  Fail('packageManager must pin pnpm 11.24.0.');
}
if (existsSync(join(repoRoot, 'package-lock.json'))) Fail('package-lock.json must not exist.');
if (!existsSync(join(repoRoot, 'pnpm-lock.yaml'))) Fail('pnpm-lock.yaml is missing.');
if (Object.hasOwn(rootPackage, 'workspaces')) Fail('workspace globs belong in pnpm-workspace.yaml.');
if (Object.hasOwn(rootPackage, 'pnpm')) Fail('pnpm project settings belong in pnpm-workspace.yaml.');
if (JSON.stringify(rootPackage.scripts).match(/\bnpm\s+(?:install|ci|run)\b/)) {
  Fail('scripts must use pnpm, not npm install/ci/run.');
}

const workspaceSource = readFileSync(join(repoRoot, 'pnpm-workspace.yaml'), 'utf8');
for (const setting of [
  /nodeLinker:\s*isolated/,
  /packageImportMethod:\s*auto/,
  /preferSymlinkedExecutables:\s*true/,
  /symlink:\s*true/,
]) {
  if (!setting.test(workspaceSource)) Fail(`pnpm-workspace.yaml must include ${setting}.`);
}
for (const forbidden of [
  /nodeLinker:\s*hoisted/,
  /packageImportMethod:\s*copy/,
  /injectWorkspacePackages:\s*true/,
  /dedupeInjectedDeps:\s*false/,
  /preferSymlinkedExecutables:\s*false/,
  /symlink:\s*false/,
]) {
  if (forbidden.test(workspaceSource)) Fail(`pCloud compatibility setting remains: ${forbidden}.`);
}

const npmrcPath = join(repoRoot, '.npmrc');
if (existsSync(npmrcPath) && /(^|\n)\s*(?:node-linker|package-import-method|inject-workspace-packages|prefer-symlinked-executables|symlink)\s*=/m.test(readFileSync(npmrcPath, 'utf8'))) {
  Fail('.npmrc must not duplicate pnpm project settings.');
}

const workspaceNames = new Set();
for (const parent of ['apps', 'packages']) {
  const parentPath = join(repoRoot, parent);
  if (!existsSync(parentPath)) continue;
  for (const entry of readdirSync(parentPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packagePath = join(parentPath, entry.name, 'package.json');
    if (existsSync(packagePath)) workspaceNames.add(ReadJson(packagePath).name);
  }
}
for (const parent of ['apps', 'packages']) {
  const parentPath = join(repoRoot, parent);
  if (!existsSync(parentPath)) continue;
  for (const entry of readdirSync(parentPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packagePath = join(parentPath, entry.name, 'package.json');
    if (!existsSync(packagePath)) continue;
    const pkg = ReadJson(packagePath);
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [name, version] of Object.entries(pkg[section] ?? {})) {
        if (workspaceNames.has(name) && !String(version).startsWith('workspace:')) {
          Fail(`${pkg.name} must declare workspace package ${name} with workspace:* or a workspace range.`);
        }
      }
    }
  }
}

console.log('[pnpm-policy] pnpm 11.24.0, isolated linker, workspace protocol, and lockfile policy verified.');
