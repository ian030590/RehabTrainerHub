#!/usr/bin/env node

/**
 * Deployment-only browser acceptance for an official game PWA.
 *
 * Playwright is intentionally an optional tool for this repository: the
 * normal dependency install and static gates must not download a browser. CI or a
 * release operator can install Playwright in its own environment and invoke
 * this script with OFFICIAL_GAME_PWA_BASE_URL set to a deployed Hub origin.
 */
import assert from 'node:assert/strict';

const baseUrl = String(process.env.OFFICIAL_GAME_PWA_BASE_URL || '').trim();
const gameIds = ParseGameIds(
  process.env.OFFICIAL_GAME_PWA_GAME_IDS
    ?? process.env.OFFICIAL_GAME_PWA_GAME_ID
    ?? 'moving-card',
);
const language = String(process.env.OFFICIAL_GAME_PWA_LANGUAGE || 'zh').trim();
if (!/^https?:\/\/[^/]+$/i.test(baseUrl)) {
  throw new Error('Set OFFICIAL_GAME_PWA_BASE_URL to the deployed Hub origin (for example https://trainerhub.cc).');
}
if (language !== 'zh' && language !== 'en') {
  throw new Error('OFFICIAL_GAME_PWA_LANGUAGE must be zh or en.');
}

let playwright;
try {
  playwright = await import('playwright');
} catch {
  throw new Error('Playwright is not installed in this environment; run this deployment-only gate with a browser-enabled toolchain.');
}

const browser = await playwright.chromium.launch({
  headless: true,
  args: ['--disable-background-networking', '--disable-default-apps'],
});
try {
  const expectedOrigin = new URL(baseUrl).origin;
  for (const gameId of gameIds) {
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    const requests = [];
    context.on('request', (request) => {
      requests.push({ url: request.url(), resourceType: request.resourceType() });
    });
    const page = await context.newPage();
    await page.route('**/*', async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.origin !== expectedOrigin) {
        await route.abort();
        return;
      }
      await route.continue();
    });

    const gameUrl = `${baseUrl}/games/${gameId}/?lang=${language}`;
    await page.goto(gameUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1_500);
    assert.equal(
      requests.some(({ url }) => new URL(url).origin !== expectedOrigin),
      false,
      'The official game PWA must not issue a cross-origin request.',
    );
    const initialRequests = requests.slice();
    assert.equal(
      initialRequests.some(({ url }) => /offline-manifests\//i.test(url)),
      false,
      'Opening a game PWA must not fetch its offline manifest before the explicit download action.',
    );
    assert.deepEqual(
      initialRequests.filter(({ url }) => IsHeavyUrl(url)),
      [],
      'Opening a game PWA must not request heavy runtime chunks or models before rules are visible.',
    );
    assert.equal(
      await page.evaluate(() => navigator.serviceWorker?.ready.then((registration) => Boolean(registration.active))),
      true,
      'The official game PWA must activate its scoped service worker before offline installation.',
    );

    const rulesButton = page.getByRole('button', { name: /continue|rules|\u898f\u5247|\u7e7c\u7e8c/i }).first();
    if (await rulesButton.count() === 0) {
      throw new Error('The deployed game PWA did not expose a rules transition button.');
    }
    await rulesButton.click();
    await page.waitForTimeout(1_500);
    assert.equal(
      requests.some(({ url }) => new URL(url).origin !== expectedOrigin),
      false,
      'The official game PWA must not issue a cross-origin request after rules are visible.',
    );
    const afterRulesRequests = requests.slice(initialRequests.length);
    assert.equal(
      afterRulesRequests.some(({ url }) => IsHeavyUrl(url)),
      true,
      'Rules-visible transition must be able to request the selected module engine.',
    );

    const offlineButton = page.getByRole('button', { name: /offline|download|\u96e2\u7dda|\u4e0b\u8f09/i }).first();
    assert.equal(
      await offlineButton.count() > 0,
      true,
      'The game PWA must expose an explicit offline download action.',
    );
    const offlineReady = page.waitForFunction(
      () => !document.querySelector('#official-game-offline button'),
      { timeout: 60_000 },
    );
    await offlineButton.click();
    await offlineReady;
    assert.equal(
      await page.locator('#official-game-offline-status').textContent().then((value) => Boolean(value)),
      true,
      'The PWA must expose a status after the offline pack transaction completes.',
    );

    // A fresh page in the same browser profile must be able to boot from the
    // game-scoped cache without a network. This is the deployment-only part of
    // the gate; it intentionally never runs during dependency installation.
    await context.setOffline(true);
    const offlinePage = await context.newPage();
    await offlinePage.goto(gameUrl, { waitUntil: 'domcontentloaded' });
    await offlinePage.waitForTimeout(1_000);
    assert.equal(
      await offlinePage.locator('html[data-official-game-pwa="true"]').count(),
      1,
      'The installed game shell must reload while offline.',
    );
    assert.equal(
      await offlinePage.locator('#official-game-offline').count(),
      1,
      'The offline launcher must remain available from the scoped cache.',
    );
    assert.equal(
      await offlinePage.locator('iframe').count() > 0,
      true,
      'The offline launcher must retain the selected training surface.',
    );
    await offlinePage.close();
    await context.setOffline(false);
    console.log(`Official game PWA fresh-install/offline browser boundary passed for ${gameId}.`);
    await context.close();
  }
} finally {
  await browser.close();
}

function IsHeavyUrl(value) {
  return /(?:pixi|three|mediapipe|tensorflow|webgazer|\.wasm(?:$|[?#])|\.task(?:$|[?#])|\.onnx(?:$|[?#])|facemesh|hand_landmarker|pose_landmarker)/i.test(value);
}

function ParseGameIds(value) {
  const gameIds = [...new Set(String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean))];
  if (gameIds.length === 0 || gameIds.length > 64
    || gameIds.some((gameId) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gameId))) {
    throw new Error('OFFICIAL_GAME_PWA_GAME_IDS must contain one or more lowercase slugs separated by commas.');
  }
  return gameIds;
}
