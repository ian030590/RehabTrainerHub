import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const browserPath = [process.env.BRAVE_BIN,
  'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/usr/bin/brave-browser', '/usr/bin/brave',
].find(path => path && existsSync(path));

if (!browserPath) {
  if (process.platform === 'win32' || process.env.BRAVE_BIN) {
    throw new Error('The local UI/UX gate requires Brave. Install it or set BRAVE_BIN.');
  }
  console.log('UI/UX browser gate not assessed: Brave is unavailable. Run npm run test:uiux-browser on a host with Brave.');
} else {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('Run this gate through npm run test:uiux-browser.');
  for (const args of [
    [npmCli, 'run', 'build:hub'],
    [resolve(root, 'scripts/check-hub-uiux-browser.mjs')],
    [npmCli, '--prefix', 'apps/rehabtrainerhub/games/hart-chart', 'run', 'build'],
    [npmCli, 'run', 'build:gamerunner'],
    [resolve(root, 'scripts/check-r2-game-browser.mjs'), '--game', 'hart-chart', '--standalone', '--mobile'],
    [resolve(root, 'scripts/check-r2-game-browser.mjs'), '--game', 'hart-chart', '--standalone', '--mobile', '--chinese'],
    [npmCli, '--prefix', 'apps/rehabtrainerhub/games/motor-cortex-rehab', 'run', 'build'],
    [resolve(root, 'scripts/check-r2-game-browser.mjs'), '--game', 'motor-cortex-rehab', '--standalone', '--mobile'],
    [resolve(root, 'scripts/check-r2-game-browser.mjs'), '--game', 'motor-cortex-rehab', '--standalone', '--wide', '--english', '--right'],
    [resolve(root, 'scripts/check-r2-game-browser.mjs'), '--game', 'motor-cortex-rehab', '--standalone', '--tablet', '--left', '--vertical'],
  ]) {
    const result = spawnSync(process.execPath, args, {
      cwd: root, stdio: 'inherit', env: { ...process.env, BRAVE_BIN: browserPath }, windowsHide: true,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
