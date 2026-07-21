#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import ts from 'typescript';

const repoRoot = resolve(import.meta.dirname, '..');
const ignoredDirectories = new Set(['.git', '.next', '.tmp', 'coverage', 'dist', 'node_modules', 'out', 'public']);
const sourceExtensions = new Set(['.js', '.mjs', '.ts', '.tsx']);
const frameworkFunctionNames = new Set([
  'generateMetadata',
  'generateSitemaps',
  'generateStaticParams',
  'generateViewport',
  'middleware',
]);
const failures = [];

for (const fileName of CollectSourceFiles(repoRoot)) {
  CheckSourceFile(fileName);
}

if (failures.length > 0) {
  throw new Error(`Identifier naming check failed:\n${failures.map((failure) => `  - ${failure}`).join('\n')}`);
}

console.log('Identifier naming check passed.');

function CollectSourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) continue;
    const fileName = resolve(directory, entry);
    const stats = statSync(fileName);
    if (stats.isDirectory()) {
      files.push(...CollectSourceFiles(fileName));
    } else if (sourceExtensions.has(extname(fileName)) && !fileName.endsWith('.d.ts')) {
      files.push(fileName);
    }
  }
  return files;
}

function CheckSourceFile(fileName) {
  const source = readFileSync(fileName, 'utf8');
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, GetScriptKind(fileName));
  const CheckNode = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const isFunctionValue = Boolean(node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)));
      if (!IsCamelCase(node.name.text) && !(isFunctionValue && IsPascalCase(node.name.text)) && !IsLazyComponent(node)) {
        AddFailure(sourceFile, node.name, 'variables must use camelCase');
      }
    }
    if (ts.isParameter(node) && ts.isIdentifier(node.name) && !IsCamelCase(node.name.text) && !node.name.text.startsWith('_')) {
      AddFailure(sourceFile, node.name, 'parameters must use camelCase');
    }
    if (ts.isFunctionDeclaration(node) && node.name && !IsAllowedFunctionName(node.name.text)) {
      AddFailure(sourceFile, node.name, 'named functions must use PascalCase');
    }
    if ((ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node))
      && node.name && !IsPascalCase(node.name.text)) {
      AddFailure(sourceFile, node.name, 'classes and types must use PascalCase');
    }
    ts.forEachChild(node, CheckNode);
  };

  CheckNode(sourceFile);
}

function GetScriptKind(fileName) {
  if (fileName.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (fileName.endsWith('.ts')) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

function IsCamelCase(name) {
  return /^[a-z][A-Za-z0-9]*$/.test(name) || /^__.*__$/.test(name);
}

function IsPascalCase(name) {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}

function IsAllowedFunctionName(name) {
  return IsPascalCase(name)
    || name.startsWith('onRequest')
    || name.startsWith('use')
    || frameworkFunctionNames.has(name);
}

function IsLazyComponent(node) {
  if (!IsPascalCase(node.name.text) || !ts.isCallExpression(node.initializer)) return false;
  return ts.isIdentifier(node.initializer.expression) && node.initializer.expression.text === 'lazy';
}

function AddFailure(sourceFile, node, message) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  failures.push(`${relative(repoRoot, sourceFile.fileName)}:${position.line + 1}:${position.character + 1} ${message} (${node.getText(sourceFile)})`);
}
