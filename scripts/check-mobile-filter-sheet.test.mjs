import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '..');
const lobbyPath = resolve(repoRoot, 'apps/rehabtrainerhub/app/TrainingLobby.tsx');
const cssPath = resolve(repoRoot, 'apps/rehabtrainerhub/app/globals.css');
const zhPath = resolve(repoRoot, 'apps/rehabtrainerhub/app/i18n/zh-TW.ts');
const enPath = resolve(repoRoot, 'apps/rehabtrainerhub/app/i18n/en.ts');

const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

test('TrainingLobby implements accessible mobile bottom sheet filter interaction', async () => {
  const lobbySource = await readFile(lobbyPath, 'utf8');

  // Trigger button exists and binds to mobile filter state
  assert.ok(
    lobbySource.includes('filter-mobile-trigger'),
    'TrainingLobby must render a mobile filter trigger button (.filter-mobile-trigger).',
  );
  assert.ok(
    lobbySource.includes('aria-expanded={isMobileFilterOpen}'),
    'Mobile filter trigger must announce aria-expanded state.',
  );
  assert.ok(
    lobbySource.includes('aria-controls="filter-panel"'),
    'Mobile filter trigger must declare aria-controls for the filter panel.',
  );

  // Bottom sheet elements
  assert.ok(
    lobbySource.includes('filter-sheet-backdrop'),
    'TrainingLobby must render a backdrop overlay (.filter-sheet-backdrop) for the bottom sheet.',
  );
  assert.ok(
    lobbySource.includes('filter-sheet-handle'),
    'Bottom sheet must render an ergonomic drag/touch handle (.filter-sheet-handle).',
  );
  assert.ok(
    lobbySource.includes('filter-sheet-close'),
    'Bottom sheet must render a dedicated close button (.filter-sheet-close).',
  );
  assert.ok(
    lobbySource.includes('filter-sheet-footer'),
    'Bottom sheet must render a sticky action footer (.filter-sheet-footer).',
  );
  assert.ok(
    lobbySource.includes('filter-sheet-apply-btn'),
    'Bottom sheet footer must provide an apply/view results button (.filter-sheet-apply-btn).',
  );

  // Keyboard and scroll lock
  assert.ok(
    lobbySource.includes("'Escape'") || lobbySource.includes('"Escape"'),
    'Bottom sheet must handle Escape key to close on mobile.',
  );
  assert.ok(
    lobbySource.includes('overflow = isMobileFilterOpen'),
    'Bottom sheet must manage body overflow scroll lock while active.',
  );

  // Zero emojis in source
  assert.equal(
    emojiRegex.test(lobbySource),
    false,
    'TrainingLobby must not contain any emojis.',
  );
});

test('globals.css provides high-taste bottom sheet layout and touch-ergonomic targets', async () => {
  const css = await readFile(cssPath, 'utf8');

  // Mobile trigger styles
  assert.ok(
    css.includes('.filter-mobile-trigger'),
    'globals.css must define styles for .filter-mobile-trigger.',
  );

  // Bottom sheet backdrop
  assert.ok(
    css.includes('.filter-sheet-backdrop'),
    'globals.css must define styles for .filter-sheet-backdrop.',
  );
  assert.ok(
    css.includes('.filter-sheet-handle'),
    'globals.css must define styles for .filter-sheet-handle.',
  );
  assert.ok(
    css.includes('.filter-sheet-close'),
    'globals.css must define styles for .filter-sheet-close.',
  );
  assert.ok(
    css.includes('.filter-sheet-footer'),
    'globals.css must define styles for .filter-sheet-footer.',
  );

  // Fixed bottom positioning on mobile
  const mobileSheetRule = css.match(/@media[^{]*(?:max-width:\s*(?:720px|768px))[^{]*\{[\s\S]*?\.filter-panel\s*\{([\s\S]*?)\}/);
  assert.ok(mobileSheetRule, 'globals.css must define mobile .filter-panel styles within mobile @media query.');
  const sheetStyles = mobileSheetRule[1];
  assert.ok(sheetStyles.includes('position: fixed'), 'Mobile .filter-panel must use position: fixed.');
  assert.ok(sheetStyles.includes('bottom: 0'), 'Mobile .filter-panel must anchor to bottom: 0.');
  assert.ok(sheetStyles.includes('z-index:'), 'Mobile .filter-panel must define z-index elevation.');
  assert.ok(
    sheetStyles.includes('max-height:'),
    'Mobile .filter-panel must bound max-height (e.g. 85dvh or 85vh).',
  );

  // Elimination of double horizontal scroll trap in mobile filter groups
  const mobileCategoryGroups = css.match(/@media[^{]*(?:max-width:\s*(?:720px|768px))[^{]*\{[\s\S]*?\.filter-subcategory-list\s*\{([\s\S]*?)\}/);
  assert.ok(
    mobileCategoryGroups,
    'globals.css must define wrap or column styles for mobile .filter-subcategory-list without nested horizontal overflow.',
  );
  assert.ok(
    mobileCategoryGroups[1].includes('flex-wrap: wrap') || mobileCategoryGroups[1].includes('grid'),
    'Mobile subcategories must wrap or use a grid instead of nested horizontal scrolling.',
  );
});

test('Lobby i18n dictionaries provide bottom sheet keys with exact parity and no emojis', async () => {
  const [zh, en] = await Promise.all([
    readFile(zhPath, 'utf8'),
    readFile(enPath, 'utf8'),
  ]);

  for (const requiredKey of ['closeFilters', 'viewResults']) {
    assert.ok(zh.includes(requiredKey), `zh-TW.ts must define ${requiredKey}`);
    assert.ok(en.includes(requiredKey), `en.ts must define ${requiredKey}`);
  }

  assert.equal(emojiRegex.test(zh), false, 'zh-TW.ts must not contain emojis.');
  assert.equal(emojiRegex.test(en), false, 'en.ts must not contain emojis.');
});
