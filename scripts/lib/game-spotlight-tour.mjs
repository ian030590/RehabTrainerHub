import { readdirSync, readFileSync, statSync } from 'node:fs';
import { posix, resolve } from 'node:path';

export const gamesPath = 'apps/rehabtrainerhub/games';

const ignoredDirectories = new Set(['dist', 'node_modules']);
const stringLiteral = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`/g;
const commentsAndStrings = new RegExp(stringLiteral.source + '|/\\*[\\s\\S]*?\\*/|//[^\\r\\n]*', 'g');

export function ListGameWorkspaceIds(root) {
  const gamesRoot = resolve(root, gamesPath);
  return readdirSync(gamesRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory()
      && statSync(resolve(gamesRoot, entry.name, 'package.json'), { throwIfNoEntry: false })?.isFile())
    .map(entry => entry.name)
    .sort();
}

export function MapChangedGameFiles(paths, gameIds) {
  const workspaces = new Set(gameIds);
  const touched = new Map();
  for (const path of paths) {
    const normalized = posix.normalize(path.replaceAll('\\', '/'));
    if (!normalized.startsWith(gamesPath + '/')) continue;
    const [id, ...parts] = normalized.slice(gamesPath.length + 1).split('/');
    if (!workspaces.has(id) || !parts[0] || parts.slice(0, -1).some(part => ignoredDirectories.has(part))) continue;
    if (!touched.has(id)) touched.set(id, new Set());
    touched.get(id).add(parts.join('/'));
  }
  return new Map([...touched].map(([id, files]) => [id, [...files]]));
}

export function IsGameTestFile(path) {
  return /(?:^|\/)(?:__tests__|test|tests)\//.test(path) || /\.(?:test|spec)\.[^/]+$/.test(path);
}

export function IsGameTourSource(path) {
  if (path.split('/').slice(0, -1).some(part => ignoredDirectories.has(part)) || IsGameTestFile(path)) return false;
  return /\.css$/.test(path) || path === 'runtime/tour.ts' || /^(?:rules\/.*|[^/]+)\.tsx?$/.test(path);
}

function ReadTourSources(gameRoot, directory = '', sources = new Map()) {
  for (const entry of readdirSync(resolve(gameRoot, directory), { withFileTypes: true })) {
    const path = posix.join(directory, entry.name);
    if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) {
      ReadTourSources(gameRoot, path, sources);
    } else if (entry.isFile() && IsGameTourSource(path)) {
      sources.set(path, readFileSync(resolve(gameRoot, path), 'utf8'));
    }
  }
  return sources;
}

function Blank(text) {
  return text.replace(/[^\r\n]/g, ' ');
}

function StripComments(source) {
  return source.replace(commentsAndStrings, match => match.startsWith('/') ? Blank(match) : match);
}

function FindTutorialSources(sources) {
  const tutorials = new Set();
  for (const [path, original] of sources) {
    if (!/\.tsx?$/.test(path) || path === 'runtime/tour.ts') continue;
    const source = StripComments(original);
    const imports = [...source.matchAll(/^\s*import\s*\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"]/gm)]
      .map(([, names, module]) => ({
        names: names.split(',').map(name => name.trim()),
        path: posix.normalize(posix.join(posix.dirname(path), module)).replace(/\.tsx?$/, ''),
      }));
    if (!imports.some(entry => entry.path === 'runtime/tour' && entry.names.includes('StartTour'))) continue;
    const calls = [...source.replace(stringLiteral, Blank).matchAll(/\bStartTour\s*\(\s*([\w$]*)/g)];
    if (!calls.length) continue;
    if (path.startsWith('rules/')) tutorials.add(path);
    for (const entry of imports) {
      if (!entry.path.startsWith('rules/') || !entry.names.some(name => calls.some(call => call[1] === name))) continue;
      for (const extension of ['.ts', '.tsx']) {
        const imported = entry.path + extension;
        if (sources.has(imported)) tutorials.add(imported);
      }
    }
  }
  return tutorials;
}

function AddStepLocales(locales, titles, descriptions) {
  const HasHan = value => /\p{Script=Han}/u.test(value);
  const HasEnglish = value => /[a-z]/i.test(value.replace(/\$\{[^}]*\}/g, '')) && !HasHan(value);
  if (titles.some(HasEnglish) && descriptions.some(HasEnglish)) locales.add('en');
  if (titles.some(HasHan) && descriptions.some(HasHan)) locales.add('zh');
}

function AddIndexedStepLocales(locales, source, masked, title, text) {
  const indexedTitle = /^([a-zA-Z_$][\w$]*\s*\[\s*[\w$]+\s*\])\s*\[\s*0\s*\]$/.exec(title);
  const indexedText = /^([a-zA-Z_$][\w$]*\s*\[\s*[\w$]+\s*\])\s*\[\s*1\s*\]$/.exec(text);
  if (!indexedTitle || !indexedText || indexedTitle[1].replace(/\s/g, '') !== indexedText[1].replace(/\s/g, '')) return;
  const name = indexedTitle[1].split('[')[0].trim();
  for (const declaration of masked.matchAll(/\b(?:const|let)\s+([a-zA-Z_$][\w$]*)\s*=\s*([^;]+)/g)) {
    if (declaration[1] !== name) continue;
    const start = declaration.index + declaration[0].length - declaration[2].length;
    for (const pair of declaration[2].matchAll(/\[\s*,\s*\]/g)) {
      const pairStart = start + pair.index;
      const comma = pairStart + pair[0].indexOf(',');
      const titleCopy = source.slice(pairStart + 1, comma).match(stringLiteral) ?? [];
      const textCopy = source.slice(comma + 1, pairStart + pair[0].length - 1).match(stringLiteral) ?? [];
      AddStepLocales(locales, titleCopy, textCopy);
    }
  }
}

function FindStepCopy(sources, tutorials) {
  const locales = new Set();
  let hasSteps = false;
  for (const path of tutorials) {
    const source = StripComments(sources.get(path));
    const masked = source.replace(stringLiteral, Blank);
    for (const object of masked.matchAll(/\{[^{}]*\}/g)) {
      const fields = [...object[0].matchAll(/[{,]\s*([a-zA-Z_$][\w$]*)\s*:/g)];
      const values = new Map(fields.map((field, index) => [
        field[1],
        source.slice(object.index + field.index + field[0].length, object.index + (fields[index + 1]?.index ?? object[0].length - 1)).trim(),
      ]));
      if (!['target', 'title', 'text', 'place'].every(field => values.get(field))) continue;
      hasSteps = true;
      const title = values.get('title');
      const text = values.get('text');
      AddStepLocales(locales, title.match(stringLiteral) ?? [], text.match(stringLiteral) ?? []);
      AddIndexedStepLocales(locales, source, masked, title, text);
    }
  }
  return { hasSteps, locales };
}

export function CheckGameSpotlightTour(root, gameId, sources = ReadTourSources(resolve(root, gamesPath, gameId))) {
  const problems = [];
  const runtime = sources.get('runtime/tour.ts');
  if (runtime === undefined) {
    problems.push('缺少 runtime/tour.ts。');
  } else {
    const code = StripComments(runtime);
    if (!/\bexport\s+(?:(?:async\s+)?function|const|let)\s+StartTour\b|\bexport\s*\{[^}]*\bStartTour\b/.test(code.replace(stringLiteral, Blank))) {
      problems.push('runtime/tour.ts 未匯出 StartTour。');
    }
    if (!/\.className\s*=\s*['"]game-tour-spotlight['"]|\.classList\.add\(\s*['"]game-tour-spotlight['"]/.test(code)) {
      problems.push('runtime/tour.ts 未建立帶有 game-tour-spotlight 類別的元素。');
    }
  }

  const tutorials = FindTutorialSources(sources);
  if (tutorials.size === 0) {
    problems.push('缺少呼叫遊戲 StartTour 的 rules/ 教學，或缺少遊戲頁面啟動教學時使用的 rules/ 步驟。');
  } else {
    const { hasSteps, locales } = FindStepCopy(sources, tutorials);
    if (!hasSteps) {
      problems.push('聚光燈步驟須包含 target、title、text 和 place。');
    } else {
      if (!locales.has('en')) problems.push('聚光燈步驟缺少英文（en）標題與說明。');
      if (!locales.has('zh')) problems.push('聚光燈步驟缺少繁體中文（zh）標題與說明。');
    }
  }

  const hasCss = [...sources].some(([path, source]) => path.endsWith('.css')
    && /\.game-tour-spotlight(?![\w-])[^{};]*\{/.test(source.replace(/\/\*[\s\S]*?\*\//g, '')));
  if (!hasCss) problems.push('遊戲 CSS 缺少 .game-tour-spotlight 樣式。');
  return problems;
}
