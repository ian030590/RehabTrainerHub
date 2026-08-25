#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const dictionaryPairs = [
  ...['motor', 'vision', 'brain', 'mouth'].map((runtime) => ({
    label: `${runtime} runtime`,
    zh: `apps/rehabtrainerhub/training-runtimes/${runtime}/src/i18n/zh.ts`,
    en: `apps/rehabtrainerhub/training-runtimes/${runtime}/src/i18n/en.ts`,
  })),
  {
    label: 'Hub',
    zh: 'apps/rehabtrainerhub/app/i18n/zh-TW.ts',
    en: 'apps/rehabtrainerhub/app/i18n/en.ts',
  },
  ...['peripheralAttention', 'devicePerformanceNotice', 'installApp'].map((name) => ({
    label: `shared ${name}`,
    zh: `packages/ui/src/i18n/${name}/zh.ts`,
    en: `packages/ui/src/i18n/${name}/en.ts`,
  })),
];

for (const pair of dictionaryPairs) {
  const zhPath = resolve(repoRoot, pair.zh);
  const enPath = resolve(repoRoot, pair.en);
  assert.ok(existsSync(zhPath), `${pair.label}: missing zh dictionary ${pair.zh}`);
  assert.ok(existsSync(enPath), `${pair.label}: missing en dictionary ${pair.en}`);

  const zhKeys = CollectObjectKeys(readFileSync(zhPath, 'utf8'), pair.zh);
  const enKeys = CollectObjectKeys(readFileSync(enPath, 'utf8'), pair.en);
  const missingInEn = [...zhKeys].filter((key) => !enKeys.has(key));
  const missingInZh = [...enKeys].filter((key) => !zhKeys.has(key));
  assert.deepEqual(
    missingInEn,
    [],
    `${pair.label}: keys missing in en: ${missingInEn.join(', ')}`,
  );
  assert.deepEqual(
    missingInZh,
    [],
    `${pair.label}: keys missing in zh: ${missingInZh.join(', ')}`,
  );
}

console.log(`i18n dictionary parity passed for ${dictionaryPairs.length} dictionary pairs.`);

function CollectObjectKeys(source, fileName) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const keys = new Set();

  function Visit(node, prefix = '') {
    if (ts.isObjectLiteralExpression(node)) {
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const name = GetPropertyName(property.name);
        if (!name) continue;
        const key = prefix ? `${prefix}.${name}` : name;
        if (ts.isObjectLiteralExpression(property.initializer)) {
          Visit(property.initializer, key);
        } else {
          keys.add(key);
        }
      }
      return;
    }
    ts.forEachChild(node, (child) => Visit(child, prefix));
  }

  Visit(sourceFile);
  return keys;
}

function GetPropertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  if (ts.isComputedPropertyName(name) && ts.isStringLiteral(name.expression)) {
    return name.expression.text;
  }
  return null;
}
