import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { RemoveGazeSamples, SummaryOnlyRecord } from '../apps/rehabtrainerhub/functions/_lib/recordSummary.js';
import { CreateCloudflareDeploymentEnvironment } from './gamehost-environment.mjs';

const config = 'apps/rehabtrainerhub/wrangler.workers.jsonc';
const root = resolve(import.meta.dirname, '..');
const restorePointCommand = `npx wrangler d1 time-travel info rehab_db --config ${config}`;
const maximumBatchBytes = 80000;

export function CleanTrainingRecord(record) {
  const cleaned = SummaryOnlyRecord(RemoveGazeSamples(record));
  if (Object.hasOwn(record, 'rawFiles')) cleaned.rawFiles = record.rawFiles;
  if (Array.isArray(record.score?.rounds) && record.score.rounds.length) {
    cleaned.score.rounds = [];
    cleaned.scoreRoundCount = Object.hasOwn(record, 'scoreRoundCount') ? record.scoreRoundCount : record.score.rounds.length;
  }
  return cleaned;
}

function CleanGameResult(result) {
  const rounds = result.scoreProjection?.rounds;
  const details = result.detailRows;
  if (!(Array.isArray(rounds) && rounds.length) && !(Array.isArray(details) && details.length)) return result;
  return { ...result, detailRows: [],
    scoreRoundCount: Array.isArray(rounds) ? rounds.length : details.length,
    ...(result.scoreProjection ? { scoreProjection: { ...result.scoreProjection, rounds: [] } } : {}),
  };
}

function TransformJsonColumns(row, columns, clean) {
  const values = {};
  let bytesSaved = 0;
  try {
    for (const column of columns) {
      if (row[column] === null && column === 'summary_json') { values[column] = null; continue; }
      const parsed = JSON.parse(row[column]);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { status: 'unparseable' };
      const cleaned = clean(parsed);
      values[column] = isDeepStrictEqual(parsed, cleaned) ? row[column] : JSON.stringify(cleaned);
      bytesSaved += Buffer.byteLength(row[column]) - Buffer.byteLength(values[column]);
    }
  } catch { return { status: 'unparseable' }; }
  return { status: columns.some(column => values[column] !== row[column]) ? 'changed' : 'unchanged', values, bytesSaved };
}

export function TransformTrainingRow(row) {
  return TransformJsonColumns(row, ['payload_json', 'summary_json'], CleanTrainingRecord);
}

export function TransformGameRunRow(row) {
  return TransformJsonColumns(row, ['result_json'], CleanGameResult);
}

function SqlString(value) {
  return value === null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
}

export function BuildUpdateSql(table, row, values) {
  if (table === 'training_records') {
    return `UPDATE training_records SET payload_json = ${SqlString(values.payload_json)}, summary_json = ${SqlString(values.summary_json)} WHERE id = ${SqlString(row.id)} AND updated_at = ${SqlString(row.updated_at)};`;
  }
  if (table === 'game_runs') {
    // Runs are insert-only; creation time and original character length guard against replacement without embedding trial data in SQL.
    return `UPDATE game_runs SET result_json = ${SqlString(values.result_json)} WHERE id = ${SqlString(row.id)} AND created_at = ${SqlString(row.created_at)} AND length(result_json) = ${Array.from(row.result_json).length};`;
  }
  throw new Error('Unsupported cleanup table.');
}

export function RunWrangler(args) {
  const commandArgs = ['--yes', 'wrangler@4', ...args];
  const command = process.platform === 'win32'
    ? { file: process.env.ComSpec ?? 'cmd.exe', args: ['/d', '/s', '/c', 'npx', ...commandArgs] }
    : { file: 'npx', args: commandArgs };
  const result = spawnSync(command.file, command.args, { cwd: root,
    env: { ...CreateCloudflareDeploymentEnvironment(process.env), WRANGLER_SEND_METRICS: 'false' },
    encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, timeout: 120000, windowsHide: true,
  });
  if (result.status !== 0 || result.error) throw new Error('Wrangler D1 command failed; output withheld because it may contain record data.');
  return ParseWranglerJson(result.stdout);
}

// `d1 execute --file` prints upload progress on stdout before the JSON array.
export function ParseWranglerJson(stdout) {
  const start = stdout.search(/^[[{]/m);
  try { return JSON.parse(start > 0 ? stdout.slice(start) : stdout); }
  catch { throw new Error('Wrangler returned invalid JSON; output withheld.'); }
}

function WranglerResults(value) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(parsed) || !parsed.length || parsed.some(item => item.success !== true || !Array.isArray(item.results))) {
    throw new Error('Wrangler returned an unsuccessful D1 response.');
  }
  return parsed;
}

export async function CleanupD1Records({ apply = false, runWrangler = RunWrangler, log = console.log } = {}) {
  if (apply) log(`Before applying, note a restore point with: ${restorePointCommand}`);
  const stats = {};
  for (const table of ['training_records', 'game_runs']) {
    const counts = { scanned: 0, wouldChange: 0, unchanged: 0, unparseable: 0, submitted: 0, bytesSaved: 0 };
    stats[table] = counts;
    let lastId = '';
    let batch = [];
    let batchBytes = 0;
    const flush = async () => {
      if (!batch.length) return;
      const directory = await mkdtemp(join(tmpdir(), 'rehab-d1-cleanup-'));
      const path = join(directory, 'updates.sql');
      try {
        await writeFile(path, `${batch.join('\n')}\n`, { mode: 0o600 });
        WranglerResults(await runWrangler(['d1', 'execute', 'rehab_db', '--config', config, '--remote', '--json', '--file', path]));
        counts.submitted += batch.length;
      } finally {
        await unlink(path).catch(error => { if (error.code !== 'ENOENT') throw error; });
        await rmdir(directory);
      }
      batch = []; batchBytes = 0;
    };
    try {
      while (true) {
        const columns = table === 'training_records' ? 'id, updated_at, payload_json, summary_json' : 'id, created_at, result_json';
        // Hex keeps row identifiers out of Windows cmd quoting and preserves SQLite's text ordering.
        const cursor = `CAST(X'${Buffer.from(lastId).toString('hex')}' AS TEXT)`;
        const sql = `SELECT ${columns} FROM ${table} WHERE id > ${cursor} ORDER BY id LIMIT 100;`;
        const response = WranglerResults(await runWrangler(['d1', 'execute', 'rehab_db', '--config', config, '--remote', '--json', '--command', sql]));
        const rows = response.flatMap(result => result.results);
        if (!rows.length) break;
        for (const row of rows) {
          if (typeof row.id !== 'string' || Buffer.compare(Buffer.from(row.id), Buffer.from(lastId)) <= 0) throw new Error('D1 paging did not advance.');
          lastId = row.id;
          counts.scanned += 1;
          const result = table === 'training_records' ? TransformTrainingRow(row) : TransformGameRunRow(row);
          if (result.status === 'unparseable') {
            counts.unparseable += 1;
            log(`${table}: unparseable row id=${JSON.stringify(row.id)}`);
          } else if (result.status === 'unchanged') counts.unchanged += 1;
          else {
            counts.wouldChange += 1;
            counts.bytesSaved += result.bytesSaved;
            if (apply) {
              const statement = BuildUpdateSql(table, row, result.values);
              const bytes = Buffer.byteLength(statement) + 1;
              if (bytes > maximumBatchBytes) throw new Error('Cleaned row exceeds the SQL batch limit; no statement written for that row.');
              if (batch.length && (batch.length >= 50 || batchBytes + bytes > maximumBatchBytes)) await flush();
              batch.push(statement); batchBytes += bytes;
            }
          }
        }
        await flush();
        if (rows.length < 100) break;
      }
    } finally {
      log(`${table}: scanned=${counts.scanned}, wouldChange=${counts.wouldChange}, unchanged=${counts.unchanged}, unparseable=${counts.unparseable}, bytesSaved=${counts.bytesSaved}, submitted=${counts.submitted}`);
    }
  }
  log(`Total estimated bytesSaved=${Object.values(stats).reduce((total, counts) => total + counts.bytesSaved, 0)}`);
  return stats;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).some(arg => !['--apply', '--dry-run'].includes(arg)) || process.argv.includes('--apply') && process.argv.includes('--dry-run')) {
    throw new Error('Use --dry-run (default) or --apply.');
  }
  try { await CleanupD1Records({ apply: process.argv.includes('--apply') }); }
  catch { console.error('D1 cleanup stopped. Review the counts, resolve the failure, then run dry run again.'); process.exitCode = 1; }
}
