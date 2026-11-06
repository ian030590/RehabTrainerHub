import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { platformRuntimeContract } from '../../../usergamerunner/functions/_lib/runtime.js';
import {
  GamePackageError,
  InspectGamePackage,
  NormalizeGameCapabilities,
  NormalizeGameSlug,
  NormalizeGameVersion,
  NormalizePackagePath,
  gamePackageLimits,
  gamePackageRuntimeContract,
} from './gamePackages.js';

const validHtml = `<!doctype html>
<meta charset="utf-8">
<link rel="stylesheet" href="/runtime/jspsych-8.2.3.css">
<script src="/runtime/jspsych-8.2.3.js"></script>
<main id="jspsych-target"></main>
<script type="module">
  import { RunTrainerHubJsPsychGame } from '/runtime/trainerhub-game-bridge-1.0.0.js';
  async function startGame() {
    await RunTrainerHubJsPsychGame({
      initJsPsych: jsPsychModule.initJsPsych,
      timeline: [{}],
      summarize() { return { status: 'completed' }; },
    });
  }
  void startGame();
</script>`;

test('accepts a readable jsPsych HTML package', async () => {
  const result = await InspectGamePackage(FakeFile('game.html', 'text/html', strToU8(validHtml)));
  assert.equal(result.artifactType, 'html');
  assert.equal(result.blockCount, 0);
  assert.equal(result.entryPath, 'index.html');
  assert.equal(result.files.length, 1);
  assert.match(result.contentSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.findings.some((finding) => finding.code === 'external-url'), false);
});

test('scanner and runner publish one exact platform runtime contract', () => {
  assert.deepEqual(gamePackageRuntimeContract, {
    jsPsychVersion: platformRuntimeContract.jsPsychVersion,
    jsPsychUrl: platformRuntimeContract.jsPsychUrl,
    jsPsychCssUrl: platformRuntimeContract.jsPsychCssUrl,
    gameBridgeUrl: platformRuntimeContract.gameBridgeUrl,
  });
});

test('accepts the complete platform-runtime sample package', async () => {
  const sample = await readFile(
    new URL('../../../usergamerunner/tests/fixtures/minimal-game.html', import.meta.url),
  );
  const result = await InspectGamePackage(FakeFile('minimal-game.html', 'text/html', sample));
  assert.equal(result.blockCount, 0);
  assert.deepEqual(result.files.map((file) => file.path), ['index.html']);
});

test('requires fixed runner runtime URLs and rejects bundled platform vendors', async () => {
  const wrongRuntime = validHtml
    .replace('/runtime/jspsych-8.2.3.js', './vendor/jspsych.js')
    .replace('/runtime/trainerhub-game-bridge-1.0.0.js', 'https://cdn.invalid/game-bridge.js');
  const wrongResult = await InspectGamePackage(
    FakeFile('index.html', 'text/html', strToU8(wrongRuntime)),
  );
  assert.ok(wrongResult.findings.some(
    (finding) => finding.code === 'missing-platform-jspsych-runtime',
  ));
  assert.ok(wrongResult.findings.some(
    (finding) => finding.code === 'missing-platform-bridge-runtime',
  ));
  assert.ok(wrongResult.findings.some((finding) => finding.code === 'external-url'));

  const legacyRuntime = validHtml.replace(
    '/runtime/trainerhub-game-bridge-1.0.0.js',
    '/runtime/trainerhub-game-sdk-0.1.0.js',
  );
  const legacyResult = await InspectGamePackage(
    FakeFile('index.html', 'text/html', strToU8(legacyRuntime)),
  );
  assert.ok(legacyResult.findings.some(
    (finding) => finding.code === 'missing-platform-bridge-runtime',
  ));

  const moduleJsPsych = validHtml.replace(
    '<script src="/runtime/jspsych-8.2.3.js">',
    '<script type="module" src="/runtime/jspsych-8.2.3.js">',
  );
  const moduleResult = await InspectGamePackage(
    FakeFile('index.html', 'text/html', strToU8(moduleJsPsych)),
  );
  assert.ok(moduleResult.findings.some(
    (finding) => finding.code === 'missing-platform-jspsych-runtime',
  ));

  const bundled = zipSync({
    'index.html': strToU8(validHtml),
    'vendor/jspsych.js': strToU8(`
      var jsPsychModule = (function (exports) { return exports; })({});
      var initJsPsych = jsPsychModule.initJsPsych;
    `),
    'vendor/trainerhub-game-bridge-1.0.0.js': strToU8('export const bundled = true;'),
  });
  const bundledResult = await InspectGamePackage(
    FakeFile('game.zip', 'application/zip', bundled),
  );
  assert.ok(bundledResult.findings.some(
    (finding) => finding.code === 'bundled-platform-runtime'
      && finding.filePath === 'vendor/jspsych.js',
  ));
  assert.ok(bundledResult.findings.some(
    (finding) => finding.code === 'bundled-platform-runtime'
      && finding.filePath === 'vendor/trainerhub-game-bridge-1.0.0.js',
  ));
});

test('blocks outbound APIs and credential access', async () => {
  const html = `${validHtml}<script>fetch('/steal'); document.cookie;</script>`;
  const result = await InspectGamePackage(FakeFile('index.html', 'text/html', strToU8(html)));
  assert.ok(result.findings.some((finding) => finding.code === 'network-fetch'));
  assert.ok(result.findings.some((finding) => finding.code === 'cookie-access'));
  assert.ok(result.blockCount >= 2);
});

test('blocks obvious standard and WebKit WebRTC constructors as upload triage', async () => {
  for (const constructorName of ['RTCPeerConnection', 'webkitRTCPeerConnection']) {
    const html = `${validHtml}<script>new ${constructorName}();</script>`;
    const result = await InspectGamePackage(FakeFile('index.html', 'text/html', strToU8(html)));
    assert.ok(result.findings.some((finding) => finding.code === 'network-webrtc'));
    assert.ok(result.blockCount >= 1);
  }
});

test('rejects ZIP traversal before extraction', async () => {
  const bytes = zipSync({
    'index.html': strToU8(validHtml),
    '../outside.js': strToU8('alert(1)'),
  });
  await assert.rejects(
    InspectGamePackage(FakeFile('game.zip', 'application/zip', bytes)),
    (error) => error instanceof GamePackageError && error.code === 'unsafe-path',
  );
});

test('accepts safe ZIP assets and records their digests', async () => {
  const bytes = zipSync({
    'index.html': strToU8(validHtml),
    'styles/game.css': strToU8('body { color: CanvasText; }'),
  });
  const result = await InspectGamePackage(FakeFile('game.zip', 'application/zip', bytes));
  assert.equal(result.blockCount, 0);
  assert.deepEqual(result.files.map((file) => file.path), ['index.html', 'styles/game.css']);
  assert.ok(result.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)));
});

test('rejects directory payloads that expand beyond the package budget', async (t) => {
  const bytes = zipSync({
    'index.html': strToU8(validHtml),
    'assets/': new Uint8Array(gamePackageLimits.maximumTotalBytes + 1).fill(65),
  });
  const decoded = unzipSync(bytes);
  assert.equal(decoded['assets/'].byteLength, gamePackageLimits.maximumTotalBytes + 1);
  t.diagnostic(`Unfiltered decoder expanded directory payload: ${decoded['assets/'].byteLength} bytes`);
  await assert.rejects(
    InspectGamePackage(FakeFile('game.zip', 'application/zip', bytes)),
    { name: 'GamePackageError', code: 'zip-directory-data' },
  );
});

test('rejects directory payloads before the ZIP decoder reads compressed data', async () => {
  const bytes = zipSync({
    'index.html': strToU8(validHtml),
    'assets/': strToU8('directory payload'),
  });
  const view = new DataView(bytes.buffer);
  const centralOffset = view.getUint32(bytes.length - 6, true);
  const directoryOffset = centralOffset + 46 + view.getUint16(centralOffset + 28, true);
  const localOffset = view.getUint32(directoryOffset + 42, true);
  const dataOffset = localOffset + 30 + view.getUint16(localOffset + 26, true)
    + view.getUint16(localOffset + 28, true);
  bytes[dataOffset] = 0x07;
  assert.throws(() => unzipSync(bytes), /invalid block type/);
  await assert.rejects(
    InspectGamePackage(FakeFile('game.zip', 'application/zip', bytes)),
    { name: 'GamePackageError', code: 'zip-directory-data' },
  );
});

test('rejects ZIP64 end records and locators', async (t) => {
  const original = zipSync({ 'index.html': strToU8(validHtml) });
  const eocdOffset = original.length - 22;
  const originalView = new DataView(original.buffer);
  const records = new Uint8Array(76);
  const recordsView = new DataView(records.buffer);
  recordsView.setUint32(0, 0x06064b50, true);
  recordsView.setBigUint64(4, 44n, true);
  recordsView.setUint16(12, 45, true);
  recordsView.setUint16(14, 45, true);
  recordsView.setBigUint64(24, 1n, true);
  recordsView.setBigUint64(32, 1n, true);
  recordsView.setBigUint64(40, BigInt(originalView.getUint32(eocdOffset + 12, true)), true);
  recordsView.setBigUint64(48, BigInt(originalView.getUint32(eocdOffset + 16, true)), true);
  recordsView.setUint32(56, 0x07064b50, true);
  recordsView.setBigUint64(64, BigInt(eocdOffset), true);
  recordsView.setUint32(72, 1, true);
  for (const [name, record] of [
    ['end record and locator', records],
    ['end record alone', records.subarray(0, 56)],
    ['locator alone', records.subarray(56)],
  ]) {
    await t.test(name, async () => {
      const bytes = new Uint8Array(original.length + record.length);
      bytes.set(original.subarray(0, eocdOffset));
      bytes.set(record, eocdOffset);
      bytes.set(original.subarray(eocdOffset), eocdOffset + record.length);
      await assert.rejects(
        InspectGamePackage(FakeFile('game.zip', 'application/zip', bytes)),
        { name: 'GamePackageError', code: 'zip64' },
      );
    });
  }
});

test('rejects ZIP64 extra fields in either local or central headers', async (t) => {
  for (const header of ['local', 'central']) {
    await t.test(header, async () => {
      const bytes = zipSync({
        'index.html': [strToU8(validHtml), { extra: { 2: new Uint8Array(16) } }],
      });
      const view = new DataView(bytes.buffer);
      const centralOffset = view.getUint32(bytes.length - 6, true);
      const extraOffset = header === 'local'
        ? 30 + view.getUint16(26, true)
        : centralOffset + 46 + view.getUint16(centralOffset + 28, true);
      view.setUint16(extraOffset, 1, true);
      await assert.rejects(
        InspectGamePackage(FakeFile('game.zip', 'application/zip', bytes)),
        { name: 'GamePackageError', code: 'zip64' },
      );
    });
  }
});

test('rejects ZIP64 sentinel values before expansion', async (t) => {
  const original = zipSync({ 'index.html': strToU8(validHtml) });
  const centralOffset = new DataView(original.buffer).getUint32(original.length - 6, true);
  for (const [name, offset, width] of [
    ['EOCD disk number', original.length - 18, 2],
    ['EOCD central disk', original.length - 16, 2],
    ['EOCD disk entry count', original.length - 14, 2],
    ['EOCD total entry count', original.length - 12, 2],
    ['EOCD central size', original.length - 10, 4],
    ['EOCD central offset', original.length - 6, 4],
    ['central compressed size', centralOffset + 20, 4],
    ['central original size', centralOffset + 24, 4],
    ['central starting disk', centralOffset + 34, 2],
    ['central local offset', centralOffset + 42, 4],
    ['local compressed size', 18, 4],
    ['local original size', 22, 4],
  ]) {
    await t.test(name, async () => {
      const bytes = original.slice();
      bytes.fill(0xff, offset, offset + width);
      await assert.rejects(
        InspectGamePackage(FakeFile('game.zip', 'application/zip', bytes)),
        { name: 'GamePackageError', code: 'zip64' },
      );
    });
  }
});

test('rejects stored ZIP entries whose decoded size differs from preflight', async () => {
  const bytes = zipSync({ 'index.html': strToU8(validHtml) }, { level: 0 });
  const view = new DataView(bytes.buffer);
  const centralOffset = view.getUint32(bytes.length - 6, true);
  view.setUint32(centralOffset + 24, 1, true);
  await assert.rejects(
    InspectGamePackage(FakeFile('game.zip', 'application/zip', bytes)),
    { name: 'GamePackageError', code: 'zip-entry' },
  );
});

test('accepts ordinary ZIP directories and extra fields without changing file bytes', async () => {
  const sourceFiles = {
    'index.html': strToU8(validHtml),
    'assets/game.css': strToU8('body { color: CanvasText; }'),
  };
  const bytes = zipSync({
    'index.html': [sourceFiles['index.html'], { extra: { 2: new Uint8Array(16) } }],
    'assets/': [new Uint8Array(0), { level: 0 }],
    'assets/game.css': sourceFiles['assets/game.css'],
  });
  const result = await InspectGamePackage(FakeFile('game.zip', 'application/zip', bytes));
  assert.equal(result.blockCount, 0);
  assert.equal(result.totalBytes, Object.values(sourceFiles).reduce((sum, value) => sum + value.length, 0));
  assert.deepEqual(Object.fromEntries(result.files.map(({ path, bytes: value }) => [path, value])), sourceFiles);
});

test('requires and validates root settings.json for a submitted game slug', async () => {
  const validSettings = JSON.stringify({
    schemaVersion: 1,
    gameId: 'safe-game',
    sections: [{
      id: 'training',
      title: { 'zh-TW': '活動設定', en: 'Session settings' },
      fields: [{
        key: 'rounds',
        type: 'slider',
        label: { 'zh-TW': '回合數', en: 'Rounds' },
        default: 5,
        min: 1,
        max: 10,
        step: 1,
      }],
    }],
  });
  const validScore = JSON.stringify({
    schema: 'rehab-trainer.game-score/v1', gameId: 'safe-game',
    presentation: { primarySummaryKeys: ['accuracy'], qualitySummaryKeys: [], defaultRoundMetricKey: 'correct', chartType: 'bar' },
    columns: [{ key: 'correct', label: { zh: '正確', en: 'Correct' }, sources: ['correct'] }],
    summary: [{ key: 'accuracy', label: { zh: '正確率', en: 'Accuracy' }, sources: ['accuracy'], unit: '%' }],
  });
  const result = await InspectGamePackage(FakeFile('game.zip', 'application/zip', zipSync({
    'index.html': strToU8('<!doctype html><meta charset="utf-8"><button id="go">Go</button><script>document.getElementById("go").onclick = () => {};</script>'),
    'settings.json': strToU8(validSettings),
    'score.json': strToU8(validScore),
  })), 'safe-game', true);
  assert.equal(result.settings.gameId, 'safe-game');
  assert.equal(result.score.gameId, 'safe-game');
  assert.equal(result.blockCount, 0);

  await assert.rejects(
    InspectGamePackage(FakeFile('game.zip', 'application/zip', zipSync({
      'index.html': strToU8(validHtml),
      'settings.json': strToU8(validSettings),
    })), 'safe-game', true),
    (error) => error instanceof GamePackageError && error.code === 'missing-score',
  );

  await assert.rejects(
    InspectGamePackage(FakeFile('game.zip', 'application/zip', zipSync({
      'index.html': strToU8(validHtml),
    })), 'safe-game'),
    (error) => error instanceof GamePackageError && error.code === 'missing-settings',
  );
});

test('normalizes identifiers, paths, and baseline capabilities', () => {
  assert.equal(NormalizeGameSlug('safe-game'), 'safe-game');
  assert.equal(NormalizeGameSlug('../unsafe'), null);
  assert.equal(NormalizePackagePath('assets/sound.ogg'), 'assets/sound.ogg');
  assert.equal(NormalizePackagePath('assets/../secret'), null);
  assert.deepEqual(
    NormalizeGameCapabilities('["pointer","audio","pointer"]'),
    ['audio', 'pointer'],
  );
  assert.equal(NormalizeGameCapabilities('["camera"]'), null);
});

test('requires full semantic versions and runner-safe ASCII paths', () => {
  assert.equal(NormalizeGameVersion('1.2.3'), '1.2.3');
  assert.equal(NormalizeGameVersion('1.2.3-beta.1'), '1.2.3-beta.1');
  assert.equal(NormalizeGameVersion('v1'), null);
  assert.equal(NormalizeGameVersion('01.2.3'), null);
  assert.equal(NormalizePackagePath('assets/sound-1.mp3'), 'assets/sound-1.mp3');
  assert.equal(NormalizePackagePath('assets/有空白.png'), null);
  assert.equal(NormalizePackagePath('asset%2fsecret.js'), null);
  assert.equal(NormalizePackagePath('entry.js?raw'), null);
});

test('comments cannot spoof jsPsych/bridge use and computed globals are blocked', async () => {
  const bypass = `<!doctype html><script>
    // initJsPsych(
    // await RunTrainerHubJsPsychGame(
    globalThis[['loc', 'ation'].join('')] = ['ht', 'tps:', '//example.invalid/collect'].join('');
  </script>`;
  const result = await InspectGamePackage(FakeFile('bypass.html', 'text/html', strToU8(bypass)));
  assert.ok(result.findings.some((finding) => finding.code === 'missing-jspsych'));
  assert.ok(result.findings.some((finding) => finding.code === 'missing-platform-bridge'));
  assert.ok(result.findings.some((finding) => finding.code === 'missing-platform-jspsych-runtime'));
  assert.ok(result.findings.some((finding) => finding.code === 'missing-platform-bridge-runtime'));
  assert.ok(result.findings.some((finding) => finding.code === 'computed-global-access'));
});

function FakeFile(name, type, bytes) {
  return {
    name,
    type,
    size: bytes.byteLength,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  };
}
