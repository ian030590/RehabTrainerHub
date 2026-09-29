import assert from 'node:assert/strict';
import test from 'node:test';
import { ParseThirdPartyScore, ProjectThirdPartyScore } from './thirdPartyScore.js';

const definition = {
  schema: 'rehab-trainer.game-score/v1', gameId: 'sample-game',
  presentation: { primarySummaryKeys: ['accuracy'], qualitySummaryKeys: [],
    defaultRoundMetricKey: 'correct', chartType: 'bar' },
  columns: [{ key: 'correct', label: { zh: '正確', en: 'Correct' }, sources: ['correct'] }],
  summary: [{ key: 'accuracy', label: { zh: '正確率', en: 'Accuracy' }, sources: ['accuracy'], unit: '%' }],
};

test('native score projects declared numeric and Boolean results including partial runs', () => {
  const parsed = ParseThirdPartyScore(definition, 'sample-game');
  assert.deepEqual(ProjectThirdPartyScore(parsed, { accuracy: 50 }, [{ correct: true }, { correct: null }]), {
    schema: definition.schema, gameId: 'sample-game', rounds: [{ correct: 1 }, { correct: null }], summary: { accuracy: 50 },
  });
});

test('native score rejects undeclared result fields and mismatched game IDs', () => {
  assert.throws(() => ParseThirdPartyScore(definition, 'another-game'));
  assert.throws(() => ProjectThirdPartyScore(definition, { accuracy: 50, patientId: 4 }, [{ correct: 1 }]));
  assert.throws(() => ProjectThirdPartyScore(definition, { accuracy: 50 }, [{ correct: 1, extra: 2 }]));
});
