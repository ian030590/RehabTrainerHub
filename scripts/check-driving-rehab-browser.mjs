#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

process.env.BRAVE_BIN ||= [
  'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  ...['brave', 'msedge'],
].find(path => path.includes('/') ? existsSync(path) : spawnSync(path, ['--version'], { stdio: 'ignore', windowsHide: true }).status === 0) ?? '';
if (!process.argv.includes('--game')) process.argv.push('--game', 'driving-rehab');
if (!process.argv.includes('--standalone') && !process.argv.includes('--lobby')) process.argv.push('--lobby');
await import('./check-r2-game-browser.mjs');
