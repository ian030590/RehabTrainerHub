import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const temporary = join(root, '.tmp');
const folder = join(temporary, 'layout-audit');
await mkdir(folder, { recursive: true });
const gamesRoot = join(root, 'apps/rehabtrainerhub/games');
const games = (await readdir(gamesRoot)).filter(game => existsSync(join(gamesRoot, game, 'package.json')));
const modes = ['desktop', 'mobile', 'tablet'];
const categories = ['horizontalOverflow', 'clippedTargets', 'smallTargets', 'crowdedTargets', 'clippedText', 'chartText', 'smallText'];
const runsFile = join(folder, 'runs.json');
const runs = existsSync(runsFile) ? JSON.parse(await readFile(runsFile, 'utf8')) : [];
const captures = [];

function PhaseType(name) {
  if (/result|score-analysis/.test(name)) return 'results';
  if (/tutorial|spotlight/.test(name)) return 'tutorial/spotlight';
  if (/disconnect|interrupt|renderer-(error|failure)/.test(name)) return 'interrupt';
  if (/settings|confirmation|consent|calibration|camera-position|camera-ready|sensor-ready|intro|validation|^qr$/.test(name)) return 'settings';
  return 'gameplay';
}

function Examples(data, category) {
  if (category === 'smallText') return data.smallText.examples;
  if (category === 'chartText') return data.chartText.elements;
  if (category === 'horizontalOverflow') return data.horizontalOverflow.elements;
  return data[category];
}

function SizeOfFinding(data, category, entry) {
  const r = entry.rect;
  switch (category) {
    case 'horizontalOverflow': return data.horizontalOverflow.pixels;
    case 'clippedTargets': return Math.max(entry.clipX, entry.clipY);
    case 'smallTargets': return 44 - Math.min(r.width, r.height);
    case 'crowdedTargets': return 8 - entry.gap;
    case 'clippedText': return Math.max(entry.clipX, entry.clipY);
    case 'smallText': return 14 - entry.fontSize;
    default: return 0;
  }
}

const groups = ['settings', 'tutorial/spotlight', 'gameplay', 'interrupt', 'results'];
const worst = Object.fromEntries(groups.map(group => [group, []]));
async function Scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await Scan(path);
    if (!entry.isFile() || !entry.name.endsWith('.layout.json')) continue;
    const data = JSON.parse(await readFile(path, 'utf8'));
    const { gameId, phase, viewportMode } = data;
    const group = PhaseType(phase);
    const screenshot = relative(root, path.replace(/\.layout\.json$/, '.png'));
    const counts = {};
    const examples = {};
    for (const category of categories) {
      const items = Examples(data, category);
      counts[category] = category === 'smallText' ? data.smallText.count : category === 'horizontalOverflow'
        ? Number(data.horizontalOverflow.pixels > 0) : items.length;
      examples[category] = items.map(item => ({ ...item, pixels: SizeOfFinding(data, category, item) }))
        .sort((a, b) => b.pixels - a.pixels).slice(0, 5);
      if (category !== 'chartText') {
        for (const item of items) worst[group].push({ gameId, viewportMode, phase, category, screenshot,
          ...item, pixels: SizeOfFinding(data, category, item) });
      }
    }
    captures.push({ gameId, viewportMode, phase, group, screenshot, counts, examples,
      chartMin: data.chartText.min, chartMedian: data.chartText.median });
  }
}
await Scan(temporary);
for (const items of Object.values(worst)) items.sort((a, b) => b.pixels - a.pixels).splice(15);
const totals = Object.fromEntries(categories.map(category => [category, captures.reduce((sum, row) => sum + row.counts[category], 0)]));
const table = ['| Game | Desktop | Mobile | Tablet |', '|---|---|---|---|'];
for (const game of games) {
  table.push('| ' + [game, ...modes.map(mode => {
    const run = runs.find(row => row.gameId === game && row.viewportMode === mode);
    return run ? [run.status, run.error].filter(Boolean).join(' / ') : 'unrun';
  })].join(' | ') + ' |');
}
const lines = ['# Local standalone layout audit', '', ...table, '',
  'Captures: ' + captures.length, 'Category totals: ' + JSON.stringify(totals),
  'Chart counts describe measured labels. Mobile and tablet use browser emulation.', ''];
for (const group of groups) {
  lines.push('## ' + group, '', '| Game | Viewport | Phase | ' + categories.join(' | ') + ' |',
    '|' + '---|'.repeat(3 + categories.length));
  for (const row of captures.filter(row => row.group === group)) {
    lines.push('| ' + [row.gameId, row.viewportMode, row.phase, ...Object.values(row.counts)].join(' | ') + ' |');
  }
  lines.push('', 'Largest observed pixel deviations', '');
  for (const item of worst[group]) lines.push('- ' + [item.gameId, item.viewportMode, item.phase, item.category,
    item.selector, item.other, JSON.stringify(item.rect), item.pixels + ' px', item.screenshot].filter(Boolean).join(' / '));
  if (!worst[group].length) lines.push('No findings recorded.');
  lines.push('');
}
await writeFile(join(folder, 'report.md'), lines.join('\n'));
await writeFile(join(folder, 'report.json'), JSON.stringify({ games, modes, runs, totals, captures, worst }, null, 2) + '\n');
console.log(games.length + ' games, ' + runs.length + ' recorded runs, ' + captures.length + ' captures. ' + relative(root, folder));
