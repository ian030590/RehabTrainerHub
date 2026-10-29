import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appRoot = new URL('../apps/rehabtrainerhub/app/', import.meta.url);
const categories = { motor: ['hand', 'balance'], vision: ['tracking'], brain: ['attention', 'memory'], empty: [] };
function LoadHelper() {
  return import(new URL('lobbyResults.js', appRoot));
}

test('active filters omit empty selections and whitespace-only search', async () => {
  const { BuildLobbyFilterChips } = await LoadHelper();
  assert.deepEqual(BuildLobbyFilterChips([], '  ', categories), []);
});

test('selecting every purpose collapses a category into one removable chip', async () => {
  const { BuildLobbyFilterChips } = await LoadHelper();
  const selected = ['balance', 'hand', 'attention'];
  const chips = BuildLobbyFilterChips(selected, '', categories);
  assert.deepEqual(chips, [
    { key: 'category:motor', kind: 'category', id: 'motor', purposeIds: ['hand', 'balance'] },
    { key: 'purpose:attention', kind: 'purpose', id: 'attention', purposeIds: ['attention'] },
  ]);
  assert.deepEqual(selected.filter(id => !chips[0].purposeIds.includes(id)), ['attention']);
  assert.deepEqual(selected, ['balance', 'hand', 'attention'], 'Derivation must not mutate filter state.');
});

test('partial categories retain individual purposes; search is trimmed and keeps its case', async () => {
  const { BuildLobbyFilterChips } = await LoadHelper();
  assert.deepEqual(BuildLobbyFilterChips(['hand', 'memory', 'hand'], '  Hand 手部  ', categories), [
    { key: 'purpose:hand', kind: 'purpose', id: 'hand', purposeIds: ['hand'] },
    { key: 'purpose:memory', kind: 'purpose', id: 'memory', purposeIds: ['memory'] },
    { key: 'search', kind: 'search', query: 'Hand 手部' },
  ]);
  assert.deepEqual(BuildLobbyFilterChips(['tracking'], '', categories), [
    { key: 'category:vision', kind: 'category', id: 'vision', purposeIds: ['tracking'] },
  ]);
});

test('pagination shows twelve modules per page and a shorter last page without losing items', async () => {
  const { PaginateLobbyGames, lobbyPageSize } = await LoadHelper();
  const games = Array.from({ length: 30 }, (_, id) => ({ id }));
  assert.equal(lobbyPageSize, 12);
  const pages = [1, 2, 3].map(page => PaginateLobbyGames(games, page));
  assert.deepEqual(pages.map(({ page, totalPages, start, end, items }) => [page, totalPages, start, end, items.length]), [
    [1, 3, 1, 12, 12], [2, 3, 13, 24, 12], [3, 3, 25, 30, 6],
  ]);
  assert.deepEqual(pages.flatMap(page => page.items), games);
  assert.equal(games.length, 30);
});

test('pagination clamps stale pages after results shrink and handles empty and exact pages', async () => {
  const { PaginateLobbyGames } = await LoadHelper();
  assert.deepEqual(PaginateLobbyGames([], 5), { items: [], page: 1, totalPages: 1, start: 0, end: 0 });
  const games = Array.from({ length: 13 }, (_, id) => id);
  assert.deepEqual(PaginateLobbyGames(games, 4), { items: [12], page: 2, totalPages: 2, start: 13, end: 13 });
  assert.equal(PaginateLobbyGames(games, 0).page, 1);
  assert.equal(PaginateLobbyGames(games.slice(0, 12), 2).totalPages, 1);
});

test('page-number windows keep first, last and adjacent pages with non-interactive gaps', async () => {
  const { BuildLobbyPageNumbers } = await LoadHelper();
  assert.deepEqual(BuildLobbyPageNumbers(1, 1), [1]);
  assert.deepEqual(BuildLobbyPageNumbers(3, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(BuildLobbyPageNumbers(1, 20), [1, 2, 'ellipsis', 20]);
  assert.deepEqual(BuildLobbyPageNumbers(10, 20), [1, 'ellipsis', 9, 10, 11, 'ellipsis', 20]);
  assert.deepEqual(BuildLobbyPageNumbers(20, 20), [1, 'ellipsis', 19, 20]);
  for (let page = 1; page <= 20; page += 1) {
    const window = BuildLobbyPageNumbers(page, 20);
    const numbers = window.filter(value => typeof value === 'number');
    assert.equal(numbers[0], 1);
    assert.equal(numbers.at(-1), 20);
    assert.ok(numbers.includes(page));
    assert.equal(new Set(numbers).size, numbers.length);
    assert.ok(window.length <= 7);
  }
});

test('lobby connects removable themed chips, clear-all and focus recovery above the grid', async () => {
  const source = await readFile(new URL('TrainingLobby.tsx', appRoot), 'utf8');
  assert.match(source, /from ['"]\.\/lobbyResults\.js['"]/);
  assert.match(source, /BuildLobbyFilterChips\(selectedPurposes, query, categorySubcategories\)/);
  assert.match(source, /activeFilters\.length > 0/);
  const chipRow = source.slice(source.indexOf('className="lobby-active-filters"'), source.indexOf('className="module-grid"'));
  assert.match(chipRow, /<button[\s\S]*?aria-label=\{t\('lobby\.removeFilter'/);
  assert.match(chipRow, /BuildTrainingThemeStyle\(theme\)/);
  assert.match(chipRow, /trainerCategoryTags\.find\(/, 'Collapsed chips use the category label, rather than its representative purpose.');
  assert.match(chipRow, /onClick=\{clearFilters\}[\s\S]*?copy\.clearAllFilters/);
  assert.match(source, /pendingFilterFocus/);
  assert.match(source, /querySelectorAll<HTMLButtonElement>\('button'\)/);
  assert.match(source, /resultTitleRef\.current/);
  assert.match(source, /\.focus\(/);
});

test('lobby renders a paginated slice, accessible controls, range and filter resets', async () => {
  const source = await readFile(new URL('TrainingLobby.tsx', appRoot), 'utf8');
  assert.match(source, /PaginateLobbyGames\(visibleGames, page\)/);
  assert.match(source, /pagination\.items\.map\(/);
  assert.doesNotMatch(source, /visibleGames\.map\(/);
  assert.match(source, /BuildLobbyPageNumbers\(pagination\.page, pagination\.totalPages\)/);
  assert.match(source, /<nav[\s\S]*?aria-label=\{copy\.paginationLabel\}/);
  assert.match(source, /pagination\.totalPages > 1/);
  assert.match(source, /aria-current=\{[^}]*?['"]page['"]/);
  assert.match(source, /disabled=\{pagination\.page === 1\}/);
  assert.match(source, /disabled=\{pagination\.page === pagination\.totalPages\}/);
  assert.match(source, /id="result-title"[^>]*tabIndex=\{-1\}/);
  assert.match(source, /scrollIntoView\(\{ block: 'start' \}\)/);
  assert.match(source, /t\('lobby\.moduleCount', \{ count: visibleGames\.length \}\)/);
  assert.match(source, /t\('lobby\.moduleRange', \{ start: pagination\.start, end: pagination\.end \}\)/);
  assert.match(source, /useEffect\(\(\) => \{\s*setPage\(1\);\s*\}, \[query, selectedPurposes\]\)/);
  assert.match(source, /Math\.min\(current, pagination\.totalPages\)/);
});

test('lobby styles keep chip text and page controls within narrow screens using accessible tokens', async () => {
  const css = await readFile(new URL('globals.css', appRoot), 'utf8');
  assert.match(css, /\.lobby-active-filters\s*\{[^}]*flex-wrap: wrap/);
  assert.match(css, /\.lobby-filter-chip\s*\{[^}]*overflow-wrap: anywhere/);
  assert.match(css, /\.lobby-pagination\s*\{[^}]*flex-wrap: wrap/);
  assert.match(css, /\.lobby-pagination button\s*\{[^}]*min-width: 44px;[^}]*min-height: 44px/);
  assert.match(css, /\.lobby-pagination button\[aria-current=['"]page['"]\]/);
  assert.match(css, /#result-title:focus-visible/);
  for (const locale of ['en', 'zh-TW']) {
    const dictionary = await readFile(new URL(`i18n/${locale}.ts`, appRoot), 'utf8');
    for (const key of ['activeFilters', 'clearAllFilters', 'removeFilter', 'searchFilter', 'paginationLabel', 'previousPage', 'nextPage', 'pageNumber', 'moduleRange']) {
      assert.match(dictionary, new RegExp(`\\b${key}:`), `${locale} needs ${key}`);
    }
  }
});
