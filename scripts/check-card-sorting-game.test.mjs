import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'card-sorting';
const LoadLogic = async () => LoadGameModule(gameId, 'logic/cardSorting.ts');

test('card sorting settings default to six categories of six and reject values outside each range', async () => {
  const { defaultSettings, ValidateSettings } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { runLength: 6, categories: 6, maxCards: 72 });
  assert.equal(ValidateSettings(defaultSettings), true);
  for (const change of [{ runLength: 10 }, { categories: 3 }, { maxCards: 48 }, { maxCards: 96 }]) assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true);
  for (const change of [{ runLength: 5 }, { runLength: 11 }, { categories: 2 }, { categories: 7 }, { maxCards: 24 }, { maxCards: 60 }, { maxCards: 120 },
    { runLength: '6' }, { categories: 4.5 }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('every card in the deck matches each key card on at most one feature, so each sort has a single meaning', async () => {
  const { CreateCardDeck, CreateRandom, keyCards, MatchedDimension } = await LoadLogic();
  const deck = CreateCardDeck(72, CreateRandom(3));
  assert.equal(deck.length, 72);
  assert.deepEqual(CreateCardDeck(72, CreateRandom(3)), deck, 'The same seed repeats the deck.');
  const unique = new Set(deck.map(card => `${card.color}-${card.shape}-${card.count}`));
  assert.equal(unique.size, 24, 'The 24 cards that share at most one feature with every key card.');
  for (const card of deck) {
    for (const key of keyCards) {
      const shared = ['color', 'shape', 'count'].filter(feature => card[feature] === key[feature]);
      assert.ok(shared.length <= 1, JSON.stringify(card));
      assert.equal(MatchedDimension(card, key), shared[0] ?? null);
    }
  }
  for (let index = 1; index < deck.length; index++) assert.notDeepEqual(deck[index], deck[index - 1], 'The same card never shows twice in a row.');
  for (let block = 0; block < 3; block++) assert.equal(new Set(deck.slice(block * 24, block * 24 + 24).map(card => `${card.color}-${card.shape}-${card.count}`)).size, 24);
});

test('the rule moves from colour to shape to number after the set number of correct sorts in a row', async () => {
  const { CardSorting, keyCards } = await LoadLogic();
  const sorting = new CardSorting({ runLength: 2, categories: 4, maxCards: 48 });
  const keyFor = (card, dimension) => keyCards.findIndex(key => key[dimension] === card[dimension]);
  const card = { color: 'red', shape: 'star', count: 3 };
  assert.equal(sorting.rule, 'color');
  assert.deepEqual(sorting.sort(card, keyFor(card, 'shape')), { correct: false, perseverative: false, categoryComplete: false, finished: false });
  assert.deepEqual(sorting.sort(card, keyFor(card, 'color')), { correct: true, perseverative: false, categoryComplete: false, finished: false });
  assert.deepEqual(sorting.sort(card, keyFor(card, 'color')), { correct: true, perseverative: false, categoryComplete: true, finished: false });
  assert.equal(sorting.rule, 'shape');
  // Staying with colour after the change counts as a perseverative error; number is a plain error.
  assert.deepEqual(sorting.sort(card, keyFor(card, 'color')), { correct: false, perseverative: true, categoryComplete: false, finished: false });
  assert.deepEqual(sorting.sort(card, keyFor(card, 'count')), { correct: false, perseverative: false, categoryComplete: false, finished: false });
  sorting.sort(card, keyFor(card, 'shape'));
  sorting.sort(card, keyFor(card, 'shape'));
  assert.equal(sorting.rule, 'count');
  sorting.sort(card, keyFor(card, 'count'));
  sorting.sort(card, keyFor(card, 'count'));
  assert.equal(sorting.rule, 'color', 'After number the order starts again with colour.');
  sorting.sort(card, keyFor(card, 'color'));
  assert.deepEqual(sorting.sort(card, keyFor(card, 'color')), { correct: true, perseverative: false, categoryComplete: true, finished: true });
  assert.equal(sorting.categoriesCompleted, 4);
});

test('a card that matches no key card on the chosen pile is an error that repeats no rule', async () => {
  const { CardSorting, keyCards } = await LoadLogic();
  const sorting = new CardSorting({ runLength: 6, categories: 6, maxCards: 48 });
  const card = { color: 'red', shape: 'star', count: 3 };
  const unrelated = keyCards.findIndex(key => key.color !== card.color && key.shape !== card.shape && key.count !== card.count);
  assert.deepEqual(sorting.sort(card, unrelated), { correct: false, perseverative: false, categoryComplete: false, finished: false });
});

test('the summary counts categories, perseverative errors, cards to the first category and lapses after a long run', async () => {
  const { SummarizeSorting } = await LoadLogic();
  const row = (correct, perseverative = false, category = 1) => ({ trial: 0, rule: 0, cardColor: 0, cardShape: 0, cardCount: 1, chosen: 0,
    correct, perseverative, category, rtMs: 1000 });
  const rows = [row(false), row(true), row(true), row(true), row(true), row(true), row(true),
    row(false, true, 2), row(true, false, 2), row(true, false, 2), row(true, false, 2), row(true, false, 2), row(true, false, 2), row(false, false, 2), row(true, false, 2)];
  assert.deepEqual(SummarizeSorting(rows, { runLength: 6, categories: 6, maxCards: 72 }), {
    cardsUsed: 15, correct: 12, errors: 3, accuracyPercent: 80, categoriesCompleted: 1, perseverativeErrors: 1, nonPerseverativeErrors: 2,
    perseverativePercent: 6.7, cardsToFirstCategory: 7, failuresToMaintainSet: 1, meanRtMs: 1000 });
  assert.deepEqual(SummarizeSorting([], { runLength: 6, categories: 6, maxCards: 72 }), {
    cardsUsed: 0, correct: 0, errors: 0, accuracyPercent: null, categoriesCompleted: 0, perseverativeErrors: 0, nonPerseverativeErrors: 0,
    perseverativePercent: null, cardsToFirstCategory: null, failuresToMaintainSet: 0, meanRtMs: null });
});

test('card sorting results save bounded numeric rows through the private channel', async () => {
  const logic = await LoadLogic();
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/cardSorting': logic });
  const rows = [{ trial: 1, rule: 0, cardColor: 1, cardShape: 2, cardCount: 3, chosen: 1, correct: true, perseverative: false, category: 1, rtMs: 1500 }];
  const score = BuildGameScore(rows, { runLength: 6, categories: 6, maxCards: 72 });
  assert.deepEqual(score.rounds, [{ trial: 1, rule: 0, cardColor: 1, cardShape: 2, cardCount: 3, chosen: 1, correct: 1, perseverative: 0, category: 1, rtMs: 1500 }]);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, { runLength: 6, categories: 6, maxCards: 72 }, score));
});

test('card sorting owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'CardSortingGame', category: 'higher-cognition', version: '1.0.1' });
});

test('card sorting private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
