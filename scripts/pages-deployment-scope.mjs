import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function NeedsPagesDeployment(paths, { migratedIds, readJson }) {
  try {
    return paths.some(path => {
      if (path.startsWith('docs/') || path === 'AGENTS.md') return false;
      const gameId = migratedIds.find(id => path.startsWith(`apps/rehabtrainerhub/games/${id}/`));
      if (gameId && !path.endsWith('/package.json')) return false;
      if (gameId || path === 'package-lock.json') {
        const before = structuredClone(readJson('before', path));
        const after = structuredClone(readJson('after', path));
        if (gameId) {
          if (typeof before.version !== 'string' || typeof after.version !== 'string') return true;
          delete before.version; delete after.version;
        } else {
          for (const id of migratedIds) {
            const key = `apps/rehabtrainerhub/games/${id}`;
            if (!before.packages?.[key] || !after.packages?.[key]) return true;
            delete before.packages[key].version; delete after.packages[key].version;
          }
        }
        return !isDeepStrictEqual(before, after);
      }
      return true;
    });
  } catch { return true; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let required = true;
  const before = process.env.BEFORE;
  const after = process.env.GITHUB_SHA;
  if (process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' && /^[0-9a-f]{40,64}$/.test(before ?? '')
    && /^[0-9a-f]{40,64}$/.test(after ?? '')) {
    try {
      const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      const migratedIds = Object.keys(JSON.parse(git(['show', `${after}:packages/ui/src/officialGameReleases.json`])));
      const paths = git(['diff', '--name-only', '-z', before, after, '--']).split('\0').filter(Boolean);
      required = NeedsPagesDeployment(paths, { migratedIds,
        readJson: (revision, path) => JSON.parse(git(['show', `${revision === 'before' ? before : after}:${path}`])),
      });
    } catch { required = true; }
  }
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `pages_required=${required}\n`);
  console.log(required ? 'Platform changes require Pages deployment.' : 'R2 game content: verify without deploying Pages.');
}
