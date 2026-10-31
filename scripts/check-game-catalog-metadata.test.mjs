import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import './game-preview-capture.test.mjs';

const gameRoot = new URL('../apps/rehabtrainerhub/games/drawing-defense/', import.meta.url);

test('every official Hub preview has a matching gameplay capture', async () => {
  const registry = JSON.parse(await readFile(new URL('../packages/ui/src/officialGameReleases.json', import.meta.url), 'utf8'));
  const captures = JSON.parse(await readFile(new URL('../docs/game-preview-captures.json', import.meta.url), 'utf8'));
  assert.deepEqual(captures.map(capture => capture.gameId).sort(), Object.keys(registry).sort());
  for (const capture of captures) {
    assert.match(capture.phase, /^(gameplay|playing|combat|go|answer)/, capture.gameId);
    assert.match(capture.screenshotSha256, /^[a-f0-9]{64}$/, capture.gameId);
    assert.equal(capture.screenshotWidth, 1280, capture.gameId);
    assert.equal(capture.screenshotHeight, 720, capture.gameId);
    const preview = await readFile(new URL(`../apps/rehabtrainerhub/games/${capture.gameId}/public/preview.webp`, import.meta.url));
    assert.equal(createHash('sha256').update(preview).digest('hex'), capture.previewSha256, capture.gameId);
    const metadata = await sharp(preview).metadata();
    assert.deepEqual([metadata.width, metadata.height], [640, 360], capture.gameId);
  }
});

test('drawing-defense owns its upper-limb tags, localized copy and gameplay preview', async () => {
  const metadata = JSON.parse(await readFile(new URL('public/game.json', gameRoot), 'utf8'));
  assert.equal(metadata.gameId, 'drawing-defense');
  assert.equal(metadata.trainer, 'motor');
  assert.equal(metadata.category, 'upper-limb');
  assert.equal(metadata.copy['zh-TW'].title, '畫畫塔防');
  const preview = await readFile(new URL(`public/${metadata.preview}`, gameRoot));
  assert.equal(preview.subarray(0, 4).toString(), 'RIFF');
  assert.equal(preview.subarray(8, 12).toString(), 'WEBP');
  const source = await readFile(new URL('catalog.ts', new URL('../', gameRoot)), 'utf8');
  assert.match(source, /drawingDefenseCatalog\.category/);
  assert.match(source, /drawingDefenseCatalog\.preview/);
});

test('game catalog metadata rejects incompatible tags and previews outside the release', async () => {
  const { ParseGameCatalogMetadata } = await import('../apps/rehabtrainerhub/games/gameCatalogMetadata.js');
  const value = { schemaVersion: 1, gameId: 'drawing-defense', trainer: 'motor', category: 'upper-limb',
    author: 'Studio', preview: 'preview.webp', copy: {
      'zh-TW': { title: '畫畫塔防', description: '上肢動作練習。' },
      en: { title: 'Drawing defense', description: 'Upper-limb practice.' },
    } };
  const paths = new Set(['preview.webp', 'index.html']);
  assert.deepEqual(ParseGameCatalogMetadata(value, 'drawing-defense', paths), value);
  for (const patch of [{ gameId: 'other-game' }, { category: 'higher-cognition' },
    { preview: 'https://example.com/preview.webp' }, { preview: '../preview.webp' },
    { preview: 'missing.webp' }, { preview: 'index.html' }, { copy: { en: value.copy.en } }]) {
    assert.throws(() => ParseGameCatalogMetadata({ ...value, ...patch }, 'drawing-defense', paths));
  }
});
