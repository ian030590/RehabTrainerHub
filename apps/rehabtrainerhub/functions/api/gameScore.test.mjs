import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { IsBoundedGameScoreRecord } from './records.js';

test('D1 score payload is bounded, numeric, and tied to its game', () => {
  const input = { appId: 'rehabtrainerhub', runtimeId: 'hub', record: {
    gameId: 'moving-card', moduleId: 'moving-card', score: {
      schema: 'rehab-trainer.game-score/v1', gameId: 'moving-card',
      rounds: [{ score: 0, responseMs: null }, { score: 1, responseMs: 250 }], summary: { total: 1 },
    },
  } };
  assert.equal(IsBoundedGameScoreRecord(input), true);
  const games = new URL('../../games/', import.meta.url);
  for (const entry of readdirSync(games, { withFileTypes: true }).filter(entry => entry.isDirectory())) {
    const settings = JSON.parse(readFileSync(new URL(`${entry.name}/settings.json`, games), 'utf8'));
    const config = Object.fromEntries(settings.sections.flatMap(section => section.fields.map(field => [field.key, field.default])));
    assert.equal(IsBoundedGameScoreRecord({ ...input, record: { ...input.record, config } }), true, entry.name);
  }
  for (const config of [{ authToken: 'secret' }, { value: Infinity }, { value: {} }, { value: 'x'.repeat(81) }, null]) {
    assert.equal(IsBoundedGameScoreRecord({ ...input, record: { ...input.record, config } }), false);
  }
  for (const change of [
    score => { score.gameId = 'different'; },
    score => { score.summary.authToken = 1; },
    score => { score.rounds[0].score = Infinity; },
    score => { score.rounds = Array(4001).fill({ score: 1 }); },
    score => { score.summary.total = '1'; },
    score => { score.extra = {}; },
  ]) {
    const invalid = structuredClone(input);
    change(invalid.record.score);
    assert.equal(IsBoundedGameScoreRecord(invalid), false);
  }
});
