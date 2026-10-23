import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, FakeClock, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'hex-schulte';

test('hex Schulte settings default to two rings with centre checks and reject values outside each range', async () => {
  const { defaultSettings, ValidateSettings } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { rings: 2, rounds: 3, centerChecks: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  for (const change of [{ rings: 3 }, { rounds: 1 }, { rounds: 5 }, { centerChecks: false }]) assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true);
  for (const change of [{ rings: 1 }, { rings: 4 }, { rounds: 0 }, { rounds: 6 }, { rounds: 2.5 }, { centerChecks: 'yes' }, { rings: '2' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('the board places one number in every hexagon around the centre', async () => {
  const { CreateHexBoard, CreateRandom } = await LoadGameModule(gameId, 'logic/hexBoard.ts');
  for (const [rings, count] of [[2, 18], [3, 36]]) {
    const board = CreateHexBoard(rings, CreateRandom(rings));
    assert.equal(board.length, count);
    assert.deepEqual(board.map(cell => cell.value).sort((a, b) => a - b), Array.from({ length: count }, (_, index) => index + 1));
    const keys = new Set(board.map(cell => `${cell.q},${cell.r}`));
    assert.equal(keys.size, count, 'No two numbers share a hexagon.');
    assert.ok(!keys.has('0,0'), 'The centre stays free for the fixation mark.');
    assert.ok(board.every(cell => Math.max(Math.abs(cell.q), Math.abs(cell.r), Math.abs(cell.q + cell.r)) <= rings));
    assert.deepEqual(CreateHexBoard(rings, CreateRandom(rings)), board);
  }
});

test('a round takes numbers in ascending order and counts wrong taps', async () => {
  const { OrderedSearch } = await LoadGameModule(gameId, 'logic/hexBoard.ts');
  const search = new OrderedSearch(3, 0);
  assert.deepEqual(search.tap(2, 100), { correct: false, done: false });
  assert.deepEqual(search.tap(1, 300), { correct: true, done: false });
  assert.deepEqual(search.tap(1, 350), { correct: false, done: false, ignored: true });
  search.tap(2, 600);
  assert.deepEqual(search.tap(3, 900), { correct: true, done: true });
  assert.deepEqual(search.result(), { timeMs: 900, errors: 1 });
});

test('centre checks appear at spaced, seeded times and count hits and misses', async () => {
  const { CenterChecks } = await LoadGameModule(gameId, 'logic/centerChecks.ts');
  const clock = FakeClock();
  const events = [];
  const checks = new CenterChecks({ minGapMs: 4000, maxGapMs: 4000, windowMs: 1500 }, clock, () => .5,
    { show: () => events.push(['show', clock.now()]), hide: hit => events.push([hit ? 'hit' : 'miss', clock.now()]) });
  checks.start();
  assert.equal(checks.respond(), false, 'A tap with no check showing is not counted.');
  clock.advance(4000);
  clock.advance(700);
  assert.equal(checks.respond(), true);
  clock.advance(4000 + 1500);
  checks.stop();
  clock.advance(10000);
  assert.deepEqual(events, [['show', 4000], ['hit', 4700], ['show', 8700], ['miss', 10200]]);
  assert.deepEqual(checks.counts(), { shown: 2, hits: 1, missed: 1 });
  assert.equal(clock.pending(), 0);
});

test('the summary totals round times, errors and centre checks', async () => {
  const { SummarizeHex } = await LoadGameModule(gameId, 'logic/hexBoard.ts');
  const rows = [{ round: 1, rings: 2, timeMs: 20000, errors: 1, centerChecks: 3, centerHits: 3, centerMissed: 0 },
    { round: 2, rings: 2, timeMs: 16000, errors: 0, centerChecks: 2, centerHits: 1, centerMissed: 1 }];
  assert.deepEqual(SummarizeHex(rows, 3), { roundsPlanned: 3, roundsCompleted: 2, rings: 2, totalTimeMs: 36000, meanRoundMs: 18000,
    bestRoundMs: 16000, totalErrors: 1, centerChecks: 5, centerHits: 4, centerHitPercent: 80 });
  assert.deepEqual(SummarizeHex([], 2), { roundsPlanned: 2, roundsCompleted: 0, rings: null, totalTimeMs: 0, meanRoundMs: null,
    bestRoundMs: null, totalErrors: 0, centerChecks: 0, centerHits: 0, centerHitPercent: null });
});

test('hex Schulte results save bounded numeric rows through the private channel', async () => {
  const logic = await LoadGameModule(gameId, 'logic/hexBoard.ts');
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/hexBoard': logic });
  const row = { round: 1, rings: 3, timeMs: 30000, errors: 2, centerChecks: 4, centerHits: 3, centerMissed: 1 };
  const score = BuildGameScore([row], 1);
  assert.deepEqual(score.rounds, [row]);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, { rings: 3, rounds: 1, centerChecks: true }, score));
});

test('hex Schulte owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'HexSchulteGame', category: 'attention', version: '1.0.1' });
});

test('hex Schulte private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
