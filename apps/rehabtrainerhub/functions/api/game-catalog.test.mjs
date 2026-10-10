import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { onRequestGet } from './games.js';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function Fixture(gameId = 'drawing-defense', version = '2.0.3') {
  const metadata = { schemaVersion: 1, gameId, trainer: 'motor', category: 'upper-limb',
    author: 'Game author', preview: 'preview.webp', copy: {
      'zh-TW': { title: '畫畫塔防', description: '上肢動作練習。' },
      en: { title: 'Drawing defense', description: 'Upper-limb practice.' },
    } };
  if (gameId === 'moving-card') Object.assign(metadata, { trainer: 'vision', category: 'vision', copy: {
    'zh-TW': { title: '移動卡片訓練', description: '在移動卡片中尋找目標，練習視覺搜尋與動態專注。' },
    en: { title: 'Moving Card Training', description: 'Find targets among moving cards to practise visual search and dynamic attention.' },
  } });
  const bytes = Buffer.from(JSON.stringify(metadata));
  const manifest = { schemaVersion: 1, status: 'approved', gameId, version,
    name: 'Drawing defense', runtime: { name: 'native', major: 1 }, presentation: 'game', entry: 'index.html',
    contentSha256: 'a'.repeat(64), capabilities: ['pointer'], approvedAt: '2026-10-08T00:00:00Z',
    files: ['index.html', 'game.json', 'preview.webp'].map(path => ({ path, size: path === 'game.json' ? bytes.length : 1,
      sha256: path === 'game.json' ? sha256(bytes) : 'b'.repeat(64) })) };
  const objects = new Map([
    [`official-games/${gameId}/current.json`, Buffer.from(JSON.stringify({ schemaVersion: 1,
      gameId, currentVersion: version, releases: { [version]: { contentSha256: manifest.contentSha256 } } }))],
    [`releases/${gameId}/${version}/release.json`, Buffer.from(JSON.stringify(manifest))],
    [`releases/${gameId}/${version}/files/game.json`, bytes],
  ]);
  const old = { id: 'old-game', slug: gameId, title: 'Obsolete title', summary: 'Old shell',
    trainer: 'brain', category: 'higher-cognition', developer_display_name: 'Old author',
    release_id: 'old-release', version: '1.0.0', capabilities_json: '[]' };
  if (gameId === 'moving-card') Object.assign(old, { id: 'official-moving-card', title: '移動卡片訓練',
    trainer: 'vision', category: 'general', release_id: 'rel-moving-card-1.0.0',
    content_sha256: '35083a8dfe0b9297cf642cd8066e9123237d48e2cf1eae3f68b763e2f27bf246' });
  if (gameId === 'motor-cortex-rehab') Object.assign(old, { id: 'official-motor-cortex-rehab',
    title: '手部目標追蹤練習', trainer: 'motor', category: 'general',
    release_id: 'rel-motor-cortex-rehab-1.0.0',
    content_sha256: '636a44cd63c03476890ee127096dbfb38ed084af9985d97544ba1170b22f315d',
    capabilities_json: '["audio","fullscreen","keyboard","pointer"]' });
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

test('moving-card current replaces the historical shell with the original vision category and versioned preview', async () => {
  const fixture = Fixture('moving-card', '2.0.0');
  const games = await List(fixture);
  const matches = games.filter(game => game.slug === 'moving-card');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].title, '移動卡片訓練');
  assert.equal(matches[0].trainer, 'vision'); assert.equal(matches[0].category, 'vision');
  assert.equal(matches[0].release.presentation, 'game');
  assert.equal(matches[0].release.version, '2.0.0');
  assert.equal(matches[0].release.settingsUrl, undefined);
  assert.equal(matches[0].previewUrl, 'https://trainerhub-user-games.pages.dev/games/moving-card/2.0.0/package/preview.webp');
  fixture.objects.set('releases/moving-card/2.0.0/files/game.json', Buffer.from('{}'));
  assert.equal((await List(fixture)).some(game => game.slug === 'moving-card'), false);
});

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

test('asteroid current metadata replaces its historical shell and rejects absent or corrupted declarations', async () => {
  const fixture = Fixture('asteroid-shield', '2.0.0');
  const game = (await List(fixture)).find(value => value.slug === 'asteroid-shield');
  assert.equal(game.release.presentation, 'game');
  assert.equal(game.release.version, '2.0.0');
  assert.equal(game.category, 'upper-limb');
  assert.equal(game.previewUrl, 'https://trainerhub-user-games.pages.dev/games/asteroid-shield/2.0.0/package/preview.webp');
  assert.equal(game.release.settingsUrl, undefined);
  assert.equal((await List(fixture)).filter(value => value.slug === 'asteroid-shield').length, 1);
  for (const missing of [false, true]) {
    if (missing) {
      fixture.manifest.files = fixture.manifest.files.filter(file => file.path !== 'game.json');
      fixture.objects.set('releases/asteroid-shield/2.0.0/release.json', Buffer.from(JSON.stringify(fixture.manifest)));
    } else fixture.objects.set('releases/asteroid-shield/2.0.0/files/game.json', Buffer.from('{}'));
    assert.equal((await List(fixture)).some(value => value.slug === 'asteroid-shield'), false);
  }
});

test('hand tracking current replaces the same-slug historical settings shell with its own metadata', async () => {
  const fixture = Fixture('motor-cortex-rehab', '2.0.0');
  const games = await List(fixture);
  const [game] = games.filter(value => value.slug === 'motor-cortex-rehab');
  assert.equal(games.filter(value => value.slug === 'motor-cortex-rehab').length, 1);
  assert.equal(game.release.presentation, 'game');
  assert.equal(game.release.settingsUrl, undefined);
  assert.equal(game.category, 'upper-limb');
  assert.equal(game.previewUrl, 'https://trainerhub-user-games.pages.dev/games/motor-cortex-rehab/2.0.0/package/preview.webp');
  fixture.objects.set('releases/motor-cortex-rehab/2.0.0/files/game.json', Buffer.from('{}'));
  assert.equal((await List(fixture)).some(value => value.slug === 'motor-cortex-rehab'), false);
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
