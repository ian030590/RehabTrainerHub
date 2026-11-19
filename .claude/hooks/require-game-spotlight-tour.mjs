import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CheckGameSpotlightTour,
  gamesPath,
  IsGameTestFile,
  IsGameTourSource,
  MapChangedGameFiles,
} from '../../scripts/lib/game-spotlight-tour.mjs';

const gitOptionsWithValue = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env', '--super-prefix']);
const commitOptionsWithValue = new Set(['--message', '--file', '--reuse-message', '--reedit-message',
  '--fixup', '--squash', '--trailer', '--author', '--date', '--cleanup', '--template', '--pathspec-from-file']);
const shortCommitOptionsWithValue = new Set(['m', 'F', 'C', 'c', 't', 'S']);

function ReadCommitSelection(args, pathsKnown) {
  const paths = [];
  let all = false;
  let pathsFromFile = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--') {
      paths.push(...args.slice(index + 1));
      break;
    }
    if (arg === '--all') all = true;
    if (IsPathspecFileOption(arg)) pathsFromFile = true;
    if (!arg.startsWith('-')) paths.push(arg);
    if (commitOptionsWithValue.has(arg)) index++;
    if (!/^-[^-]/.test(arg)) continue;
    for (const [offset, flag] of [...arg.slice(1)].entries()) {
      if (flag === 'a') all = true;
      if (!shortCommitOptionsWithValue.has(flag)) continue;
      if (flag !== 'S' && offset === arg.length - 2) index++;
      break;
    }
  }
  if (!all && !pathsFromFile && paths.length === 0) return null;
  return { paths: all || pathsFromFile || !pathsKnown ? [] : paths, includeUntracked: false };
}

function IsPathspecFileOption(arg) {
  return arg === '--pathspec-from-file' || arg.startsWith('--pathspec-from-file=');
}

function ReadAddSelection(args, pathsKnown) {
  const paths = [];
  let scopeAll = false;
  let includeUntracked = true;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--') {
      paths.push(...args.slice(index + 1));
      break;
    }
    if (arg === '--dry-run' || /^-[^-]*n/.test(arg)) return null;
    if (arg === '--update' || /^-[^-]*u/.test(arg)) {
      scopeAll = true;
      includeUntracked = false;
    }
    if (['--all', '--patch', '--interactive'].includes(arg) || /^-[^-]*[Api]/.test(arg)) scopeAll = true;
    if (IsPathspecFileOption(arg)) {
      if (arg === '--pathspec-from-file') index++;
      scopeAll = true;
      pathsKnown = false;
    } else if (!arg.startsWith('-')) {
      paths.push(arg);
    }
  }
  if (!scopeAll && paths.length === 0) return null;
  return { paths: pathsKnown ? paths : [], includeUntracked };
}

function FindCommitSelections(command) {
  const pendingAdds = [];
  const commitSelections = [];
  let addedBeforeCommit = 0;
  let hasCommit = false;
  let shellPathsKnown = true;
  let words = [];
  for (const [token] of command.matchAll(/#[^\r\n]*|(?:[^\s"';&|()]+|'[^']*'|"(?:\\.|[^"\\])*")+|[;&|()\r\n]/g)) {
    if (/^[;&|()\r\n]$/.test(token)) {
      CheckCommand();
      words = [];
    } else if (!token.startsWith('#')) {
      words.push(token.replace(/'([^']*)'|"((?:\\.|[^"\\])*)"/g, (match, single, double) => single ?? double));
    }
  }
  CheckCommand();
  return hasCommit ? [...pendingAdds.slice(0, addedBeforeCommit), ...commitSelections] : null;

  function CheckCommand() {
    let index = 0;
    while (/^(?:env|command|[a-zA-Z_]\w*=.*)$/.test(words[index] ?? '')) index++;
    if (/^(?:cd|pushd|popd|Set-Location)$/i.test(words[index] ?? '')) shellPathsKnown = false;
    if (!/(?:^|[/\\])git(?:\.exe)?$/i.test(words[index] ?? '')) return;
    index++;
    let pathsKnown = shellPathsKnown;
    while (words[index]?.startsWith('-')) {
      if (words[index] === '-C' && words[index + 1] !== '.' && words[index + 1] !== '') pathsKnown = false;
      index += gitOptionsWithValue.has(words[index]) ? 2 : 1;
    }
    const args = words.slice(index + 1);
    if (words[index] === 'add') {
      const selection = ReadAddSelection(args, pathsKnown);
      if (selection) pendingAdds.push(selection);
    } else if (words[index] === 'commit') {
      hasCommit = true;
      addedBeforeCommit = pendingAdds.length;
      const selection = ReadCommitSelection(args, pathsKnown);
      if (selection) commitSelections.push(selection);
    }
  }
}

function RunGit(root, args, input) {
  return execFileSync('git', args, { cwd: root, input, stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000, maxBuffer: 32 * 1024 * 1024 });
}

function ReadIndexBlobs(root, objects) {
  if (!objects.length) return [];
  const output = RunGit(root, ['cat-file', '--batch'], objects.map(({ oid }) => oid).join('\n') + '\n');
  let offset = 0;
  return objects.map(({ path, oid }) => {
    const headerEnd = output.indexOf(10, offset);
    const [actualOid, type, size] = output.toString('utf8', offset, headerEnd).split(' ');
    if (actualOid !== oid || type !== 'blob') throw new Error('Git 無法讀取暫存的聚光燈檔案。');
    const end = headerEnd + 1 + Number(size);
    offset = end + 1;
    return [path, output.toString('utf8', headerEnd + 1, end)];
  });
}

function ReadIndexFiles(root) {
  return RunGit(root, ['ls-files', '--stage', '-z', '--', gamesPath]).toString('utf8').split('\0')
    .flatMap(entry => {
      const file = /^100(?:644|755) ([a-f0-9]+) 0\t([\s\S]+)$/.exec(entry);
      return file ? [{ oid: file[1], path: file[2] }] : [];
    });
}

function ReadGameSources(root, indexFiles, workingTreeFiles, id) {
  const prefix = gamesPath + '/' + id + '/';
  const gameSources = indexFiles.filter(file => file.path.startsWith(prefix) && IsGameTourSource(file.path.slice(prefix.length)));
  const sources = new Map(ReadIndexBlobs(root, gameSources.filter(file => !workingTreeFiles.has(file.path)))
    .map(([path, source]) => [path.slice(prefix.length), source]));
  for (const path of workingTreeFiles) {
    if (!path.startsWith(prefix) || !IsGameTourSource(path.slice(prefix.length))) continue;
    const absolute = resolve(root, path);
    if (lstatSync(absolute, { throwIfNoEntry: false })?.isFile()) {
      sources.set(path.slice(prefix.length), readFileSync(absolute, 'utf8'));
    }
  }
  return sources;
}

function IsPlayerFacing(path) {
  return !IsGameTestFile(path)
    && (/\.(?:tsx?|css)$/.test(path) || /^(?:i18n\/|settings(?:\/|\.)|public\/game\.json$)/.test(path));
}

function IsTutorialFile(path) {
  return !IsGameTestFile(path) && (path === 'runtime/tour.ts' || path.startsWith('rules/'));
}

function ReadChangedPaths(root, args, paths = []) {
  const scope = paths.length ? paths : [gamesPath];
  return RunGit(root, [...args, '--', ...scope]).toString('utf8').split('\0')
    .filter(path => path.startsWith(gamesPath + '/'));
}

function CheckCommit(root, selections) {
  const diffArgs = ['--name-only', '-z', '--no-renames', '--no-relative'];
  const staged = ReadChangedPaths(root, ['diff', '--cached', ...diffArgs]);
  const workingTreeFiles = new Set();
  for (const { paths, includeUntracked } of selections) {
    for (const path of ReadChangedPaths(root, ['diff', ...diffArgs], paths)) workingTreeFiles.add(path);
    if (includeUntracked) {
      for (const path of ReadChangedPaths(root, ['ls-files', '--others', '--exclude-standard', '-z'], paths)) workingTreeFiles.add(path);
    }
  }
  const changed = [...staged, ...workingTreeFiles];
  if (changed.length === 0) return;

  const indexFiles = ReadIndexFiles(root);
  const workspaceIds = [...indexFiles.map(({ path }) => path), ...workingTreeFiles].flatMap(path => {
    const parts = path.slice(gamesPath.length + 1).split('/');
    if (parts.length !== 2 || parts[1] !== 'package.json') return [];
    return workingTreeFiles.has(path) && !lstatSync(resolve(root, path), { throwIfNoEntry: false })?.isFile()
      ? [] : [parts[0]];
  });
  const blocked = [];
  const reminders = [];
  for (const [id, paths] of MapChangedGameFiles(changed, workspaceIds)) {
    const problems = CheckGameSpotlightTour(root, id, ReadGameSources(root, indexFiles, workingTreeFiles, id));
    if (problems.length) {
      blocked.push(id + '\n' + problems.map(problem => '  - ' + problem).join('\n'));
    } else if (paths.some(IsPlayerFacing) && !paths.some(IsTutorialFile)) {
      reminders.push(id);
    }
  }
  if (blocked.length) {
    console.error('聚光燈教學檢查未通過：\n' + blocked.join('\n')
      + '\n每款遊戲都須有明確的聚光燈說明。請先新增或修正教學，再提交。');
    process.exitCode = 2;
  } else if (reminders.length) {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: reminders.join('、') + ' 的遊戲內容有變動。請確認聚光燈步驟已明確說明這些變動，缺少說明時請更新教學。',
      },
    }));
  }
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const command = input?.tool_input?.command;
  if ((input?.tool_name === 'Bash' || input?.tool_name === 'PowerShell') && typeof command === 'string') {
    const selections = FindCommitSelections(command);
    if (selections) {
      const root = process.env.CLAUDE_PROJECT_DIR || resolve(import.meta.dirname, '../..');
      CheckCommit(root, selections);
    }
  }
} catch (error) {
  console.error('聚光燈教學檢查無法執行：' + error.message);
}
