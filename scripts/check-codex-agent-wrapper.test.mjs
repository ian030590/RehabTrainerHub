import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const wrapper = '.claude/scripts/codex-agent.sh';

function Run(args, input = 'Review the movement mechanic.', env = {}, cwd = root) {
  const result = spawnSync('bash', [wrapper, ...args], {
    cwd,
    input,
    encoding: 'utf8',
    timeout: 30000,
    env: { ...process.env, CCGS_CODEX_WORKER: '', ...env },
  });
  assert.ifError(result.error);
  return result;
}

function CreateFixture(tempDir) {
  for (const dir of ['.claude/scripts', '.claude/agents', '.claude/hooks']) {
    mkdirSync(path.join(tempDir, dir), { recursive: true });
  }
  copyFileSync(path.join(root, wrapper), path.join(tempDir, wrapper));
  copyFileSync(path.join(root, '.claude/scripts/write-guard.sh'), path.join(tempDir, '.claude/scripts/write-guard.sh'));
  writeFileSync(path.join(tempDir, '.claude/agents/gameplay-programmer.md'), '---\ntools: Read, Write, Edit\n---\n');
}

test('dry run composes a complete role brief and defaults to read-only', () => {
  const result = Run(['gameplay-programmer', '--dry-run']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /agent file: \.claude\/agents\/gameplay-programmer\.md/);
  assert.match(result.stdout, /sandbox: read-only/);
  assert.match(result.stdout, /AGENTS\.md/);
  assert.match(result.stdout, /## Task\nReview the movement mechanic\./);
  assert.match(result.stdout, /Sandbox: read-only - do not try to write files\./);
  const writable = Run(['gameplay-programmer', '--sandbox', 'workspace-write', '--dry-run']);
  assert.equal(writable.status, 0, writable.stderr);
  assert.match(writable.stdout, /sandbox: workspace-write/);
});

test('invalid arguments and empty briefs exit 2', () => {
  for (const args of [
    ['gameplay-programmer', '--sandbox', 'unsafe', '--dry-run'],
    ['unknown-agent', '--dry-run'],
    ['../x', '--dry-run'],
    ['gameplay-programmer', '--unknown'],
    ['gameplay-programmer', '--sandbox'],
    ['gameplay-programmer', '--task-file'],
    [],
  ]) {
    const result = Run(args);
    assert.equal(result.status, 2, result.stderr);
  }
  assert.equal(Run(['gameplay-programmer', '--dry-run'], ' \n\t').status, 2);
});

test('workers cannot start another worker', () => {
  const result = Run(['gameplay-programmer', '--dry-run'], undefined, { CCGS_CODEX_WORKER: '1' });
  assert.equal(result.status, 3);
  assert.match(result.stderr, /a Codex worker cannot start another agent/);
});

test('task files and stdin produce identical prompts', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'codex-agent-'));
  try {
    const briefPath = path.join(tempDir, 'brief.md');
    writeFileSync(briefPath, 'Review the movement mechanic.\n');
    const fileResult = Run(['gameplay-programmer', '--dry-run', '--task-file', briefPath], '');
    const stdinResult = Run(['gameplay-programmer', '--dry-run'], 'Review the movement mechanic.\n');
    assert.equal(fileResult.status, 0, fileResult.stderr);
    assert.equal(fileResult.stdout, stdinResult.stdout);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('fake worker receives argv, prompt and nested guard; its exit status is preserved', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'codex-agent-'));
  try {
    CreateFixture(tempDir);
    const workerPath = path.join(tempDir, 'worker.cjs');
    const recordPath = path.join(tempDir, 'record.json');
    writeFileSync(workerPath, [
      "const fs = require('node:fs');",
      "fs.writeFileSync(process.env.RECORD_PATH, JSON.stringify({ argv: process.argv.slice(2), prompt: fs.readFileSync(0, 'utf8'), nested: process.env.CCGS_CODEX_WORKER }));",
      "process.stdout.write('fake worker output\\n');",
      'process.exit(Number(process.env.FAKE_EXIT || 0));',
    ].join('\n'));
    const env = { CODEX_WORKER: workerPath, RECORD_PATH: recordPath, FAKE_EXIT: '7' };
    const result = Run(['gameplay-programmer'], 'Review only.', env, tempDir);
    assert.equal(result.status, 7, result.stderr);
    assert.match(result.stdout, /fake worker output/);
    const record = JSON.parse(readFileSync(recordPath, 'utf8'));
    assert.equal(path.resolve(record.argv[1]), path.resolve(tempDir));
    assert.deepEqual([record.argv[0], ...record.argv.slice(2)], ['--cwd', '--sandbox', 'read-only']);
    assert.match(record.prompt, /## Task\nReview only\./);
    assert.equal(record.nested, '1');

    const missingPath = 'production/session-state/codex-briefs/missing-artifact-test.md';
    const missing = Run(['gameplay-programmer'], `Write your full output to \`${missingPath}\``, { ...env, FAKE_EXIT: '0' }, tempDir);
    assert.equal(missing.status, 4, missing.stderr);
    assert.match(missing.stderr, /file its return contract named is not on disk/);
    assert.match(missing.stderr, /rerun the worker with the previous result/);
    const failed = Run(['gameplay-programmer'], `Write your full output to \`${missingPath}\``, env, tempDir);
    assert.equal(failed.status, 7, failed.stderr);
    writeFileSync(path.join(tempDir, 'present.md'), 'report');
    const firstConcrete = Run(['gameplay-programmer'],
      `Write your full output to \`[path]\`. Write your full output to \`<path>\`. Write your full output to \`{path}\`. Write your full output to \`present.md\`. Write your full output to \`${missingPath}\`.`,
      { ...env, FAKE_EXIT: '0' }, tempDir);
    assert.equal(firstConcrete.status, 0, firstConcrete.stderr);

    const absentWorker = { CODEX_WORKER: path.join(tempDir, 'absent-worker.cjs') };
    assert.equal(Run(['gameplay-programmer'], 'Review only.', absentWorker, tempDir).status, 2);
    const absentDryRun = Run(['gameplay-programmer', '--dry-run'], 'Review only.', absentWorker, tempDir);
    assert.equal(absentDryRun.status, 0, absentDryRun.stderr);
    assert.match(absentDryRun.stdout, /worker: .*\(missing\)/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('workspace writes produce guard observations and audit records without changing worker status', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'codex-agent-'));
  try {
    CreateFixture(tempDir);
    const init = spawnSync('git', ['init', '--quiet', tempDir], { encoding: 'utf8' });
    assert.equal(init.status, 0, init.stderr);
    mkdirSync(path.join(tempDir, 'production'));
    const existingPath = path.join(tempDir, 'production/existing.md');
    writeFileSync(existingPath, 'original\n');
    const stage = spawnSync('git', ['add', 'production/existing.md'], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(stage.status, 0, stage.stderr);
    writeFileSync(path.join(tempDir, 'production/remove-me.md'), 'remove this file');
    writeFileSync(path.join(tempDir, '.claude/hooks/yaml-helper.sh'), 'session_state_enabled() { return 0; }\n');
    const workerPath = path.join(tempDir, 'fake.cjs');
    writeFileSync(workerPath, [
      "const fs = require('node:fs');",
      "fs.mkdirSync('production', { recursive: true });",
      "fs.writeFileSync('production/new artifact.md', 'report');",
      "fs.writeFileSync('production/existing.md', 'changed');",
      "fs.unlinkSync('production/remove-me.md');",
    ].join('\n'));
    const result = Run(['gameplay-programmer', '--sandbox', 'workspace-write'],
      'Update production/existing.md and remove production/remove-me.md. Write your full output to `production/new artifact.md`', { CODEX_WORKER: workerPath }, tempDir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /codex-agent: write-guard: checked\tproduction\/new artifact\.md/);
    assert.match(result.stderr, /AGENT_WRITE\tproduction\/existing\.md\tgameplay-programmer\texisting-file/);
    assert.match(result.stderr, /AGENT_WRITE\tproduction\/remove-me\.md\tgameplay-programmer\texisting-file/);
    const audit = readFileSync(path.join(tempDir, 'production/session-logs/agent-audit.log'), 'utf8');
    assert.match(audit, /\d{8}_\d{6} \| codex \| Agent invoked: gameplay-programmer \(sandbox workspace-write\)/);
    assert.match(audit, /\| codex \| Agent completed: gameplay-programmer \(exit 0\)/);
    writeFileSync(path.join(tempDir, '.claude/agents/gameplay-programmer.md'), '---\ntools: Read, Grep\n---\n');
    const noWriteTools = Run(['gameplay-programmer', '--sandbox', 'workspace-write', '--dry-run'], 'Review only.', {}, tempDir);
    assert.equal(noWriteTools.status, 2, noWriteTools.stderr);
    assert.match(noWriteTools.stderr, /has no Write\/Edit tools/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
