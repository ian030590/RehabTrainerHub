import {
  CorsHeaders,
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
  RateLimitResponse,
  RequireDatabase,
  SafeJsonParse,
  SecurityHeaders,
  TransientRateLimitResponse,
} from '../../_lib/auth.js';
import {
  CanAccessPatient,
  GetAuthenticatedUser,
  IsStaffUser,
  WriteAdminAuditEvent,
  userRoles,
} from '../../_lib/authorization.js';

const appIds = new Set([
  'rehabtrainerhub',
  'motortrainer',
  'visiontrainer',
  'braintrainer',
  'mouthtrainer',
]);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const defaultPageSize = 25;
const maxPageSize = 100;
const defaultExportLimit = 1000;
const maxExportLimit = 5000;
const exportBatchSize = 125;

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestGet({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    const user = await GetAuthenticatedUser(request, env);
    if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);
    if (!IsStaffUser(user)) return ErrorResponse(request, env, 'Forbidden.', 403);

    const url = new URL(request.url);
    const filters = ParseRecordFilters(url.searchParams);
    if (!filters) return ErrorResponse(request, env, 'Invalid record filters.', 400);

    if (filters.patientId && !(await CanAccessPatient(env, user, filters.patientId))) {
      return ErrorResponse(request, env, 'Forbidden.', 403);
    }

    if (filters.format === 'csv') {
      const transientLimit = TransientRateLimitResponse(
        request,
        env,
        'admin-records-export',
        {
          identity: user.id,
          limit: 4,
          windowSeconds: 60,
        },
      );
      if (transientLimit) return transientLimit;

      const distributedLimit = await RateLimitResponse(
        request,
        env,
        'admin-records-export',
        {
          identity: user.id,
          identityOnly: true,
          limit: 20,
          windowSeconds: 60 * 60,
        },
      );
      if (distributedLimit) return distributedLimit;
    }

    const query = BuildRecordQuery(user, filters);
    const db = RequireDatabase(env);
    const countRow = await db
      .prepare(`
        SELECT COUNT(*) AS total
        FROM training_records
        INNER JOIN app_users ON app_users.id = training_records.user_id
        WHERE ${query.whereSql}
      `)
      .bind(...query.bindings)
      .first();
    const total = Number(countRow?.total || 0);

    if (filters.format === 'csv') {
      return ExportRecordsCsv(request, env, user, filters, query, total);
    }

    const offset = (filters.page - 1) * filters.pageSize;
    const result = await db
      .prepare(`${RecordSelectSql()}
        WHERE ${query.whereSql}
        ORDER BY training_records.saved_at DESC, training_records.id DESC
        LIMIT ? OFFSET ?
      `)
      .bind(...query.bindings, filters.pageSize, offset)
      .all();
    const totalPages = total === 0 ? 0 : Math.ceil(total / filters.pageSize);

    return JsonResponse(request, env, {
      records: (result.results || []).map(ToAdminRecordDto),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Unable to load therapist training records.', error);
    return ErrorResponse(request, env, 'Unable to load training records.', 500);
  }
}

async function ExportRecordsCsv(request, env, user, filters, query, total) {
  const returnedRows = Math.min(total, filters.exportLimit);

  await WriteAdminAuditEvent(env, {
    actorUserId: user.id,
    action: 'training_records.export',
    targetType: filters.patientId ? 'patient' : 'training_records',
    targetId: filters.patientId,
    metadata: {
      patientId: filters.patientId,
      appId: filters.appId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      returnedRows,
      totalRows: total,
      exportLimit: filters.exportLimit,
      truncated: total > returnedRows,
    },
  });

  const stream = CreateRecordsCsvStream(env, query, returnedRows);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    status: 200,
    headers: {
      ...CorsHeaders(request, env),
      ...SecurityHeaders(),
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="rehab-training-records-${date}.csv"`,
      'X-Export-Row-Limit': String(filters.exportLimit),
      'X-Export-Truncated': total > returnedRows ? 'true' : 'false',
    },
  });
}

function CreateRecordsCsvStream(env, query, returnedRows) {
  const encoder = new TextEncoder();
  const database = RequireDatabase(env);

  return new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`\uFEFF${BuildRecordsCsvHeader()}`));
        let emittedRows = 0;
        let cursorSavedAt = null;
        let cursorId = null;

        while (emittedRows < returnedRows) {
          const batchSize = Math.min(exportBatchSize, returnedRows - emittedRows);
          const cursorWhereSql = cursorSavedAt && cursorId
            ? ` AND (
                training_records.saved_at < ?
                OR (
                  training_records.saved_at = ?
                  AND training_records.id < ?
                )
              )`
            : '';
          const cursorBindings = cursorSavedAt && cursorId
            ? [cursorSavedAt, cursorSavedAt, cursorId]
            : [];
          const result = await database
            .prepare(`${RecordSelectSql()}
              WHERE ${query.whereSql}${cursorWhereSql}
              ORDER BY training_records.saved_at DESC, training_records.id DESC
              LIMIT ?
            `)
            .bind(...query.bindings, ...cursorBindings, batchSize)
            .all();
          const rows = result.results || [];
          const records = rows.map(ToAdminRecordDto);
          if (records.length === 0) break;

          controller.enqueue(
            encoder.encode(`\r\n${BuildRecordsCsvRows(records)}`),
          );
          emittedRows += records.length;
          const lastRow = rows.at(-1);
          cursorSavedAt = lastRow.saved_at;
          cursorId = lastRow.id;
        }
        controller.close();
      } catch (error) {
        console.error('Unable to stream therapist training records.', error);
        controller.error(error);
      }
    },
  });
}

function ParseRecordFilters(searchParams) {
  const patientId = NormalizeOptionalFilter(searchParams.get('patientId'), 128);
  const appId = NormalizeOptionalFilter(searchParams.get('appId'), 64);
  const dateFrom = NormalizeOptionalFilter(searchParams.get('dateFrom'), 10);
  const dateTo = NormalizeOptionalFilter(searchParams.get('dateTo'), 10);
  const format = searchParams.get('format') || 'json';
  const page = ParsePositiveInteger(searchParams.get('page'), 1, Number.MAX_SAFE_INTEGER);
  const pageSize = ParsePositiveInteger(searchParams.get('pageSize'), defaultPageSize, maxPageSize);
  const exportLimit = ParsePositiveInteger(searchParams.get('limit'), defaultExportLimit, maxExportLimit);

  if (
    patientId === undefined
    || appId === undefined
    || dateFrom === undefined
    || dateTo === undefined
    || (appId && !appIds.has(appId))
    || (dateFrom && !datePattern.test(dateFrom))
    || (dateTo && !datePattern.test(dateTo))
    || (dateFrom && dateTo && dateFrom > dateTo)
    || !['json', 'csv'].includes(format)
    || page === null
    || pageSize === null
    || exportLimit === null
  ) {
    return null;
  }

  return {
    patientId,
    appId,
    dateFrom,
    dateTo,
    format,
    page,
    pageSize,
    exportLimit,
  };
}

function BuildRecordQuery(user, filters) {
  const conditions = ["app_users.role = 'patient'"];
  const bindings = [];

  if (user.role !== userRoles.admin) {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM therapist_patient_assignments
        WHERE therapist_patient_assignments.therapist_id = ?
          AND therapist_patient_assignments.patient_id = training_records.user_id
      )
    `);
    bindings.push(user.id);
  }
  if (filters.patientId) {
    conditions.push('training_records.user_id = ?');
    bindings.push(filters.patientId);
  }
  if (filters.appId) {
    conditions.push('training_records.app_id = ?');
    bindings.push(filters.appId);
  }
  if (filters.dateFrom) {
    conditions.push(`${TrainingDateSql()} >= ?`);
    bindings.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push(`${TrainingDateSql()} <= ?`);
    bindings.push(filters.dateTo);
  }

  return {
    whereSql: conditions.join(' AND '),
    bindings,
  };
}

function RecordSelectSql() {
  return `
    SELECT
      training_records.id,
      training_records.user_id AS patient_id,
      COALESCE(app_users.display_name, app_users.email, 'Patient') AS patient_name,
      app_users.email AS patient_email,
      training_records.app_id,
      training_records.module_id,
      training_records.game_id,
      ${TrainingDateSql()} AS training_date,
      training_records.saved_at,
      training_records.difficulty,
      training_records.user_name,
      training_records.payload_json
    FROM training_records
    INNER JOIN app_users ON app_users.id = training_records.user_id
  `;
}

function TrainingDateSql() {
  return 'training_records.verified_training_date';
}

function ToAdminRecordDto(row) {
  const parsedPayload = SafeJsonParse(row.payload_json);
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    patientEmail: row.patient_email || null,
    appId: row.app_id,
    moduleId: row.module_id,
    gameId: row.game_id || null,
    trainingDate: row.training_date || null,
    savedAt: row.saved_at,
    difficulty: row.difficulty || null,
    userName: row.user_name || null,
    dataTrust: 'client-reported',
    payload: parsedPayload && typeof parsedPayload === 'object' && !Array.isArray(parsedPayload)
      ? parsedPayload
      : null,
  };
}

function BuildRecordsCsvHeader() {
  return [
    'Record_ID',
    'Patient_ID',
    'Patient_Name',
    'Patient_Email',
    'App_ID',
    'Module_ID',
    'Game_ID',
    'Training_Date',
    'Saved_At',
    'Difficulty',
    'User_Name',
    'Data_Trust',
    'Client_Reported_Payload_JSON',
  ].map(ToSafeCsvCell).join(',');
}

function BuildRecordsCsvRows(records) {
  return records
    .map((record) => [
      record.id,
      record.patientId,
      record.patientName,
      record.patientEmail,
      record.appId,
      record.moduleId,
      record.gameId,
      record.trainingDate,
      record.savedAt,
      record.difficulty,
      record.userName,
      record.dataTrust,
      record.payload,
    ])
    .map((row) => row.map(ToSafeCsvCell).join(','))
    .join('\r\n');
}

function ToSafeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const rawText = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const text = /^[\t\r\n ]*[=+\-@]/.test(rawText) ? `'${rawText}` : rawText;
  return /[",\r\n]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

function NormalizeOptionalFilter(value, maxLength) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : undefined;
}

function ParsePositiveInteger(value, fallback, maximum) {
  if (value === null || value === '') return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum
    ? parsed
    : null;
}
