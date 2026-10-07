import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const gamesDir = resolve('apps/rehabtrainerhub/games');
const catalogPath = resolve(gamesDir, 'catalog.ts');
const catalogSource = readFileSync(catalogPath, 'utf8');

const gameIds = [...catalogSource.matchAll(
  /\{\s*id:\s*'([^']+)',\s*trainer:\s*'([^']+)'/g,
)].map((m) => m[1]);

console.log(`Found ${gameIds.length} games in catalog.`);

for (const gameId of gameIds) {
  const gameDir = resolve(gamesDir, gameId);
  if (!existsSync(gameDir)) {
    console.warn(`Game directory not found: ${gameDir}`);
    continue;
  }

  const pkg = {
    name: `@rehab-trainer/game-${gameId}`,
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: {
      "build": "vite build"
    },
    dependencies: {
      "@rehab-trainer/ui": "workspace:*"
    }
  };
  writeFileSync(resolve(gameDir, 'package.json'), JSON.stringify(pkg, null, 2));

  const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@rehab-trainer/ui': resolve(__dirname, '../../../../packages/ui/src'),
      '@rehab-trainer/games': resolve(__dirname, '..'),
      '@rehab-trainer/hub-modules': resolve(__dirname, '..'),
    },
  },
  build: {
    assetsDir: 'assets',
    emptyOutDir: true,
    outDir: 'dist',
  },
});
`;
  writeFileSync(resolve(gameDir, 'vite.config.ts'), viteConfig);
}

const hubPkgPath = resolve('apps/rehabtrainerhub/package.json');
const hubPkg = JSON.parse(readFileSync(hubPkgPath, 'utf8'));

for (const gameId of gameIds) {
  hubPkg.dependencies[`@rehab-trainer/game-${gameId}`] = "workspace:*";
}

writeFileSync(hubPkgPath, JSON.stringify(hubPkg, null, 2) + '\n');
console.log('Updated Hub package.json');

const rootPkgPath = resolve('package.json');
const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));

if (!rootPkg.workspaces.includes('apps/rehabtrainerhub/games/*')) {
  rootPkg.workspaces.push('apps/rehabtrainerhub/games/*');
  writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n');
  console.log('Updated Root package.json workspaces');
}
