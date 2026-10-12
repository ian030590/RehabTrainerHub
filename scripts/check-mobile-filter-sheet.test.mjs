import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const repoRoot = resolve(import.meta.dirname, '..');
const lobbyPath = resolve(repoRoot, 'apps/rehabtrainerhub/app/TrainingLobby.tsx');
const cssPath = resolve(repoRoot, 'apps/rehabtrainerhub/app/globals.css');
const sheetCssPath = resolve(repoRoot, 'packages/ui/src/components/BottomSheet.css');
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
    (await readFile(sheetCssPath, 'utf8')).includes('::backdrop'),
    'Mobile filters must render the native modal backdrop.',
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

  const sheetSource = await readFile(resolve(repoRoot, 'packages/ui/src/hooks/useBottomSheet.ts'), 'utf8');

  // Native modal provides focus trapping and blocks background interaction.
  assert.ok(
    lobbySource.includes('<dialog') && sheetSource.includes('showModal()'),
    'Mobile filters must use a native modal dialog for focus and background isolation.',
  );
  assert.ok(
    sheetSource.includes('scrollTo') && sheetSource.includes("position: 'fixed'"),
    'Closing filters must restore the lobby scroll position, including on iOS.',
  );

  // Zero emojis in source
  assert.equal(
    emojiRegex.test(lobbySource),
    false,
    'TrainingLobby must not contain any emojis.',
  );
});

async function LoadSheetMotion() {
  const source = await readFile(resolve(repoRoot, 'packages/ui/src/bottomSheetMotion.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

test('short drags return to the current detent; intentional drags expand, collapse or dismiss', async () => {
  const { GetSheetDetents, ResolveSheetTarget } = await LoadSheetMotion();
  const detents = GetSheetDetents(844);
  assert.ok(detents.medium >= 400 && detents.medium < detents.large);
  assert.ok(detents.large < 844);
  assert.equal(ResolveSheetTarget(detents.medium - 20, 0, detents), detents.medium);
  assert.equal(ResolveSheetTarget(detents.medium + 25, 0, detents), detents.medium);
  assert.equal(ResolveSheetTarget(detents.large - 25, 0, detents), detents.large);
  assert.equal(ResolveSheetTarget(detents.large, 0, detents), detents.large);
  assert.equal(ResolveSheetTarget(detents.medium - 180, 0, detents), 0);
  assert.equal(ResolveSheetTarget(detents.medium - 35, -1.2, detents), 0);
  assert.equal(ResolveSheetTarget(detents.medium + 35, 1.2, detents), detents.large);
  assert.equal(ResolveSheetTarget(detents.large - 35, -1.2, detents), detents.medium);
});

test('short landscape viewports keep the filter actions reachable', async () => {
  const { GetSheetDetents } = await LoadSheetMotion();
  for (const height of [320, 390, 600, 844]) {
    const { medium, large } = GetSheetDetents(height);
    assert.ok(medium <= large && large <= height - 12);
    assert.ok(medium >= Math.min(320, large));
  }
  assert.equal(GetSheetDetents(844, 47).large, 785, 'Expanded sheet leaves room for the iPhone top safe area.');
});

test('spring settles exactly at the selected height after opening, dismissal and a fling', async () => {
  const { StepSheetSpring } = await LoadSheetMotion();
  for (const [position, velocity, target] of [[0, 0, 464], [464, -1200, 0], [500, 1200, 820]]) {
    let motion = { position, velocity };
    for (let frame = 0; frame < 180; frame += 1) {
      motion = StepSheetSpring(motion, target, 1 / 60);
      assert.ok(Number.isFinite(motion.position) && Number.isFinite(motion.velocity));
    }
    assert.equal(motion.position, target);
    assert.equal(motion.velocity, 0);
  }
});

test('spring motion has the same timing on 30, 60 and 120 Hz displays', async () => {
  const { StepSheetSpring } = await LoadSheetMotion();
  const positions = [30, 60, 120].map(rate => {
    let motion = { position: 0, velocity: 0 };
    for (let frame = 0; frame < rate / 2; frame++) motion = StepSheetSpring(motion, 464, 1 / rate);
    return motion.position;
  });
  assert.ok(Math.max(...positions) - Math.min(...positions) < 2, 'Refresh rate must not change the speed of the sheet.');
});

test('globals.css provides high-taste bottom sheet layout and touch-ergonomic targets', async () => {
  const css = (await readFile(cssPath, 'utf8')) + (await readFile(sheetCssPath, 'utf8'));

  // Mobile trigger styles
  assert.ok(
    css.includes('.filter-mobile-trigger'),
    'globals.css must define styles for .filter-mobile-trigger.',
  );

  // Bottom sheet backdrop
  assert.ok(
    css.includes('::backdrop'),
    'The mobile modal must define native backdrop styles.',
  );
  assert.ok(css.includes('--sheet-page-progress'), 'The presenting page must recede with the sheet and return during dismissal.');
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

  for (const requiredKey of ['closeFilters', 'viewResults', 'resizeFilters']) {
    assert.ok(zh.includes(requiredKey), `zh-TW.ts must define ${requiredKey}`);
    assert.ok(en.includes(requiredKey), `en.ts must define ${requiredKey}`);
  }

  assert.equal(emojiRegex.test(zh), false, 'zh-TW.ts must not contain emojis.');
  assert.equal(emojiRegex.test(en), false, 'en.ts must not contain emojis.');
});
