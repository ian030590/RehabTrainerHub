import { globSync, existsSync, readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import ts from 'typescript';

// Repository-relative files that one workflow's verification matrix runs: the files and globs that
// `node --test` receives (or the script a plain `node` command starts) in the npm scripts the matrix names,
// following nested `npm run`, plus every relative module those files import. A command shape this does not
// read leaves its files out, so a suite it misses fails the coverage check instead of passing unseen.
export function FindCiTestFiles(root, workflowPath) {
  const scripts = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).scripts ?? {};
  const entries = new Set();
  const expanded = new Set();

  function ExpandScript(name) {
    if (expanded.has(name)) return;
    expanded.add(name);
    if (!Object.hasOwn(scripts, name)) throw new Error(`${workflowPath} runs a missing npm script: ${name}`);
    for (const command of scripts[name].split('&&').map(part => part.trim())) {
      const nested = command.match(/^npm run ([\w:-]+)$/);
      if (nested) {
        ExpandScript(nested[1]);
        continue;
      }
      const node = command.match(/^node\s+(.+)$/);
      if (!node) continue;
      const tokens = node[1].split(/\s+/).map(token => token.replace(/^"|"$/g, ''));
      // Node options (and their values, such as `--test-reporter spec`) come before the first file or glob;
      // anything after a plain script belongs to that script.
      const firstPath = tokens.findIndex(token => !token.startsWith('-') && (/\.[cm]?js$/.test(token) || token.includes('*')));
      if (firstPath < 0) continue;
      const paths = tokens.slice(firstPath);
      const runsTests = tokens.slice(0, firstPath).includes('--test');
      for (const path of runsTests ? paths.filter(token => !token.startsWith('-')) : paths.slice(0, 1)) {
        if (!/\.m?js$/.test(path)) continue;
        for (const match of path.includes('*') ? globSync(path, { cwd: root }) : [path]) entries.add(match);
      }
    }
  }

  const workflow = readFileSync(resolve(root, workflowPath), 'utf8');
  for (const [, name] of workflow.matchAll(/^[ \t]*command: npm run ([\w:-]+)[ \t]*$/gm)) ExpandScript(name);

  const reached = new Set();
  function Visit(path) {
    if (reached.has(path) || !existsSync(resolve(root, path))) return;
    reached.add(path);
    // Parsed imports only: text that looks like an import in a comment, string or regular expression is not one.
    const tree = ts.createSourceFile(path, readFileSync(resolve(root, path), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const specifiers = [];
    function Walk(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) specifiers.push(node.moduleSpecifier);
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) specifiers.push(node.arguments[0]);
      ts.forEachChild(node, Walk);
    }
    Walk(tree);
    for (const specifier of specifiers) {
      if (!specifier || !ts.isStringLiteralLike(specifier)) continue;
      const fileName = specifier.text;
      if (/^\.{1,2}\//.test(fileName) && /\.m?js$/.test(fileName)) Visit(posix.normalize(posix.join(posix.dirname(path), fileName)));
    }
  }
  for (const entry of entries) Visit(posix.normalize(entry.replaceAll('\\', '/')));
  return reached;
}
