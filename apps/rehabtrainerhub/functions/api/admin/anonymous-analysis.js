import {
  CorsHeaders,
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
  RateLimitResponse,
  RequireDatabase,
  SecurityHeaders,
  TransientRateLimitResponse,
} from '../../_lib/auth.js';
import {
  GetAuthenticatedUser,
  NormalizeUserRole,
  userRoles,
  WriteAdminAuditEvent,
} from '../../_lib/authorization.js';

const runtimeIds = new Set(['hub', 'motor', 'vision', 'brain', 'mouth', 'game-runner']);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const anonymousRecordsCte = `
  WITH anonymous_records AS (
    SELECT
      'training_record' AS source,
      COALESCE(runtime_id, 'unknown') AS runtime_id,
      COALESCE(module_id, 'unknown') AS module_id,
      COALESCE(verified_training_date, training_date, substr(saved_at, 1, 10)) AS recorded_date,
      saved_at AS recorded_at,
      subject_id
    FROM training_records
    WHERE user_id IS NULL
      AND app_id = 'rehabtrainerhub'
    UNION ALL
    SELECT
      'game_run' AS source,
      'game-runner' AS runtime_id,
      COALESCE(game_id, 'unknown') AS module_id,
      substr(created_at, 1, 10) AS recorded_date,
      created_at AS recorded_at,
      subject_id
    FROM game_runs
    WHERE user_id IS NULL
  )
`;

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestGet({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    const user = await GetAuthenticatedUser(request, env);
    if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);
    if (NormalizeUserRole(user.role) !== userRoles.admin) {
      return ErrorResponse(request, env, 'Forbidden.', 403);
    }

    const filters = ParseAnalysisFilters(new URL(request.url).searchParams);
    if (!filters.ok) return ErrorResponse(request, env, filters.error, 400);

    if (filters.value.format === 'csv') {
      const transientLimit = TransientRateLimitResponse(
        request,
        env,
        'admin-anonymous-analysis-export',
        { limit: 2, windowSeconds: 60 },
      );
      if (transientLimit) return transientLimit;

      const distributedLimit = await RateLimitResponse(
        request,
        env,
        'admin-anonymous-analysis-export',
        { identity: user.id, identityOnly: true, limit: 10, windowSeconds: 60 * 60 },
      );
      if (distributedLimit) return distributedLimit;
    }

    const db = RequireDatabase(env);
    const query = BuildAnalysisQuery(filters.value);
    const [summaryRow, byRuntimeResult, byDateResult] = await Promise.all([
      db.prepare(`${anonymousRecordsCte}
        SELECT
          COUNT(*) AS record_count,
          COUNT(DISTINCT subject_id) AS subject_count,
          MIN(recorded_at) AS first_recorded_at,
          MAX(recorded_at) AS latest_recorded_at
        FROM anonymous_records
        WHERE ${query.whereSql}
      `).bind(...query.bindings).first(),
      db.prepare(`${anonymousRecordsCte}
        SELECT
          source,
          runtime_id,
          COUNT(*) AS record_count,
          COUNT(DISTINCT subject_id) AS subject_count
        FROM anonymous_records
        WHERE ${query.whereSql}
        GROUP BY source, runtime_id
        ORDER BY source, runtime_id
      `).bind(...query.bindings).all(),
      db.prepare(`${anonymousRecordsCte}
        SELECT
          recorded_date,
          COUNT(*) AS record_count,
          COUNT(DISTINCT subject_id) AS subject_count
        FROM anonymous_records
        WHERE ${query.whereSql}
        GROUP BY recorded_date
        ORDER BY recorded_date
      `).bind(...query.bindings).all(),
    ]);

    const summary = {
      recordCount: Number(summaryRow?.record_count || 0),
      uniqueSubjectCount: Number(summaryRow?.subject_count || 0),
      firstRecordedAt: summaryRow?.first_recorded_at || null,
      latestRecordedAt: summaryRow?.latest_recorded_at || null,
    };
    const byRuntime = (byRuntimeResult.results || []).map((row) => ({
      source: row.source,
      runtimeId: row.runtime_id,
      recordCount: Number(row.record_count || 0),
      uniqueSubjectCount: Number(row.subject_count || 0),
    }));
    const byDate = (byDateResult.results || []).map((row) => ({
      date: row.recorded_date,
      recordCount: Number(row.record_count || 0),
      uniqueSubjectCount: Number(row.subject_count || 0),
    }));

    await WriteAdminAuditEvent(env, {
      actorUserId: user.id,
      action: 'anonymous_records.analysis',
      targetType: 'anonymous_records',
      metadata: {
        format: filters.value.format,
        dateFrom: filters.value.dateFrom,
        dateTo: filters.value.dateTo,
        runtimeId: filters.value.runtimeId,
        recordCount: summary.recordCount,
        groupCount: byRuntime.length + byDate.length,
      },
    });

    if (filters.value.format === 'csv') {
      return CreateAggregateCsvResponse(request, env, summary, byRuntime, byDate);
    }

    return JsonResponse(request, env, {
      scope: {
        appId: 'rehabtrainerhub',
        userScope: 'anonymous-only',
        subjectIds: 'not-returned',
        payloads: 'not-returned',
      },
      filters: {
        dateFrom: filters.value.dateFrom,
        dateTo: filters.value.dateTo,
        runtimeId: filters.value.runtimeId,
      },
      summary,
      byRuntime,
      byDate,
    });
  } catch (error) {
    console.error('Unable to load anonymous aggregate analysis.', error);
    return ErrorResponse(request, env, 'Unable to load anonymous aggregate analysis.', 500);
  }
}

function ParseAnalysisFilters(searchParams) {
  for (const key of searchParams.keys()) {
    const normalizedKey = key.toLowerCase().replaceAll('-', '_');
    if (normalizedKey === 'subjectid' || normalizedKey === 'subject_id') {
      return { ok: false, error: 'Subject identifiers cannot be used for analysis.' };
    }
  }

  const dateFrom = NormalizeOptionalFilter(searchParams.get('dateFrom'), 10);
  const dateTo = NormalizeOptionalFilter(searchParams.get('dateTo'), 10);
  const runtimeId = NormalizeOptionalFilter(searchParams.get('runtimeId'), 32);
  const format = searchParams.get('format') || 'json';
  if (
    dateFrom === undefined
    || dateTo === undefined
    || runtimeId === undefined
    || (dateFrom && !datePattern.test(dateFrom))
    || (dateTo && !datePattern.test(dateTo))
    || (dateFrom && dateTo && dateFrom > dateTo)
    || (runtimeId && !runtimeIds.has(runtimeId))
    || !['json', 'csv'].includes(format)
  ) {
    return { ok: false, error: 'Invalid analysis filters.' };
  }

  return { ok: true, value: { dateFrom, dateTo, runtimeId, format } };
}

function BuildAnalysisQuery(filters) {
  const conditions = [];
  const bindings = [];
  if (filters.dateFrom) {
    conditions.push('recorded_date >= ?');
    bindings.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push('recorded_date <= ?');
    bindings.push(filters.dateTo);
  }
  if (filters.runtimeId) {
    conditions.push('runtime_id = ?');
    bindings.push(filters.runtimeId);
  }
  return {
    whereSql: conditions.length ? conditions.join(' AND ') : '1 = 1',
    bindings,
  };
}

function CreateAggregateCsvResponse(request, env, summary, byRuntime, byDate) {
  const rows = [
    ['group_type', 'group_key', 'source', 'record_count', 'unique_subject_count'],
    ['summary', 'all', '', summary.recordCount, summary.uniqueSubjectCount],
    ...byRuntime.map((row) => [
      'runtime', row.runtimeId, row.source, row.recordCount, row.uniqueSubjectCount,
    ]),
    ...byDate.map((row) => ['date', row.date, '', row.recordCount, row.uniqueSubjectCount]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(ToSafeCsvCell).join(',')).join('\r\n')}\r\n`;
  return new Response(csv, {
    status: 200,
    headers: {
      ...CorsHeaders(request, env),
      ...SecurityHeaders(),
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="anonymous-training-aggregate.csv"',
    },
  });
}

function NormalizeOptionalFilter(value, maxLength) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : undefined;
}

function ToSafeCsvCell(value) {
  const rawText = value === null || value === undefined ? '' : String(value);
  const safeText = /^[\t\r\n ]*[=+\-@]/.test(rawText) ? `'${rawText}` : rawText;
  return /[",\r\n]/.test(safeText)
    ? `"${safeText.replace(/"/g, '""')}"`
    : safeText;
}
