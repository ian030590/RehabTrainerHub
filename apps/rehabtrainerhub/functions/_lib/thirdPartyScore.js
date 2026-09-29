const safeKey = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const sensitive = /(auth|email|jwt|name|password|token|user|participant|secret|cookie)/i;

export function ParseThirdPartyScore(value, gameId) {
  if (!exact(value, ['schema', 'gameId', 'presentation', 'columns', 'summary'])
    || value.schema !== 'rehab-trainer.game-score/v1' || value.gameId !== gameId) throw new TypeError('Invalid score.json.');
  for (const group of [value.columns, value.summary]) {
    if (!Array.isArray(group) || group.length < 1 || group.length > 12 || new Set(group.map(field => field?.key)).size !== group.length) {
      throw new TypeError('score.json must declare 1–12 unique fields per section.');
    }
    for (const field of group) {
      const keys = ['key', 'label', 'sources', ...(field?.unit === undefined ? [] : ['unit']), ...(field?.total === undefined ? [] : ['total'])];
      if (!exact(field, keys) || !safeKey.test(field.key) || sensitive.test(field.key)
        || !exact(field.label, ['zh', 'en']) || !['zh', 'en'].every(lang => typeof field.label[lang] === 'string' && field.label[lang].trim() && field.label[lang].length <= 80)
        || !Array.isArray(field.sources) || field.sources.length < 1 || field.sources.length > 16
        || field.sources.some(source => !safeKey.test(source) || sensitive.test(source))
        || (field.unit !== undefined && (typeof field.unit !== 'string' || field.unit.length > 12))
        || (field.total !== undefined && !['sum', 'last'].includes(field.total))) throw new TypeError('Invalid score.json field.');
    }
  }
  const presentation = value.presentation;
  const summaryKeys = new Set(value.summary.map(field => field.key));
  const columnKeys = new Set(value.columns.map(field => field.key));
  if (!exact(presentation, ['primarySummaryKeys', 'qualitySummaryKeys', 'defaultRoundMetricKey', 'chartType'])
    || !Array.isArray(presentation.primarySummaryKeys) || presentation.primarySummaryKeys.length < 1 || presentation.primarySummaryKeys.length > 4
    || presentation.primarySummaryKeys.some(key => !summaryKeys.has(key))
    || !Array.isArray(presentation.qualitySummaryKeys) || presentation.qualitySummaryKeys.length > 4
    || presentation.qualitySummaryKeys.some(key => !summaryKeys.has(key) || presentation.primarySummaryKeys.includes(key))
    || !columnKeys.has(presentation.defaultRoundMetricKey) || !['bar', 'line'].includes(presentation.chartType)) throw new TypeError('Invalid score.json presentation.');
  return value;
}

export function ProjectThirdPartyScore(definition, details, detailRows) {
  const summarySources = new Set(definition.summary.flatMap(field => field.sources));
  const columnSources = new Set(definition.columns.flatMap(field => field.sources));
  if (Object.keys(details).some(key => !summarySources.has(key))
    || detailRows.some(row => Object.keys(row).some(key => !columnSources.has(key)))) {
    throw new TypeError('Result fields must be declared by score.json.');
  }
  const read = (source, field) => {
    for (const key of field.sources) {
      const value = source[key];
      if (typeof value === 'boolean') return Number(value);
      if (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e12) return value;
    }
    return null;
  };
  const projected = {
    schema: definition.schema,
    gameId: definition.gameId,
    rounds: detailRows.map(row => Object.fromEntries(definition.columns.map(field => [field.key, read(row, field)]))),
    summary: Object.fromEntries(definition.summary.map(field => [field.key, read(details, field)])),
  };
  if (new TextEncoder().encode(JSON.stringify(projected)).byteLength > 64 * 1024) throw new TypeError('Projected score exceeds 64 KiB.');
  return projected;
}

const exact = (value, keys) => {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
};
