import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as jsx from 'react/jsx-runtime';
import ts from 'typescript';
import * as lobbyResults from '../apps/rehabtrainerhub/app/lobbyResults.js';
import { MergeHubGames } from '../apps/rehabtrainerhub/app/hubGames.js';
import { ReadCatalog } from './recommendation-pipeline.mjs';

const app = new URL('../apps/rehabtrainerhub/app/', import.meta.url);
const read = path => readFileSync(new URL(path, app), 'utf8');
const ranking = () => import('../apps/rehabtrainerhub/app/lobbyRecommendations.js');
const history = () => import('../apps/rehabtrainerhub/app/lobbyActivityHistory.js');
const activity = (gameId, day = 1) => ({ gameId, playedAt: new Date(Date.UTC(2026, 0, day)).toISOString() });
const summary = (gameId, count, day = 1) => ({ gameId, count, lastPlayedAt: activity(gameId, day).playedAt });
const catalog = (...ids) => ids.map(id => ({ id }));
const ids = games => games.map(({ id }) => id);

function Device(initial) {
  const values = new Map(initial);
  const device = new EventTarget();
  device.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  return device;
}

test('cold start preserves the merged catalog byte for byte and ignores unknown history ids', async () => {
  const { OrderLobbyGames } = await ranking();
  const official = await ReadCatalog(new URL('../apps/rehabtrainerhub/games/', import.meta.url));
  const games = MergeHubGames(catalog(...ids(official)), catalog('community-z', 'community-a', official[0].id));
  assert.ok(games.length > lobbyResults.lobbyPageSize);
  for (const history of [[], [summary('unknown', 50)]]) {
    const ordered = OrderLobbyGames(games, history, { unknown: { [games[0].id]: 1 } });
    assert.equal(ordered.games, games);
    assert.equal(JSON.stringify(ids(ordered.games)), JSON.stringify(ids(games)));
    assert.equal(ordered.cues.size, 0);
  }
});

test('played games sort by count then recency then catalog order and unplayed games keep catalog order', async () => {
  const { OrderLobbyGames } = await ranking();
  const games = catalog('rest-z', 'd', 'c', 'b', 'a', 'rest-a');
  const ordered = OrderLobbyGames(games, [
    summary('a', 5), summary('b', 2, 3), summary('c', 2, 3), summary('d', 2, 2), summary('unknown', 100),
  ], {});
  assert.deepEqual(ids(ordered.games), ['a', 'c', 'b', 'd', 'rest-z', 'rest-a']);
  assert.deepEqual([...ordered.cues], ['a', 'c', 'b', 'd'].map(id => [id, { tier: 'played' }]));
});

test('similar games use the raw threshold and highest rank-weighted score with catalog order for ties', async () => {
  const { lobbySimilarityThreshold, OrderLobbyGames } = await ranking();
  const games = catalog('below', 'tie-z', 'fourth', 'threshold', 'tie-a', 'third', 'second', 'first', 'e', 'd', 'c', 'b', 'a', 'rest');
  const ordered = OrderLobbyGames(games, ['a', 'b', 'c', 'd', 'e'].map((id, i) => summary(id, 5 - i)), {
    a: { first: 0.9, second: 0.65, below: lobbySimilarityThreshold - 0.001, 'tie-a': 0.55, 'tie-z': 0.55 },
    b: { second: 0.8 },
    c: { third: 0.9 },
    d: { fourth: 1 },
    e: { threshold: lobbySimilarityThreshold },
  });
  assert.deepEqual(ids(ordered.games), ['a', 'b', 'c', 'd', 'e', 'first', 'second', 'third', 'fourth', 'tie-z', 'tie-a', 'threshold', 'below', 'rest']);
  for (const [id, reasonGameId, score] of [
    ['first', 'a', 0.9], ['second', 'b', 0.8 * 0.85], ['third', 'c', 0.9 * 0.7],
    ['fourth', 'd', 0.6], ['threshold', 'e', 0.5 * 0.6],
  ]) assert.deepEqual(ordered.cues.get(id), { tier: 'similar', reasonGameId, score });
});

test('lobby pagination slices the ordered list', async () => {
  const { OrderLobbyGames } = await ranking();
  const firstPageIds = Array.from({ length: lobbyResults.lobbyPageSize }, (_, i) => `game-${i}`);
  const games = catalog(...firstPageIds, 'similar', 'played');
  const ordered = OrderLobbyGames(games, [summary('played', 1)], { similar: { played: 0.6 } });
  assert.deepEqual(ids(lobbyResults.PaginateLobbyGames(ordered.games, 1).items), ['played', 'similar', ...firstPageIds.slice(0, -2)]);
  assert.deepEqual(ids(lobbyResults.PaginateLobbyGames(ordered.games, 2).items), firstPageIds.slice(-2));
});

test('guest activity history stores only ids and times, newest first and capped at 200 events', async () => {
  const { PublishLobbyActivity, ReadGuestLobbyHistory, SummarizeGuestLobbyHistory, guestLobbyHistoryKey, lobbyActivitySavedEvent } = await history();
  const device = Device();
  const plays = Array.from({ length: 203 }, (_, i) => activity(i % 2 ? 'a' : 'b', i + 1));
  let events = 0;
  device.addEventListener(lobbyActivitySavedEvent, () => events++);
  device.localStorage.setItem(guestLobbyHistoryKey, JSON.stringify(plays.slice(0, -1).map(play => ({ ...play, score: 99, subjectId: 'private' }))));
  PublishLobbyActivity(device, 'b', plays.at(-1).playedAt, true);
  const stored = JSON.parse(device.localStorage.getItem(guestLobbyHistoryKey));
  const expected = plays.slice(-200).reverse();
  assert.deepEqual(stored, expected);
  assert.deepEqual(ReadGuestLobbyHistory(device, new Set(['a', 'b'])), expected);
  assert.deepEqual(SummarizeGuestLobbyHistory(expected), [summary('b', 100, 203), summary('a', 100, 202)]);
  assert.equal(events, 1);
});

test('old deduped guest history reads as one event per activity and keeps repeats after a save', async () => {
  const { PublishLobbyActivity, ReadGuestLobbyHistory, guestLobbyHistoryKey } = await history();
  const oldHistory = [activity('a', 2), activity('b')];
  const device = Device([[guestLobbyHistoryKey, JSON.stringify(oldHistory)]]);
  const known = new Set(['a', 'b']);
  assert.deepEqual(ReadGuestLobbyHistory(device, known), oldHistory);
  PublishLobbyActivity(device, 'a', activity('a', 3).playedAt, true);
  assert.deepEqual(ReadGuestLobbyHistory(device, known), [activity('a', 3), ...oldHistory]);
});

test('guest activity history drops malformed or unknown ids and tolerates unavailable storage', async () => {
  const { PublishLobbyActivity, ReadGuestLobbyHistory, guestLobbyHistoryKey } = await history();
  const known = new Set(['known', 'other']);
  for (const raw of ['{broken', '[null, 2, {}, {"gameId":"known","playedAt":"yesterday"}]', '{}']) {
    assert.deepEqual(ReadGuestLobbyHistory(Device([[guestLobbyHistoryKey, raw]]), known), []);
  }
  const device = Device([[guestLobbyHistoryKey, JSON.stringify([
    activity('known'), activity('missing', 5), activity('other', 2), activity('known', 4),
    { gameId: 'known', playedAt: '1' },
    { gameId: 'known', playedAt: '2026-02-30T01:00:00Z' },
  ])]]);
  assert.deepEqual(ReadGuestLobbyHistory(device, known), [activity('known', 4), activity('other', 2), activity('known')]);
  const denied = () => { throw new Error('Storage denied'); };
  for (const unavailable of [Object.defineProperty(Device(), 'localStorage', { get: denied }),
    Object.assign(Device(), { localStorage: { getItem: denied, setItem: denied } }),
    Object.assign(Device(), { localStorage: { getItem: () => null, setItem: denied } })]) {
    assert.deepEqual(ReadGuestLobbyHistory(unavailable, known), []);
    assert.doesNotThrow(() => PublishLobbyActivity(unavailable, 'known', activity('known').playedAt, true));
  }
});

test('signed-in saves notify the lobby without reading or writing guest history', async () => {
  const { PublishLobbyActivity, lobbyActivitySavedEvent } = await history();
  let accesses = 0;
  let events = 0;
  const device = Object.defineProperty(Device(), 'localStorage', { get() { accesses++; } });
  device.addEventListener(lobbyActivitySavedEvent, () => events++);
  PublishLobbyActivity(device, 'signed-in', activity('signed-in').playedAt, false);
  assert.equal(accesses, 0);
  assert.equal(events, 1);
});

test('account play summaries require valid ids, counts and timestamps', async () => {
  const { NormalizeLobbyPlayCounts } = await history();
  assert.deepEqual(NormalizeLobbyPlayCounts(undefined), []);
  assert.deepEqual(NormalizeLobbyPlayCounts([
    null, summary('valid', 4), summary('valid', 12), summary('invalid id', 1), summary('zero', 0), summary('fraction', 1.5),
    summary('string', '2'), summary('overflow', Number.MAX_SAFE_INTEGER + 1),
    { gameId: 'bad-date', count: 1, lastPlayedAt: '2026-02-30T09:00:00Z' },
    { gameId: 'sqlite', count: 2, lastPlayedAt: '2026-01-01 01:02:03', private: 'discard' },
  ]), [summary('valid', 4), { gameId: 'sqlite', count: 2, lastPlayedAt: '2026-01-01T01:02:03.000Z' }]);
});

test('lobby ordering dictionaries explain both cues without regulatory claims', async () => {
  const source = read('../../../scripts/check-repo-policies.test.mjs');
  const [, pattern, flags] = source.match(/^const strongClaims = \/(.+)\/([a-z]+);$/m);
  const strongClaims = new RegExp(pattern, flags.replace('g', ''));
  const banned = /治療|診斷|療效|改善|提升|處方|建議你|\b(?:treatment|diagnos\w*|efficacy|improv\w*|prescri\w*)\b/i;
  const { en } = await import('../apps/rehabtrainerhub/app/i18n/en.ts');
  const { zhTW } = await import('../apps/rehabtrainerhub/app/i18n/zh-TW.ts');
  assert.equal(en.hubUi.lobby.personalOrder.note,
    "Activities you played most appear first, followed by activities with similar content. This is not a personal assessment or practice advice.");
  assert.equal(zhTW.hubUi.lobby.personalOrder.note, '依你玩過的次數排序，之後是內容相近的活動；不是個人評估或練習建議。');
  assert.equal(en.hubUi.lobby.personalOrder.played, 'Played often');
  assert.equal(zhTW.hubUi.lobby.personalOrder.played, '常玩');
  for (const dictionary of [en, zhTW]) {
    const copy = dictionary.hubUi.lobby.personalOrder;
    assert.match(copy.similar, /\{activity\}/);
    for (const value of Object.values(copy)) {
      assert.doesNotMatch(value, strongClaims);
      assert.doesNotMatch(value, banned);
      assert.doesNotMatch(value, /\u2014/);
    }
  }
});

test('lobby cards keep their personal order and launch action during search and purpose filtering', async () => {
  const { en } = await import('../apps/rehabtrainerhub/app/i18n/en.ts');
  const theme = { icon: { type: 'symbol', value: 'info' }, label: { en: 'Attention' } };
  const games = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, title: `${id === 'b' ? 'Other' : 'Activity'} ${id}`, summary: '', imageSrc: '/preview.png', theme,
    categoryLabel: 'Cognition', subcategoryLabel: 'Attention', purpose: id === 'b' ? null : 'attention', requirement: 'none',
    launch: { contract: 'catalog-v1', module: { runtimeId: id, href: `/train/?game=${i}` } } }));
  let playCounts = [summary('a', 2), summary('d', 3)];
  let hook = 0;
  const state = [];
  const overlay = () => {};
  const dependencies = {
    'react/jsx-runtime': jsx,
    react: { useState: initial => {
      const position = hook++;
      if (!(position in state)) state[position] = initial;
      return [state[position], update => { state[position] = typeof update === 'function' ? update(state[position]) : update; }];
    }, useEffect: () => {}, useCallback: fn => fn, useMemo: fn => fn(), useRef: current => ({ current }) },
    'react-dom': { flushSync: fn => fn() },
    './train/GameOverlay': { GameOverlay: overlay },
    './gameCatalog': { BuildHubGameCatalog: () => games },
    './activityLinks': await import('../apps/rehabtrainerhub/app/activityLinks.ts'),
    '@rehab-trainer/hub-modules/catalog': { trainingCatalog: [], trainingPurposes: [{ id: 'attention' }],
      trainingThemes: { attention: theme }, trainerCategoryTags: [{ id: 'cognition', label: { en: 'Cognition' } }],
      categorySubcategories: { cognition: ['attention'] }, GetTrainerCategoryTheme: () => theme },
    '@rehab-trainer/ui/hooks/useBottomSheet': { useBottomSheet: () => ({}) },
    './i18n': { GetHubUiCopy: () => en.hubUi },
    './i18n/HubLanguage': { useHubLanguage: () => ({ language: 'en', locale: 'en', t: (key, values) => (
      key === 'lobby.personalOrder.similar' ? en.hubUi.lobby.personalOrder.similar.replace('{activity}', values.activity) : key
    ) }) },
    './trainingThemeStyle': { BuildTrainingThemeStyle: () => ({}) },
    './lobbyResults.js': lobbyResults,
    './lobbyRecommendations.js': await ranking(),
    './useLobbyActivityHistory': { useLobbyActivityHistory: () => playCounts },
    './hubMotion': { TransitionGameSurface: (_element, update) => update() },
    '../recommendation/generated/featureIndex.json': { similarityScores: { a: { b: 0.9, c: 0.8 } } },
  };
  const { outputText } = ts.transpileModule(read('TrainingLobby.tsx'), { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } });
  const exports = {};
  new Function('exports', 'require', 'document', outputText)(exports, name => dependencies[name] ?? {}, { querySelector: () => null });

  function Find(predicate) {
    hook = 0;
    const visit = node => {
      if (Array.isArray(node)) return node.map(visit).find(Boolean);
      if (!node?.props) return undefined;
      return predicate(node) ? node : visit(node.props.children);
    };
    return visit(exports.TrainingLobby())?.props;
  }

  const cards = () => Find(node => node.props.className === 'module-grid').children;
  const note = () => Find(node => node.props.className === 'lobby-order-note')?.children;
  const cue = () => Find(node => node.props.className === 'module-card-order-cue')?.children;
  const cardIds = () => cards().map(card => card.props['data-runtime-id']);
  const click = { currentTarget: { closest: () => null } };
  assert.deepEqual(cardIds(), ['d', 'a', 'b', 'c']);
  assert.equal(note(), en.hubUi.lobby.personalOrder.note);
  assert.equal(cue(), 'Played often');
  assert.equal(Find(node => node.props.className === 'lobby-recommendations'), undefined);

  const search = () => Find(node => node.props.id === 'module-search-input');
  search().onChange({ target: { value: 'Activity' } });
  assert.deepEqual(cardIds(), ['d', 'a', 'c']);
  assert.ok(Find(node => node.props.className === 'module-card-order-cue' && node.props.children === 'Similar to Activity a'));
  Find(node => node.type === 'button' && node.props['aria-label'] === `${en.hubUi.lobby.start}: ${games[2].title}`).onClick(click);
  assert.equal(Find(node => node.type === overlay).game, games[2]);

  search().onChange({ target: { value: '' } });
  Find(node => node.type === 'input' && node.props.type === 'checkbox').onChange();
  assert.deepEqual(cardIds(), ['d', 'a', 'c']);
  Find(node => node.type === 'input' && node.props.type === 'checkbox').onChange();
  playCounts = [];
  assert.equal(note(), undefined);
  assert.equal(cue(), undefined);
  assert.deepEqual(cardIds(), ids(games));
});
