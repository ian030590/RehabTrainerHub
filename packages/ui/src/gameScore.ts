export interface ScoreField {
  key: string;
  label: { zh: string; en: string };
  sources: string[];
  unit?: string;
  total?: 'sum' | 'last';
}

export type ScoreChartType = 'line' | 'bar';

export interface ScorePresentation {
  primarySummaryKeys: string[];
  qualitySummaryKeys: string[];
  defaultRoundMetricKey: string;
  chartType: ScoreChartType;
}

export interface GameScoreDefinition {
  schema: 'rehab-trainer.game-score/v1';
  gameId: string;
  presentation: ScorePresentation;
  columns: ScoreField[];
  summary: ScoreField[];
}

export interface GameScore {
  schema: 'rehab-trainer.game-score/v1';
  gameId: string;
  rounds: Record<string, number | null>[];
  summary: Record<string, number | null>;
}

const safeKey = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;
const sensitiveKey = /(auth|email|jwt|name|password|token|user|participant|secret|cookie)/i;

function HasExactKeys(value: unknown, expectedKeys: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

export function ParseGameScoreDefinition(value: unknown, gameId?: string): GameScoreDefinition {
  const definition = value as GameScoreDefinition;
  if (!HasExactKeys(definition, ['schema', 'gameId', 'presentation', 'columns', 'summary'])
    || definition.schema !== 'rehab-trainer.game-score/v1'
    || typeof definition.gameId !== 'string' || !/^[a-z0-9-]{1,80}$/.test(definition.gameId)
    || (gameId && definition.gameId !== gameId)) throw new TypeError('Invalid score.json.');
  for (const fields of [definition.columns, definition.summary]) {
    if (!Array.isArray(fields) || fields.length < 1 || fields.length > 12
      || new Set(fields.map(field => field?.key)).size !== fields.length
      || fields.some(field => !field
        || !HasExactKeys(field, ['key', 'label', 'sources', ...(field.unit === undefined ? [] : ['unit']), ...(field.total === undefined ? [] : ['total'])])
        || !safeKey.test(field.key) || sensitiveKey.test(field.key)
        || !HasExactKeys(field.label, ['zh', 'en'])
        || !['zh', 'en'].every(lang => typeof field.label[lang as 'zh' | 'en'] === 'string' && field.label[lang as 'zh' | 'en'].length <= 80)
        || (field.unit !== undefined && (typeof field.unit !== 'string' || field.unit.length > 12))
        || (field.total !== undefined && field.total !== 'sum' && field.total !== 'last')
        || !Array.isArray(field.sources) || field.sources.length > 16
        || field.sources.some(source => typeof source !== 'string' || !safeKey.test(source) || sensitiveKey.test(source)))) {
      throw new TypeError('Invalid score fields.');
    }
  }
  const presentation = definition.presentation;
  const expectedPresentationKeys = ['chartType', 'defaultRoundMetricKey', 'primarySummaryKeys', 'qualitySummaryKeys'];
  const summaryKeys = new Set(definition.summary.map(field => field.key));
  const columnKeys = new Set(definition.columns.map(field => field.key));
  if (!HasExactKeys(presentation, expectedPresentationKeys)
    || !Array.isArray(presentation.primarySummaryKeys)
    || presentation.primarySummaryKeys.length < 1
    || presentation.primarySummaryKeys.length > 4
    || new Set(presentation.primarySummaryKeys).size !== presentation.primarySummaryKeys.length
    || presentation.primarySummaryKeys.some(key => !summaryKeys.has(key))
    || !Array.isArray(presentation.qualitySummaryKeys)
    || presentation.qualitySummaryKeys.length > 4
    || new Set(presentation.qualitySummaryKeys).size !== presentation.qualitySummaryKeys.length
    || presentation.qualitySummaryKeys.some(key => !summaryKeys.has(key) || presentation.primarySummaryKeys.includes(key))
    || !columnKeys.has(presentation.defaultRoundMetricKey)
    || !['line', 'bar'].includes(presentation.chartType)) {
    throw new TypeError('Invalid score presentation.');
  }
  return definition;
}

export function BuildGameScore(definition: GameScoreDefinition, record: {
  details?: Record<string, unknown>; detailRows?: Record<string, unknown>[]; results?: unknown[];
}): GameScore {
  const details = record.details ?? {};
  const rows = record.detailRows ?? record.results ?? [details];
  const read = (row: unknown, field: ScoreField): number | null => {
    if (!row || typeof row !== 'object') return null;
    for (const source of field.sources) {
      const value = (row as Record<string, unknown>)[source];
      if (typeof value === 'boolean') return Number(value);
      if (typeof value === 'number' && Number.isFinite(value)) return value;
    }
    return null;
  };
  const rounds = rows.map(row => Object.fromEntries(definition.columns.map(field => [field.key, read(row, field)])))
    .filter(row => Object.values(row).some(value => value !== null));
  const summary = Object.fromEntries(definition.summary.map(field => [field.key, read(details, field)]));
  const score = { schema: definition.schema, gameId: definition.gameId, rounds, summary };
  if (!IsGameScore(score, definition)) throw new TypeError('Game score exceeds supported limits.');
  return score;
}

export function IsGameScore(value: unknown, definition: GameScoreDefinition): value is GameScore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const score = value as GameScore;
  const rowMatches = (row: unknown, fields: ScoreField[]) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
    const entries = Object.entries(row);
    return entries.length === fields.length && entries.every(([key, number]) => fields.some(field => field.key === key)
      && (number === null || (typeof number === 'number' && Number.isFinite(number) && Math.abs(number) <= 1e12)));
  };
  return Object.keys(score).length === 4 && score.schema === definition.schema && score.gameId === definition.gameId
    && Array.isArray(score.rounds) && score.rounds.length <= 4000
    && score.rounds.every(row => rowMatches(row, definition.columns)) && rowMatches(score.summary, definition.summary)
    && new TextEncoder().encode(JSON.stringify(score)).length <= 450 * 1024;
}
