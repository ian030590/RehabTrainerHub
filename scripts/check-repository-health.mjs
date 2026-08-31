#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

const head = RunGit(['rev-parse', '--verify', 'HEAD^{commit}']);
if (head.status !== 0 || !/^[0-9a-f]{40}$/i.test(head.stdout.trim())) {
  failures.push('HEAD does not resolve to a commit. Restore the intended branch/ref before testing or committing.');
}

const gitDirResult = RunGit(['rev-parse', '--git-dir']);
if (gitDirResult.status !== 0) {
  failures.push('The Git metadata directory cannot be resolved.');
} else {
  const gitDir = resolve(repoRoot, gitDirResult.stdout.trim());
  if (!existsSync(join(gitDir, 'index'))) {
    failures.push('The canonical .git/index is missing.');
  }
  for (const relativePath of CollectConflictArtifacts(gitDir, '', 0)) {
    failures.push(`Git metadata contains a sync-conflict artifact: .git/${relativePath}`);
  }
}

const repositoryPaths = RunGit([
  'ls-files',
  '--cached',
  '--others',
  '--exclude-standard',
  '-z',
]);
if (repositoryPaths.status !== 0) {
  failures.push('The Git index cannot be read with git ls-files.');
} else {
  const conflictedPaths = repositoryPaths.stdout
    .split('\0')
    .filter(Boolean)
    .filter((path) => IsConflictName(path));
  for (const path of conflictedPaths) {
    failures.push(`A tracked or unignored sync-conflict filename is present: ${path}`);
  }
}

assert.deepEqual(failures, [], `Repository health check failed:\n- ${failures.join('\n- ')}`);
console.log(`Repository health passed at ${head.stdout.trim().slice(0, 12)}: HEAD, index/refs, and repository filenames are coherent.`);

function RunGit(args) {
  return spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

function CollectConflictArtifacts(directory, relativeDirectory, depth) {
  if (depth > 4) return [];
  const results = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relativePath = join(relativeDirectory, entry.name);
    if (IsConflictName(entry.name)) results.push(relativePath);
    const shouldDescend = entry.isDirectory()
      && (relativeDirectory !== '' || ['refs', 'logs'].includes(entry.name));
    if (shouldDescend) {
      results.push(...CollectConflictArtifacts(join(directory, entry.name), relativePath, depth + 1));
    }
  }
  return results;
}

function IsConflictName(value) {
  return /(?:\[conflicted(?:\s+\d+)?\]|conflicted copy|conflict copy)/i.test(value);
}
