import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';

const load = () => import('./game-preview-capture.mjs');

test('preview capture waits for gameplay and refuses a settings or tutorial overlay', async t => {
  const { CreateGameCapture } = await load();
  const folder = await mkdtemp(join(tmpdir(), 'game-preview-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  let screenshotCalls = 0;
  const capture = CreateGameCapture({ folder, preview: { output: join(folder, 'preview.webp'), gameId: 'test-game', version: '1.0.1', phase: 'playing' },
    send: async () => { screenshotCalls++; }, game: async () => false });
  await capture('settings');
  await capture('tutorial-board');
  assert.equal(screenshotCalls, 0, 'An overlay must never become the game preview.');
  await assert.rejects(capture('playing'), /gameplay/i);
  assert.deepEqual(await readdir(folder), []);
});

test('the preview is a 16:9 screenshot of the actual running game with source evidence', async t => {
  const { CreateGameCapture, PreviewCaptured } = await load();
  const folder = await mkdtemp(join(tmpdir(), 'game-preview-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const original = await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#176d39' } }).png().toBuffer();
  const calls = [];
  const capture = CreateGameCapture({ folder, preview: { output: join(folder, 'preview.webp'), gameId: 'test-game', version: '1.0.1', phase: 'playing' },
    game: async () => true, session: 'browser-session', send: async (...args) => { calls.push(args); return { data: original.toString('base64') }; } });
  await assert.rejects(capture('playing'), PreviewCaptured);
  assert.equal(calls.at(-1)[0], 'Page.captureScreenshot');
  assert.equal(calls.at(-1)[2], 'browser-session');
  const image = await readFile(join(folder, 'preview.webp'));
  const metadata = await sharp(image).metadata();
  assert.deepEqual([metadata.width, metadata.height], [640, 360]);
  const [r, g, b] = await sharp(image).removeAlpha().raw().toBuffer();
  assert.ok(g > r * 2 && g > b, 'The preview keeps the rendered scene pixels.');
  assert.deepEqual(await readFile(join(folder, 'playing.png')), original);
  const evidence = JSON.parse(await readFile(join(folder, 'preview.json'), 'utf8'));
  assert.equal(evidence.gameId, 'test-game');
  assert.equal(evidence.version, '1.0.1');
  assert.match(evidence.screenshotSha256, /^[a-f0-9]{64}$/);
  assert.match(evidence.previewSha256, /^[a-f0-9]{64}$/);
});

test('normal browser checks keep saving their screenshots without stopping the flow', async t => {
  const { CreateGameCapture } = await load();
  const folder = await mkdtemp(join(tmpdir(), 'game-preview-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const png = Buffer.from('normal screenshot');
  const capture = CreateGameCapture({ folder, send: async () => ({ data: png.toString('base64') }), session: 'normal' });
  await capture('settings');
  await capture('gameplay');
  assert.deepEqual(await readFile(join(folder, 'settings.png')), png);
  assert.deepEqual(await readFile(join(folder, 'gameplay.png')), png);
});

test('brief stimuli stay on screen while the preview screenshot is taken', async t => {
  const { CreateGameCapture, PreviewCaptured } = await load();
  const folder = await mkdtemp(join(tmpdir(), 'game-preview-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const png = await sharp({ create: { width: 1280, height: 720, channels: 3, background: 'white' } }).png().toBuffer();
  const calls = [];
  const capture = CreateGameCapture({ folder, session: 'page', frameSession: 'game-frame', game: async () => true,
    preview: { output: join(folder, 'preview.webp'), gameId: 'test-game', version: '1.0.1', phase: 'playing' },
    send: async (...args) => { calls.push(args); return { data: png.toString('base64') }; } });
  await assert.rejects(capture('playing'), PreviewCaptured);
  assert.deepEqual(calls[0], ['Emulation.setVirtualTimePolicy', { policy: 'pause' }, 'game-frame']);
  assert.equal(calls.at(-1)[0], 'Page.captureScreenshot');
  assert.equal(calls.at(-1)[2], 'page');
});
