import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const files = process.argv.slice(2);

if (files.length === 0) {
  throw new Error('Usage: node scripts/check-vite-html-shell.mjs <dist/index.html> [...]');
}

const failures = [];
const protectedChunkPrefixes = ['index', 'TrainingPage', 'MotorTraining', 'ThinkingTraining', 'SpeechTraining'];
const forbiddenRuntimeChunkPrefixes = [
  'experiment-runtime',
  'pixi-runtime',
  'tensorflow-runtime',
  'three-runtime',
  'vosk',
];

for (const file of files) {
  const absolutePath = resolve(file);
  const distDir = dirname(absolutePath);
  const html = readFileSync(absolutePath, 'utf8');
  const tags = [];
  const markupErrors = CollectMarkupErrors(html);

  if (markupErrors.length > 0) {
    failures.push(`${file}: malformed HTML shell\n${markupErrors.map((error) => `  - ${error}`).join('\n')}`);
    continue;
  }

  for (const tag of html.matchAll(/<([a-zA-Z][\w:-]*)(?:\s[^>]*)?>/g)) {
    tags.push(tag[0]);
  }

  if (!/<div\s+id=["']root["']\s*><\/div>/.test(html)) {
    failures.push(`${file}: missing empty #root mount element`);
  }

  if (!tags.some((tag) => /^<script\b/i.test(tag) && /\btype=["']module["']/.test(tag) && /\bsrc=/.test(tag))) {
    failures.push(`${file}: missing production module script tag`);
  }

  if (!tags.some((tag) => /^<link\b/i.test(tag) && /\brel=["']stylesheet["']/.test(tag) && /\bhref=/.test(tag))) {
    failures.push(`${file}: missing production stylesheet link`);
  }

  CheckAssetReferences(file, distDir, tags, failures);
  CheckProtectedChunkImports(file, distDir, failures);
}

if (failures.length > 0) {
  throw new Error(`Vite HTML shell check failed:\n${failures.join('\n')}`);
}

console.log(`Vite HTML shell check passed for ${files.length} file${files.length === 1 ? '' : 's'}.`);

function CollectMarkupErrors(html) {
  const errors = [];

  for (let index = 0; index < html.length; index += 1) {
    if (html[index] !== '<') continue;
    const next = html[index + 1];
    if (!next || next === '!' || next === '/' || next === '?') continue;

    const start = index;
    let quote = '';

    for (index += 1; index < html.length; index += 1) {
      const char = html[index];

      if (quote) {
        if (char === quote) {
          quote = '';
        } else if (char === '<') {
          errors.push(`tag starting at ${FormatLocation(html, start)} contains "<" before closing ${quote} attribute quote`);
          break;
        }
        continue;
      }

      if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '>') {
        break;
      }
    }

    if (index >= html.length) {
      errors.push(`tag starting at ${FormatLocation(html, start)} is not closed`);
      break;
    }
  }

  return errors;
}

function FormatLocation(source, offset) {
  const before = source.slice(0, offset);
  const line = before.split('\n').length;
  const lastLineBreak = before.lastIndexOf('\n');
  const column = offset - lastLineBreak;
  return `line ${line}, column ${column}`;
}

function CheckAssetReferences(file, distDir, tags, failures) {
  for (const tag of tags) {
    const src = GetAttribute(tag, 'src');
    const href = GetAttribute(tag, 'href');
    const assetRef = src ?? href;
    const assetPath = ResolveAssetPath(distDir, assetRef);

    if (assetPath && !existsSync(assetPath)) {
      failures.push(`${file}: referenced asset is missing: ${assetRef}`);
    }

    if (IsRouteCriticalAssetTag(tag) && IsNestedRouteUnsafeAssetReference(assetRef)) {
      failures.push(
        `${file}: route-critical asset ${assetRef} is relative; use Vite base '/' so direct nested routes do not render a blank screen`,
      );
    }

    if (
      /^<link\b/i.test(tag) &&
      GetAttribute(tag, 'rel')?.toLowerCase() === 'modulepreload' &&
      IsForbiddenRuntimeAsset(assetRef)
    ) {
      failures.push(
        `${file}: root HTML modulepreloads ${assetRef}; trainer shell must not eagerly load heavy game runtimes`,
      );
    }
  }
}

function CheckProtectedChunkImports(file, distDir, failures) {
  const assetsDir = join(distDir, 'assets');

  if (!existsSync(assetsDir)) {
    return;
  }

  const protectedChunks = readdirSync(assetsDir)
    .filter((asset) => asset.endsWith('.js'))
    .filter((asset) => protectedChunkPrefixes.some((prefix) => IsChunkName(asset, prefix)));

  for (const chunk of protectedChunks) {
    const source = readFileSync(join(assetsDir, chunk), 'utf8');

    for (const importedAsset of CollectStaticJsImports(source)) {
      if (IsForbiddenRuntimeAsset(importedAsset)) {
        failures.push(
          `${file}: ${chunk} statically imports ${importedAsset}; protected trainer routes must lazy-load heavy game runtimes`,
        );
      }
    }
  }
}

function CollectStaticJsImports(source) {
  const imports = [];
  const importPattern = /(?:^|;)\s*import(?![.(])(?:(?!;).)*?["']([^"']+\.js)["']/gs;
  let match = importPattern.exec(source);

  while (match) {
    imports.push(match[1]);
    match = importPattern.exec(source);
  }

  return imports;
}

function GetAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match?.[2] ?? match?.[3] ?? match?.[4] ?? null;
}

function ResolveAssetPath(distDir, assetRef) {
  if (!assetRef || /^https?:\/\//i.test(assetRef) || assetRef.startsWith('//') || assetRef.startsWith('#')) {
    return null;
  }

  const cleanRef = assetRef.split(/[?#]/)[0];

  if (cleanRef.startsWith('/')) {
    return resolve(distDir, cleanRef.slice(1));
  }

  if (cleanRef.startsWith('./') || cleanRef.startsWith('assets/')) {
    return resolve(distDir, cleanRef);
  }

  return null;
}

function IsRouteCriticalAssetTag(tag) {
  if (/^<script\b/i.test(tag)) {
    return Boolean(GetAttribute(tag, 'src'));
  }

  if (!/^<link\b/i.test(tag)) {
    return false;
  }

  const rel = GetAttribute(tag, 'rel')?.toLowerCase();
  return rel === 'stylesheet' || rel === 'modulepreload' || rel === 'preload';
}

function IsNestedRouteUnsafeAssetReference(assetRef) {
  if (!assetRef || /^https?:\/\//i.test(assetRef) || assetRef.startsWith('//') || assetRef.startsWith('#')) {
    return false;
  }

  return !assetRef.startsWith('/');
}

function IsForbiddenRuntimeAsset(assetRef) {
  if (!assetRef) {
    return false;
  }

  const assetName = basename(assetRef.split(/[?#]/)[0]);
  return forbiddenRuntimeChunkPrefixes.some((prefix) => IsChunkName(assetName, prefix));
}

function IsChunkName(assetName, prefix) {
  return assetName === `${prefix}.js` || (assetName.startsWith(`${prefix}-`) && assetName.endsWith('.js'));
}
