import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { onRequestGet } from './games.js';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function Fixture() {
  const metadata = { schemaVersion: 1, gameId: 'drawing-defense', trainer: 'motor', category: 'upper-limb',
    author: 'Game author', preview: 'preview.webp', copy: {
      'zh-TW': { title: '畫畫塔防', description: '上肢動作練習。' },
      en: { title: 'Drawing defense', description: 'Upper-limb practice.' },
    } };
  const bytes = Buffer.from(JSON.stringify(metadata));
  const manifest = { schemaVersion: 1, status: 'approved', gameId: 'drawing-defense', version: '2.0.3',
    name: 'Drawing defense', runtime: { name: 'native', major: 1 }, presentation: 'game', entry: 'index.html',
    contentSha256: 'a'.repeat(64), capabilities: ['pointer'], approvedAt: '2026-10-08T00:00:00Z',
    files: ['index.html', 'game.json', 'preview.webp'].map(path => ({ path, size: path === 'game.json' ? bytes.length : 1,
      sha256: path === 'game.json' ? sha256(bytes) : 'b'.repeat(64) })) };
  const objects = new Map([
    ['official-games/drawing-defense/current.json', Buffer.from(JSON.stringify({ schemaVersion: 1,
      gameId: 'drawing-defense', currentVersion: '2.0.3', releases: { '2.0.3': { contentSha256: manifest.contentSha256 } } }))],
    ['releases/drawing-defense/2.0.3/release.json', Buffer.from(JSON.stringify(manifest))],
    ['releases/drawing-defense/2.0.3/files/game.json', bytes],
  ]);
  const old = { id: 'old-game', slug: 'drawing-defense', title: 'Obsolete title', summary: 'Old shell',
    trainer: 'brain', category: 'higher-cognition', developer_display_name: 'Old author',
    release_id: 'old-release', version: '1.0.0', capabilities_json: '[]' };
  const env = { REHAB_DB: { prepare: () => ({ all: async () => ({ results: [old,
    { ...old, id: 'another-game', slug: 'another-game', title: 'Another game' },
  ] }) }) }, GAME_RELEASE_BUCKET: { get: async key => {
    const source = objects.get(key);
    return source ? { size: source.length, text: async () => source.toString('utf8'),
      arrayBuffer: async () => source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength) } : null;
  } } };
  return { env, metadata, manifest, objects };
}
async function List(fixture) {
  const response = await onRequestGet({ request: new Request('https://trainerhub.cc/api/games'), env: fixture.env });
  assert.equal(response.status, 200);
  return (await response.json()).games;
}

test('public catalog reads preview and tags from the approved game bytes instead of the old publication', async () => {
  const fixture = Fixture();
  const games = await List(fixture);
  const game = games.find(value => value.slug === 'drawing-defense');
  assert.equal(game.title, fixture.metadata.copy['zh-TW'].title);
  assert.equal(game.category, 'upper-limb');
  assert.equal(game.trainer, 'motor');
  assert.equal(game.developerName, fixture.metadata.author);
  assert.equal(game.release.version, '2.0.3');
  assert.equal(game.release.presentation, 'game');
  assert.deepEqual(game.copy, fixture.metadata.copy);
  assert.equal(game.previewUrl, 'https://trainerhub-user-games.pages.dev/games/drawing-defense/2.0.3/package/preview.webp');
  assert.equal(games.filter(value => value.slug === 'drawing-defense').length, 1);
  assert.ok(games.some(value => value.slug === 'another-game'));
});

test('a revoked release, forged metadata or missing preview never enters the public game catalog', async () => {
  for (const failure of ['revoked', 'digest', 'missing-preview', 'invalid-tags']) {
    const fixture = Fixture();
    if (failure === 'revoked') fixture.manifest.status = 'revoked';
    if (failure === 'digest') fixture.objects.set('releases/drawing-defense/2.0.3/files/game.json', Buffer.from('{}'));
    if (failure === 'missing-preview') fixture.manifest.files = fixture.manifest.files.filter(file => file.path !== 'preview.webp');
    if (failure === 'invalid-tags') {
      fixture.metadata.category = 'higher-cognition';
      const bytes = Buffer.from(JSON.stringify(fixture.metadata));
      const file = fixture.manifest.files.find(value => value.path === 'game.json');
      file.size = bytes.length; file.sha256 = sha256(bytes);
      fixture.objects.set('releases/drawing-defense/2.0.3/files/game.json', bytes);
    }
    fixture.objects.set('releases/drawing-defense/2.0.3/release.json', Buffer.from(JSON.stringify(fixture.manifest)));
    const games = await List(fixture);
    assert.equal(games.some(value => value.slug === 'drawing-defense'), false, failure);
    assert.ok(games.some(value => value.slug === 'another-game'));
  }
});

test('an older approved self-contained version keeps game-owned fallback tags without using the old shell', async () => {
  const fixture = Fixture();
  fixture.manifest.files = fixture.manifest.files.filter(file => file.path !== 'game.json');
  fixture.objects.set('releases/drawing-defense/2.0.3/release.json', Buffer.from(JSON.stringify(fixture.manifest)));
  const game = (await List(fixture)).find(value => value.slug === 'drawing-defense');
  assert.equal(game.category, 'upper-limb');
  assert.equal(game.release.presentation, 'game');
  assert.equal(game.previewUrl, undefined);
});
