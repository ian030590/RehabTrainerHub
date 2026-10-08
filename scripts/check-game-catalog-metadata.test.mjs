import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const gameRoot = new URL('../apps/rehabtrainerhub/games/drawing-defense/', import.meta.url);

test('drawing-defense owns its upper-limb tags, localized copy and original preview', async () => {
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
