import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { strToU8, zipSync } from 'fflate';
import { platformRuntimeContract } from '../../../usergamerunner/functions/_lib/runtime.js';
import {
  GamePackageError,
  InspectGamePackage,
  NormalizeGameCapabilities,
  NormalizeGameSlug,
  NormalizeGameVersion,
  NormalizePackagePath,
  gamePackageRuntimeContract,
} from './gamePackages.js';

const validHtml = `<!doctype html>
<meta charset="utf-8">
<link rel="stylesheet" href="/runtime/jspsych-8.2.3.css">
<script src="/runtime/jspsych-8.2.3.js"></script>
<main id="jspsych-target"></main>
<script type="module">
  import { RunTrainerHubJsPsychGame } from '/runtime/trainerhub-game-sdk-0.1.0.js';
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
    gameSdkVersion: platformRuntimeContract.gameSdkVersion,
    gameSdkUrl: platformRuntimeContract.gameSdkUrl,
  });
});

test('accepts the complete platform-runtime sample package', async () => {
  const sample = await readFile(
    new URL('../../../../packages/game-sdk/examples/minimal-game.html', import.meta.url),
  );
  const result = await InspectGamePackage(FakeFile('minimal-game.html', 'text/html', sample));
  assert.equal(result.blockCount, 0);
  assert.deepEqual(result.files.map((file) => file.path), ['index.html']);
});

test('requires fixed runner runtime URLs and rejects bundled platform vendors', async () => {
  const wrongRuntime = validHtml
    .replace('/runtime/jspsych-8.2.3.js', './vendor/jspsych.js')
    .replace('/runtime/trainerhub-game-sdk-0.1.0.js', 'https://cdn.invalid/game-sdk.js');
  const wrongResult = await InspectGamePackage(
    FakeFile('index.html', 'text/html', strToU8(wrongRuntime)),
  );
  assert.ok(wrongResult.findings.some(
    (finding) => finding.code === 'missing-platform-jspsych-runtime',
  ));
  assert.ok(wrongResult.findings.some(
    (finding) => finding.code === 'missing-platform-sdk-runtime',
  ));
  assert.ok(wrongResult.findings.some((finding) => finding.code === 'external-url'));

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
  });
  const bundledResult = await InspectGamePackage(
    FakeFile('game.zip', 'application/zip', bundled),
  );
  assert.ok(bundledResult.findings.some(
    (finding) => finding.code === 'bundled-platform-runtime'
      && finding.filePath === 'vendor/jspsych.js',
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
  const result = await InspectGamePackage(FakeFile('game.zip', 'application/zip', zipSync({
    'index.html': strToU8(validHtml),
    'settings.json': strToU8(validSettings),
  })), 'safe-game');
  assert.equal(result.settings.gameId, 'safe-game');

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

test('comments cannot spoof jsPsych/SDK use and computed globals are blocked', async () => {
  const bypass = `<!doctype html><script>
    // initJsPsych(
    // await RunTrainerHubJsPsychGame(
    globalThis[['loc', 'ation'].join('')] = ['ht', 'tps:', '//example.invalid/collect'].join('');
  </script>`;
  const result = await InspectGamePackage(FakeFile('bypass.html', 'text/html', strToU8(bypass)));
  assert.ok(result.findings.some((finding) => finding.code === 'missing-jspsych'));
  assert.ok(result.findings.some((finding) => finding.code === 'missing-platform-bridge'));
  assert.ok(result.findings.some((finding) => finding.code === 'missing-platform-jspsych-runtime'));
  assert.ok(result.findings.some((finding) => finding.code === 'missing-platform-sdk-runtime'));
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
