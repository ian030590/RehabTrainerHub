import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const repositoryRoot = resolve(import.meta.dirname, '..');
const gamesRoot = resolve(repositoryRoot, 'apps/rehabtrainerhub/games');

test('all official game pointer targets have a real input surface', async () => {
  const gameDirectories = (await readdir(gamesRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const findings = [];

  for (const gameId of gameDirectories) {
    const gameRoot = resolve(gamesRoot, gameId);
    const files = await ReadGameFiles(gameRoot);
    const sourceFiles = files.filter(({ path }) => /\.(?:tsx?|jsx?)$/.test(path));
    const css = files
      .filter(({ path }) => path.endsWith('.css'))
      .map(({ content }) => content)
      .join('\n');

    for (const { path, content } of sourceFiles) {
      for (const targetMatch of content.matchAll(/\b([A-Za-z_$][\w$]*)\.addEventListener\(\s*['"](?:pointer|touch|mouse)/g)) {
        const target = targetMatch[1];
        const refMatch = content.match(
          new RegExp(`\\b(?:const|let|var)\\s+${EscapeRegExp(target)}\\s*=\\s*([A-Za-z_$][\\w$]*)\\.current\\b`),
        );
        if (!refMatch) continue;

        const element = FindRefElement(content, refMatch[1]);
        if (!element) continue;

        const classNames = element.className.split(/\s+/).filter(Boolean);
        const isSizedCanvasHost = new RegExp(
          `\\b${EscapeRegExp(target)}\\.appendChild\\([\\s\\S]{0,120}\\bcanvas\\b`,
        ).test(content);
        if (isSizedCanvasHost) {
          const hasRendererSizing = new RegExp(
            `(?:resizeTo\\s*:\\s*${EscapeRegExp(target)}|canvas\\.style\\.(?:width|height))`,
          ).test(content);
          if (!hasRendererSizing) {
            findings.push(`${gameId}/${path}: canvas host '${target}' has pointer listeners without renderer sizing`);
          }
          continue;
        }

        if (!classNames.some((className) => HasFullSizeInputRule(css, className))) {
          findings.push(
            `${gameId}/${path}: pointer target '${target}' (${classNames.join('.') || 'unclassed'}) has no full-size CSS input surface`,
          );
        }
      }

      for (const canvasElement of FindPointerCanvasElements(content)) {
        if (!/\bstyle\s*=/.test(canvasElement)) {
          findings.push(`${gameId}/${path}: pointer-enabled canvas has no inline style or layout contract`);
        }
      }
    }
  }

  assert.deepEqual(findings, [], findings.join('\n'));
});

async function ReadGameFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'public' || entry.name === 'node_modules') continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await ReadGameFiles(path));
    } else if (/\.(?:tsx?|jsx?|css)$/.test(entry.name)) {
      files.push({ path: path.slice(directory.length + 1), content: await readFile(path, 'utf8') });
    }
  }
  return files;
}

function FindRefElement(source, refName) {
  for (const match of source.matchAll(/<[A-Za-z][\w.-]*\b[^>]*>/g)) {
    if (!new RegExp(`\\bref=\\{${EscapeRegExp(refName)}\\}`).test(match[0])) continue;
    const classMatch = match[0].match(/\bclassName=["']([^"']+)["']/);
    return { className: classMatch?.[1] ?? '' };
  }
  return null;
}

function FindPointerCanvasElements(source) {
  return [...source.matchAll(/<canvas\b[^>]*>/g)]
    .map((match) => match[0])
    .filter((element) => /\bonPointer(?:Down|Move|Up|Cancel)\s*=/.test(element));
}

function HasFullSizeInputRule(css, className) {
  const escapedClassName = EscapeRegExp(className);
  return [...css.matchAll(new RegExp(`[^{}]*\\.${escapedClassName}\\b[^{}]*\\{([^{}]*)\\}`, 'g'))]
    .some(([, declarations]) => {
      const hasPosition = /\bposition\s*:\s*(?:absolute|fixed)\b/.test(declarations);
      const hasSize = /\binset\s*:\s*0\b|\b(?:width|height)\s*:\s*100(?:vw|vh|dvh|%)\b/.test(declarations);
      const acceptsPointer = !/\bpointer-events\s*:\s*none\b/.test(declarations);
      return hasPosition && hasSize && acceptsPointer;
    });
}

function EscapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
