#!/usr/bin/env node

import { existsSync, lstatSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(join(fileURLToPath(new URL('.', import.meta.url)), '..'));
const generatedMetadataPaths = [
  join(repoRoot, 'node_modules', '.package-map.json'),
  join(repoRoot, 'node_modules', '.modules.yaml'),
  join(repoRoot, 'node_modules', '.pnpm-workspace-state-v1.json'),
];

// pnpm 11 refreshes these generated metadata files on every install. pCloud
// can create a dot-file but rejects replacing it in place, so remove only
// pnpm-owned metadata before linking physical dependency copies. The workspace
// state file must be cleared too: otherwise pnpm may report "Already up to
// date" while a previous interrupted install left a workspace package missing.
for (const metadataPath of generatedMetadataPaths) {
  if (!existsSync(metadataPath)) continue;
  const stats = lstatSync(metadataPath);
  if (stats.isSymbolicLink()) {
    throw new Error(`[pnpm-pcloud] refusing to remove a symlink: ${metadataPath}`);
  }
  unlinkSync(metadataPath);
  console.log(`[pnpm-pcloud] removed stale generated metadata: ${metadataPath}`);
}
