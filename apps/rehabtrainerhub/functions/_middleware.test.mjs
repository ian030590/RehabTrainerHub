import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest, canonicalRedirectHosts } from './_middleware.js';

test('migrated games reject legacy assets before Pages can serve retained cache', () => {
  for (const gameId of ['drawing-defense', 'asteroid-shield', 'moving-card']) {
    for (const path of ['settings.json', 'score.json', 'assets/legacy.js', 'sw.js', 'manifest.webmanifest']) {
      for (const method of ['GET', 'HEAD']) {
        let assetsRead = false;
        const response = onRequest({ request: new Request(`https://trainerhub.cc/games/${gameId}/${path}`, { method }),
          next: () => { assetsRead = true; return new Response('retained legacy asset'); } });
        assert.equal(response.status, 410, `${method}: ${gameId}/${path}`);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(assetsRead, false);
      }
    }
  }
});

test('migrated compatibility entry still reaches the static R2 link', () => {
  for (const gameId of ['drawing-defense', 'asteroid-shield', 'moving-card']) {
    for (const path of ['', 'index.html']) {
      const expected = new Response('R2 PWA link');
      assert.equal(onRequest({ request: new Request(`https://trainerhub.cc/games/${gameId}/${path}`), next: () => expected }), expected);
    }
  }
});

test('unmigrated games, previews and APIs keep their existing routing', () => {
  for (const path of ['/games/reading-training/settings.json', '/assets/game-previews/asteroid-shield/preview.webp', '/api/official-game-sessions']) {
    const expected = new Response('existing route');
    assert.equal(onRequest({ request: new Request('https://trainerhub.cc' + path), next: () => expected }), expected);
  }
});

test('retired hosts keep canonical redirects before any asset routing', () => {
  for (const host of canonicalRedirectHosts) {
    const response = onRequest({ request: new Request(`https://${host}/games/asteroid-shield/settings.json`),
      next: () => assert.fail('redirect must not read assets') });
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), 'https://trainerhub.cc/');
  }
});
