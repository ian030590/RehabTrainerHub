import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const gamesDir = resolve(repoRoot, 'apps/rehabtrainerhub/games');
const catalogPath = resolve(gamesDir, 'catalog.ts');

if (!existsSync(catalogPath)) {
  console.error('catalog.ts not found');
  process.exit(1);
}

const catalogSource = readFileSync(catalogPath, 'utf8');
const gameIds = [...catalogSource.matchAll(/\{\s*id:\s*'([^']+)',\s*trainer:/g)].map(m => m[1]);

console.log(`Found ${gameIds.length} games in catalog.ts...`);

let madeChanges = false;

// 1. Ensure each game has package.json and vite.config.ts
for (const gameId of gameIds) {
  const gameDir = resolve(gamesDir, gameId);
  if (!existsSync(gameDir)) continue;

  const pkgPath = resolve(gameDir, 'package.json');
  if (!existsSync(pkgPath)) {
    const pkg = {
      name: `@rehab-trainer/game-${gameId}`,
      version: "1.0.0",
      private: true,
      type: "module",
      scripts: {
        "build": "vite build"
      },
      dependencies: {
        "@rehab-trainer/ui": "*"
      }
    };
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`Created package.json for ${gameId}`);
    madeChanges = true;
  }

  const viteConfigPath = resolve(gameDir, 'vite.config.ts');
  if (!existsSync(viteConfigPath)) {
    const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@rehab-trainer/ui': fileURLToPath(new URL('../../../../packages/ui/src', import.meta.url)),
      '@rehab-trainer/games': fileURLToPath(new URL('..', import.meta.url)),
      '@rehab-trainer/hub-modules': fileURLToPath(new URL('..', import.meta.url)),
    },
  },
  build: {
    assetsDir: 'assets',
    emptyOutDir: true,
    outDir: 'dist',
  },
});
`;
    writeFileSync(viteConfigPath, viteConfig);
    console.log(`Created vite.config.ts for ${gameId}`);
    madeChanges = true;
  }
}

// 2. Sync Hub package.json
const hubPkgPath = resolve(repoRoot, 'apps/rehabtrainerhub/package.json');
const hubPkg = JSON.parse(readFileSync(hubPkgPath, 'utf8'));
let hubPkgChanged = false;

// Add missing dependencies
for (const gameId of gameIds) {
  const depName = `@rehab-trainer/game-${gameId}`;
  if (!hubPkg.dependencies[depName]) {
    hubPkg.dependencies[depName] = '*';
    hubPkgChanged = true;
  }
}

// Remove removed dependencies
const currentDeps = Object.keys(hubPkg.dependencies);
for (const dep of currentDeps) {
  if (dep.startsWith('@rehab-trainer/game-')) {
    const gameId = dep.replace('@rehab-trainer/game-', '');
    if (!gameIds.includes(gameId)) {
      delete hubPkg.dependencies[dep];
      hubPkgChanged = true;
    }
  }
}

// Sort dependencies
if (hubPkgChanged) {
  const sortedDeps = {};
  Object.keys(hubPkg.dependencies).sort().forEach(k => {
    sortedDeps[k] = hubPkg.dependencies[k];
  });
  hubPkg.dependencies = sortedDeps;
  writeFileSync(hubPkgPath, JSON.stringify(hubPkg, null, 2) + '\n');
  console.log('Synchronized Hub package.json dependencies.');
  madeChanges = true;
}

// 3. Sync Root package.json workspaces
const rootPkgPath = resolve(repoRoot, 'package.json');
const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
if (!rootPkg.workspaces.includes('apps/rehabtrainerhub/games/*')) {
  rootPkg.workspaces.push('apps/rehabtrainerhub/games/*');
  writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n');
  console.log('Added apps/rehabtrainerhub/games/* to root workspaces.');
  madeChanges = true;
}

if (madeChanges) {
  console.log('\nChanges were made to package configurations.');
  console.log('Please run `npm install` to update the lockfile and wire up the new workspaces.');
} else {
  console.log('\nAll games are perfectly synchronized!');
}
