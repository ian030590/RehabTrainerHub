import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { FindCiTestFiles } from './ci-test-files.mjs';

const root = resolve(import.meta.dirname, '..');
const idPattern = 'AG-[A-Z]+-\\d{2}';
const read = file => readFileSync(resolve(root, file), 'utf8');

function RuleIds(source) {
  const lines = source.replace(/\r?\n$/, '').split(/\r?\n/);
  assert.ok(lines.length < 250, 'AGENTS.md must stay under 250 lines');
  const ids = [];
  let inCommandBlock = false;
  for (const [index, line] of lines.entries()) {
    assert.ok([...line].length <= 180, `AGENTS.md:${index + 1} exceeds 180 characters`);
    if (/^```/.test(line)) inCommandBlock = !inCommandBlock;
    if (inCommandBlock) continue;
    const markers = [...line.matchAll(/\[(AG-[^\]]*)\]/g)];
    if (/^\s*[-*+]\s+/.test(line) || markers.length) {
      const bullet = line.match(new RegExp(`^- \\[(${idPattern})\\] \\S`));
      assert.ok(bullet && markers.length === 1, `AGENTS.md:${index + 1} must start each rule bullet with one [AG-…] id`);
      ids.push(bullet[1]);
    }
  }
  assert.equal(new Set(ids).size, ids.length, 'duplicate rule id in AGENTS.md');
  assert.ok(ids.length, 'AGENTS.md has no rules');
  return ids.sort();
}

function ReadTestTitles(source) {
  const tree = ts.createSourceFile('test.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const titles = new Set();
  function Visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'test'
      && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) titles.add(node.arguments[0].text);
    ts.forEachChild(node, Visit);
  }
  Visit(tree);
  return titles;
}

function CheckLocalCommand(command, scripts, isFile) {
  for (const part of command.split(' && ')) {
    const npm = part.match(/^npm run ([\w:-]+)(?: -- .+)?$/);
    const node = part.match(/^node (?:--test |--check )?([\w./-]+\.[cm]?[jt]sx?)(?: .+)?$/);
    assert.ok(npm ? Object.hasOwn(scripts, npm[1]) : node && isFile(node[1]), `missing local entry point: ${part}`);
  }
}

function CheckRegistry(ids, rules, { scripts, reached, testTitles, isFile }) {
  assert.ok(Array.isArray(rules), 'registry must be an array');
  const registryIds = rules.map(rule => rule.id);
  assert.equal(new Set(registryIds).size, registryIds.length, 'duplicate rule id in registry');
  assert.deepEqual(registryIds.sort(), ids, 'AGENTS.md and the registry must declare the same rule ids');
  for (const rule of rules) {
    const { id, summary, enforcement, tests, command, reason } = rule;
    assert.ok(typeof summary === 'string' && summary.trim(), `${id}: missing summary`);
    assert.ok(['ci', 'local', 'process'].includes(enforcement), `${id}: invalid enforcement`);
    if (enforcement === 'ci') {
      assert.ok(Array.isArray(tests) && tests.length, `${id}: missing tests`);
      for (const { file, name } of tests) {
        assert.ok(isFile(file), `${id}: missing test file ${file}`);
        assert.ok(reached.has(file), `${id}: ${file} does not run from test:ci`);
        assert.ok(testTitles(file).has(name), `${id}: ${file} has no test titled ${JSON.stringify(name)}`);
      }
    } else {
      assert.ok(typeof reason === 'string' && reason.trim() && !/[\r\n]/.test(reason), `${id}: missing one-line reason`);
      if (enforcement === 'local') {
        assert.ok(typeof command === 'string' && command.trim(), `${id}: missing local command`);
        CheckLocalCommand(command, scripts, isFile);
      }
    }
  }
}

function CheckClaudeImport(source) {
  assert.match(source, /^@AGENTS\.md\r?\n(?![\s\S])/, 'CLAUDE.md must be exactly the one-line AGENTS.md import');
}

test('AGENTS.md is short and every rule has exactly one matching registry entry', () => {
  assert.throws(() => RuleIds('- A rule without an id'), /must start/);
  assert.throws(() => RuleIds('- [AG-CI-01] First\n- [AG-CI-01] Duplicate'), /duplicate/);
  assert.throws(() => RuleIds(`- [AG-CI-01] ${'a'.repeat(181)}`), /exceeds 180/);
  assert.throws(() => RuleIds(`- [AG-CI-01] First\n${'text\n'.repeat(249)}`), /under 250/);
  assert.throws(() => RuleIds(`- [AG-CI-01] First\n${'\n'.repeat(249)}`), /under 250/);
  const rules = JSON.parse(read('scripts/repo-rules.json'));
  assert.deepEqual(rules.map(rule => rule.id).sort(), RuleIds(read('AGENTS.md')));
});

test('every repository rule points to live CI evidence or documents local and process enforcement', () => {
  const file = 'scripts/check-fixture.test.mjs';
  const ci = { id: 'AG-CI-01', summary: 'Fixture', enforcement: 'ci', tests: [{ file, name: 'a real test' }] };
  const local = { id: 'AG-CI-02', summary: 'Fixture', enforcement: 'local', command: 'npm run test:local', reason: 'Needs a browser.' };
  const process = { id: 'AG-CI-03', summary: 'Fixture', enforcement: 'process', reason: 'Needs approval.' };
  const fixture = {
    scripts: { 'test:local': 'node scripts/local.mjs' },
    reached: new Set([file]),
    isFile: path => path === file,
    testTitles: () => ReadTestTitles("// test('fake');\nconst text = \"test('decoy')\";\ntest('a real test', () => {});"),
  };
  assert.throws(() => CheckRegistry([ci.id], [ci, ci], fixture), /duplicate/);
  assert.throws(() => CheckRegistry([], [ci], fixture), /same rule ids/);
  assert.throws(() => CheckRegistry([ci.id], [ci], { ...fixture, isFile: () => false }), /missing test file/);
  assert.throws(() => CheckRegistry([ci.id], [ci], { ...fixture, reached: new Set() }), /does not run from test:ci/);
  for (const name of ['fake', 'decoy']) {
    assert.throws(() => CheckRegistry([ci.id], [{ ...ci, tests: [{ file, name }] }], fixture), /has no test titled/);
  }
  assert.throws(() => CheckRegistry([local.id], [{ ...local, command: 'node scripts/missing.mjs' }], fixture), /missing local entry point/);
  assert.throws(() => CheckRegistry([local.id], [{ ...local, command: 'npm run test:missing' }], fixture), /missing local entry point/);
  assert.throws(() => CheckRegistry([process.id], [{ ...process, reason: '' }], fixture), /missing one-line reason/);
  CheckRegistry([ci.id, local.id, process.id], [ci, local, process], fixture);

  const titles = new Map();
  CheckRegistry(RuleIds(read('AGENTS.md')), JSON.parse(read('scripts/repo-rules.json')), {
    scripts: JSON.parse(read('package.json')).scripts,
    reached: FindCiTestFiles(root),
    isFile: file => typeof file === 'string' && /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[\w./-]+$/.test(file)
      && existsSync(resolve(root, file)) && statSync(resolve(root, file)).isFile(),
    testTitles: file => {
      if (!titles.has(file)) titles.set(file, ReadTestTitles(read(file)));
      return titles.get(file);
    },
  });
});

test('CLAUDE.md only imports the authoritative AGENTS.md', () => {
  assert.throws(() => CheckClaudeImport('@AGENTS.md\n\nExtra instructions\n'), /one-line/);
  CheckClaudeImport(read('CLAUDE.md'));
});
