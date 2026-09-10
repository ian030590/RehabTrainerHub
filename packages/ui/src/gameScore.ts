export interface ScoreField {
  key: string;
  label: { zh: string; en: string };
  sources: string[];
  unit?: string;
  total?: 'sum' | 'last';
}

export interface GameScoreDefinition {
  schema: 'rehab-trainer.game-score/v1';
  gameId: string;
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

export function ParseGameScoreDefinition(value: unknown, gameId?: string): GameScoreDefinition {
  const definition = value as GameScoreDefinition;
  if (!definition || definition.schema !== 'rehab-trainer.game-score/v1'
    || typeof definition.gameId !== 'string' || !/^[a-z0-9-]{1,80}$/.test(definition.gameId)
    || (gameId && definition.gameId !== gameId)) throw new TypeError('Invalid score.json.');
  for (const fields of [definition.columns, definition.summary]) {
    if (!Array.isArray(fields) || fields.length < 1 || fields.length > 12
      || new Set(fields.map(field => field?.key)).size !== fields.length
      || fields.some(field => !field || !safeKey.test(field.key) || sensitiveKey.test(field.key)
        || !field.label || !['zh', 'en'].every(lang => typeof field.label[lang as 'zh' | 'en'] === 'string' && field.label[lang as 'zh' | 'en'].length <= 80)
        || (field.unit !== undefined && (typeof field.unit !== 'string' || field.unit.length > 12))
        || (field.total !== undefined && field.total !== 'sum' && field.total !== 'last')
        || !Array.isArray(field.sources) || field.sources.length > 16
        || field.sources.some(source => typeof source !== 'string' || !safeKey.test(source) || sensitiveKey.test(source)))) {
      throw new TypeError('Invalid score fields.');
    }
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
