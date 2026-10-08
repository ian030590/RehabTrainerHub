import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { MergeHubGames } from './hubGames.js';

test('one catalog includes existing games and reviewed releases without duplicating a migrated game', () => {
  const legacy = [{ id: 'moving-card', launch: 'legacy' }, { id: 'drawing-defense', launch: 'catalog' }];
  const published = [{ id: 'drawing-defense', launch: 'release' }, { id: 'new-game', launch: 'release' }];
  const games = MergeHubGames(legacy, published);
  assert.deepEqual(games.map(game => game.id), ['moving-card', 'drawing-defense', 'new-game']);
  assert.equal(games.find(game => game.id === 'moving-card'), legacy[0]);
  assert.equal(games.find(game => game.id === 'drawing-defense'), published[0]);
  assert.equal(legacy.length, 2);
});

test('catalog outages preserve existing game navigation and installation entries', () => {
  const games = [{ id: 'legacy-game', installUrl: '/games/legacy-game/', launch: { module: 'original' } }];
  assert.deepEqual(MergeHubGames(games, []), games);
});

test('a published slug collision cannot replace a retained legacy game during the Hub-only stage', () => {
  const existing = { id: 'moving-card', launch: { module: 'original' }, installUrl: '/games/moving-card/' };
  const published = { id: 'moving-card', launch: { module: 'uploaded' }, installUrl: '/uploaded/' };
  const games = MergeHubGames([existing], [published], new Set(['moving-card']));
  assert.deepEqual(games, [existing]);
});

test('the lobby presents one result grid and one launch entry while retaining its mobile controls', async () => {
  const source = await readFile(new URL('./TrainingLobby.tsx', import.meta.url), 'utf8');
  assert.equal((source.match(/className="module-grid"/g) ?? []).length, 1);
  assert.doesNotMatch(source, /Official library|Developer library|officialLibrary|developerLibrary/);
  assert.match(source, /<GameOverlay /);
  assert.match(source, /aria-expanded=\{isMobileFilterOpen\}/);
  assert.match(source, /aria-controls="filter-panel"/);
});
