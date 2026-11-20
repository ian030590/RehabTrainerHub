import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as jsx from 'react/jsx-runtime';
import ts from 'typescript';
import * as lobbyResults from '../apps/rehabtrainerhub/app/lobbyResults.js';

const app = new URL('../apps/rehabtrainerhub/app/', import.meta.url);
const read = path => readFileSync(new URL(path, app), 'utf8');
const ranking = () => import('../apps/rehabtrainerhub/app/lobbyRecommendations.js');
const history = () => import('../apps/rehabtrainerhub/app/lobbyActivityHistory.js');
const activity = (gameId, day = 1) => ({ gameId, playedAt: new Date(Date.UTC(2026, 0, day)).toISOString() });
const index = (games, similarityScores) => ({ games: Object.fromEntries(games.map(id => [id, {}])), similarityScores });

function Device(initial) {
  const values = new Map(initial);
  const device = new EventTarget();
  device.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  return device;
}

test('lobby ranking requires history and excludes recent or unavailable games', async () => {
  const { RankLobbyRecommendations } = await ranking();
  const features = index(['a', 'b', 'c', 'd', 'e', 'f'], { a: { b: 1, c: 0.9, d: 0.8, e: 0.7, f: 0.6 } });
  assert.deepEqual(RankLobbyRecommendations([], features, ['a', 'd', 'e']), []);
  assert.deepEqual(RankLobbyRecommendations([activity('unknown', 7), activity('b', 5), activity('b', 4),
    activity('c', 3), activity('a', 6), activity('d', 2)], features, ['a', 'b', 'c', 'd', 'f'])
    .map(({ gameId }) => gameId), ['d', 'f']);
});

test('lobby ranking weights the three distinct recencies and applies the minimum raw similarity', async () => {
  const { lobbySimilarityThreshold, RankLobbyRecommendations } = await ranking();
  const features = index(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'], {
    a: { d: 0.62, e: 0.7, g: lobbySimilarityThreshold - 0.001, h: lobbySimilarityThreshold },
    b: { d: 0.8, e: 0.81 }, c: { f: 0.89, i: 0.7 },
  });
  const results = RankLobbyRecommendations([activity('c', 1), activity('a', 3), activity('b', 2)], features,
    ['d', 'e', 'f', 'g', 'h', 'i']);
  assert.deepEqual(results.map(({ gameId, reasonGameId }) => [gameId, reasonGameId]),
    [['e', 'a'], ['d', 'b'], ['f', 'c'], ['h', 'a']]);
  assert.equal(results[1].score, 0.8 * 0.85);
  assert.equal(results[2].score, 0.89 * 0.7);
  assert.deepEqual(RankLobbyRecommendations([activity('c')], features, ['i'])
    .map(({ gameId }) => gameId), ['i']);
  assert.deepEqual(RankLobbyRecommendations([activity('a')], features, ['g']), []);
});

test('lobby ranking uses catalog order for score ties and returns at most four games', async () => {
  const { RankLobbyRecommendations } = await ranking();
  const features = index(['a', 'b', 'c', 'd', 'e', 'f', 'z'], { z: { a: 0.8, b: 0.8, c: 0.9, d: 0.8, e: 0.8, f: 0.8 } });
  for (const iteration of [features, { ...features, similarityScores: { a: { z: 0.8 }, b: { z: 0.8 },
    c: { z: 0.9 }, d: { z: 0.8 }, e: { z: 0.8 }, f: { z: 0.8 } } }]) {
    assert.deepEqual(RankLobbyRecommendations([activity('z')], iteration, ['f', 'e', 'd', 'c', 'b', 'a'])
      .map(({ gameId }) => gameId), ['c', 'f', 'e', 'd']);
  }
});

test('guest activity history stores only ids and times, newest first and capped at twenty distinct games', async () => {
  const { PublishLobbyActivity, ReadGuestLobbyHistory, guestLobbyHistoryKey, lobbyActivitySavedEvent } = await history();
  const device = Device();
  const ids = Array.from({ length: 23 }, (_, i) => `game-${i}`);
  let events = 0;
  device.addEventListener(lobbyActivitySavedEvent, () => events++);
  device.localStorage.setItem(guestLobbyHistoryKey, JSON.stringify([{ ...activity(ids[0]), score: 99, subjectId: 'private' }]));
  for (const [i, id] of ids.entries()) PublishLobbyActivity(device, id, activity(id, i + 1).playedAt, true);
  const recent = activity(ids[5], 30);
  PublishLobbyActivity(device, recent.gameId, recent.playedAt, true);
  const stored = JSON.parse(device.localStorage.getItem(guestLobbyHistoryKey));
  const expected = [recent, ...ids.slice(3).reverse().filter(id => id !== recent.gameId).map(id => activity(id, ids.indexOf(id) + 1))];
  assert.deepEqual(stored, expected);
  assert.deepEqual(ReadGuestLobbyHistory(device, new Set(ids)), expected);
  assert.equal(events, 24);
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
  assert.deepEqual(ReadGuestLobbyHistory(device, known), [activity('known', 4), activity('other', 2)]);
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

test('lobby recommendation dictionaries state the content-similarity limits without regulatory claims', async () => {
  const source = read('../../../scripts/check-repo-policies.test.mjs');
  const [, pattern, flags] = source.match(/^const strongClaims = \/(.+)\/([a-z]+);$/m);
  const strongClaims = new RegExp(pattern, flags.replace('g', ''));
  const banned = /治療|診斷|療效|改善|提升|處方|建議你|\b(?:treatment|diagnos\w*|efficacy|improv\w*|prescri\w*)\b/i;
  const { en } = await import('../apps/rehabtrainerhub/app/i18n/en.ts');
  const { zhTW } = await import('../apps/rehabtrainerhub/app/i18n/zh-TW.ts');
  assert.equal(en.hubUi.lobby.recommendations.note,
    "Ordered by how similar the activities' content is; not a personal assessment or practice advice.");
  assert.equal(zhTW.hubUi.lobby.recommendations.note, '依活動內容的相似程度排列，不是個人評估或練習建議。');
  for (const dictionary of [en, zhTW]) {
    const copy = dictionary.hubUi.lobby.recommendations;
    assert.match(copy.reason, /\{activity\}/);
    for (const value of Object.values(copy)) {
      assert.doesNotMatch(value, strongClaims);
      assert.doesNotMatch(value, banned);
    }
  }
});

test('lobby recommendations hide during search or purpose filtering and use the lobby card launch', async () => {
  const { en } = await import('../apps/rehabtrainerhub/app/i18n/en.ts');
  const theme = { icon: { type: 'symbol', value: 'info' }, label: { en: 'Attention' } };
  const games = ['a', 'b'].map((id, i) => ({ id, title: `Activity ${id}`, summary: '', imageSrc: '/preview.png', theme,
    categoryLabel: 'Cognition', subcategoryLabel: 'Attention', purpose: 'attention', requirement: 'none',
    launch: { contract: 'catalog-v1', module: { runtimeId: id, href: `/train/?game=${i}` } } }));
  let recent = [activity('a')];
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
    '@rehab-trainer/hub-modules/catalog': { trainingCatalog: [], trainingPurposes: [{ id: 'attention' }],
      trainingThemes: { attention: theme }, trainerCategoryTags: [{ id: 'cognition', label: { en: 'Cognition' } }],
      categorySubcategories: { cognition: ['attention'] }, GetTrainerCategoryTheme: () => theme },
    '@rehab-trainer/ui/hooks/useBottomSheet': { useBottomSheet: () => ({}) },
    './i18n': { GetHubUiCopy: () => en.hubUi },
    './i18n/HubLanguage': { useHubLanguage: () => ({ language: 'en', locale: 'en', t: key => key }) },
    './trainingThemeStyle': { BuildTrainingThemeStyle: () => ({}) },
    './lobbyResults.js': lobbyResults,
    './lobbyRecommendations.js': await ranking(),
    './useLobbyActivityHistory': { useLobbyActivityHistory: () => recent },
    './hubMotion': { TransitionGameSurface: (_element, update) => update() },
    '../recommendation/generated/featureIndex.json': index(['a', 'b'], { a: { b: 0.9 } }),
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

  const recommendation = () => Find(node => node.props['data-recommendation-id'] === 'b');
  const section = () => Find(node => node.props.className === 'lobby-recommendations');
  const click = { currentTarget: { closest: () => null } };
  recommendation().onClick(click);
  assert.equal(Find(node => node.type === overlay).game, games[1]);

  const search = () => Find(node => node.props.id === 'module-search-input');
  search().onChange({ target: { value: games[1].title } });
  assert.equal(section(), undefined);
  Find(node => node.type === 'button' && node.props['aria-label'] === `${en.hubUi.lobby.start}: ${games[1].title}`).onClick(click);
  assert.equal(Find(node => node.type === overlay).game, games[1]);

  search().onChange({ target: { value: '' } });
  assert.ok(section());
  Find(node => node.type === 'input' && node.props.type === 'checkbox').onChange();
  assert.equal(section(), undefined);
  Find(node => node.type === 'input' && node.props.type === 'checkbox').onChange();
  assert.ok(section());
  recent = [];
  assert.equal(section(), undefined);
});
