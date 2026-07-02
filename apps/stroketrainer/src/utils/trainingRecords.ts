import type { TranslationKey } from '../i18n';
import type { TrialData } from '../pages/training/types';
import { downloadCsvFile } from './downloadFile';
import { getSetting, STORAGE_PREFIX } from './settings';

type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;

export const TRAINING_RECORDS_CHANGED_EVENT = 'stroke-trainer-training-records-changed';

const TRAINING_RECORDS_KEY = `${STORAGE_PREFIX}training_records_v1`;
const TRAINING_RECORDS_DATABASE_NAME = 'stroke-trainer-training-records';
const TRAINING_RECORDS_DATABASE_VERSION = 1;
const TRAINING_RECORDS_STORE_NAME = 'records';
let legacyMigrationPromise: Promise<void> | null = null;

const MODULE_TITLE_KEYS: Record<string, TranslationKey> = {
  'motor-training': 'home.module.motor.title',
  'cognitive-training': 'home.module.cognitive.title',
  'speech-training': 'home.module.speech.title',
};

export interface TrainingRecordConfig {
  totalRounds?: number;
  oculomotorMode?: string;
  oculomotorPattern?: string;
  oculomotorDurationSec?: number;
  oculomotorSpeedDegPerSec?: number;
  oculomotorTargetSizeMm?: number;
  oculomotorDistractorCount?: number;
  gaborDurationSec?: number;
  gaborMaxSpots?: number;
  readingWPS?: number;
  readingCrowding?: number;
  readingContrast?: number;
  drivingDurationSec?: number;
  drivingRedFlashEnabled?: boolean;
  drivingDifficulty?: string;
  drivingControlMode?: string;
}

export interface TrainingRecord {
  id: string;
  savedAt: string;
  trainingDate?: string;
  userName: string;
  moduleId: string;
  moduleName?: string;
  gameId?: string;
  gameTitle?: string;
  difficulty: string;
  oculomotorMode?: string;
  oculomotorPattern?: string;
  config?: TrainingRecordConfig;
  details?: CsvDetailRow;
  detailRows?: CsvDetailRow[];
  results: TrialData[];
}

interface SaveTrainingRecordArgs {
  userName: string;
  moduleId: string;
  difficulty: string;
  oculomotorMode?: string;
  oculomotorPattern?: string;
  config?: TrainingRecordConfig;
  results: TrialData[];
}

interface SaveTrainingSessionRecordArgs {
  userName: string;
  moduleId: string;
  moduleName?: string;
  gameId: string;
  gameTitle: string;
  difficulty: string;
  trainingDate?: string;
  details?: CsvDetailRow;
  detailRows?: CsvDetailRow[];
}

type CsvDetailRow = Record<string, unknown>;

interface CsvColumn {
  key: string;
  label: string;
}

interface PreparedCsvRow {
  base: CsvDetailRow;
  details: CsvDetailRow;
}

const BASE_CSV_COLUMNS: CsvColumn[] = [
  { key: 'Training_Date', label: 'Training_Date' },
  { key: 'Training_Time', label: 'Training_Time' },
  { key: 'Record_ID', label: 'Record_ID' },
  { key: 'Saved_At', label: 'Saved_At' },
  { key: 'User', label: 'User' },
  { key: 'Module', label: 'Module' },
  { key: 'Module_ID', label: 'Module_ID' },
  { key: 'Game', label: 'Game' },
  { key: 'Game_ID', label: 'Game_ID' },
  { key: 'Difficulty', label: 'Difficulty' },
];

export async function getTrainingRecords(): Promise<TrainingRecord[]> {
  try {
    await ensureLegacyTrainingRecordsMigrated();
    const storedRecords = await readAllTrainingRecords();
    return storedRecords
      .map(toTrainingRecord)
      .filter((record): record is TrainingRecord => record !== null)
      .sort((left, right) => left.savedAt.localeCompare(right.savedAt));
  } catch (error) {
    console.warn('Unable to read saved training records.', error);
    return [];
  }
}

export async function saveTrainingRecord(args: SaveTrainingRecordArgs): Promise<TrainingRecord | null> {
  if (args.results.length === 0) return null;
  const now = new Date();

  const record: TrainingRecord = {
    id: createRecordId(),
    savedAt: now.toISOString(),
    trainingDate: formatDate(now),
    userName: args.userName,
    moduleId: args.moduleId,
    difficulty: args.difficulty,
    oculomotorMode: args.oculomotorMode,
    oculomotorPattern: args.oculomotorPattern,
    config: args.config,
    results: args.results,
  };

  return appendTrainingRecord(record);
}

export async function saveTrainingSessionRecord(args: SaveTrainingSessionRecordArgs): Promise<TrainingRecord | null> {
  const now = new Date();
  const details = normalizeCsvRow(args.details);
  const detailRows = args.detailRows
    ?.map((row) => normalizeCsvRow(row))
    .filter((row): row is CsvDetailRow => Boolean(row));

  const record: TrainingRecord = {
    id: createRecordId(),
    savedAt: now.toISOString(),
    trainingDate: args.trainingDate || formatDate(now),
    userName: args.userName,
    moduleId: args.moduleId,
    moduleName: args.moduleName,
    gameId: args.gameId,
    gameTitle: args.gameTitle,
    difficulty: args.difficulty,
    details,
    detailRows: detailRows && detailRows.length > 0 ? detailRows : undefined,
    results: [],
  };

  return appendTrainingRecord(record);
}

async function appendTrainingRecord(record: TrainingRecord): Promise<TrainingRecord | null> {
  try {
    await ensureLegacyTrainingRecordsMigrated();
    await writeTrainingRecord(record);
    window.dispatchEvent(new Event(TRAINING_RECORDS_CHANGED_EVENT));
    return record;
  } catch (error) {
    console.warn('Unable to save training record.', error);
    return null;
  }
}

export async function downloadAllTrainingRecordsCsv(t: TFunction): Promise<boolean> {
  const records = await getTrainingRecords();
  if (records.length === 0) return false;

  const now = new Date();
  const prefix = getSetting('downloadDirectory');
  const filenameDate = formatDate(now);
  const filenameTime = formatTime(now).replace(/:/g, '');
  const filename = `${prefix ? `${prefix}_` : ''}training_records_${filenameDate}_${filenameTime}.csv`;

  downloadCsvFile(buildTrainingRecordsCsv(records, t), filename);
  return true;
}

async function ensureLegacyTrainingRecordsMigrated(): Promise<void> {
  if (!legacyMigrationPromise) {
    legacyMigrationPromise = migrateLegacyTrainingRecords().catch((error) => {
      legacyMigrationPromise = null;
      throw error;
    });
  }
  await legacyMigrationPromise;
}

async function migrateLegacyTrainingRecords(): Promise<void> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(TRAINING_RECORDS_KEY);
  } catch (error) {
    console.warn('Unable to inspect legacy training records.', error);
    return;
  }
  if (!raw) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn('Unable to parse legacy training records.', error);
    return;
  }
  if (!Array.isArray(parsed)) return;

  const records = parsed
    .map(toTrainingRecord)
    .filter((record): record is TrainingRecord => record !== null);
  await writeTrainingRecords(records);
  try {
    localStorage.removeItem(TRAINING_RECORDS_KEY);
  } catch (error) {
    console.warn('Legacy training records were migrated but could not be removed.', error);
  }
}

async function readAllTrainingRecords(): Promise<unknown[]> {
  const database = await openTrainingRecordsDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(TRAINING_RECORDS_STORE_NAME, 'readonly');
    const request = transaction.objectStore(TRAINING_RECORDS_STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as unknown[]);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

async function writeTrainingRecord(record: TrainingRecord): Promise<void> {
  await writeTrainingRecords([record]);
}

async function writeTrainingRecords(records: TrainingRecord[]): Promise<void> {
  if (records.length === 0) return;
  const database = await openTrainingRecordsDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(TRAINING_RECORDS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(TRAINING_RECORDS_STORE_NAME);
    records.forEach((record) => store.put(record));
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

function openTrainingRecordsDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is unavailable.'));
      return;
    }
    const request = indexedDB.open(TRAINING_RECORDS_DATABASE_NAME, TRAINING_RECORDS_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(TRAINING_RECORDS_STORE_NAME)) {
        const store = database.createObjectStore(TRAINING_RECORDS_STORE_NAME, { keyPath: 'id' });
        store.createIndex('savedAt', 'savedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Training records database upgrade was blocked.'));
  });
}

export function buildTrainingRecordsCsv(records: TrainingRecord[], t: TFunction): string {
  const rows = records.flatMap((record) => toPreparedCsvRows(record, t));
  const detailKeys = collectDetailKeys(rows);
  const columns = [...BASE_CSV_COLUMNS, ...detailKeys.map((key) => ({ key, label: key }))];

  return [
    columns.map((column) => column.label),
    ...rows.map((row) => columns.map((column) => row.base[column.key] ?? row.details[column.key] ?? '')),
  ].map((row) => row.map(toCsvCell).join(',')).join('\n');
}

function toPreparedCsvRows(record: TrainingRecord, t: TFunction): PreparedCsvRow[] {
  const detailRows = hasSessionDetails(record) ? toSessionDetailRows(record) : toLegacyDetailRows(record, t);
  const rows = detailRows.length > 0 ? detailRows : [{}];
  const { date, time } = formatRecordDateTime(record);
  const base = {
    Training_Date: date,
    Training_Time: time,
    Record_ID: record.id,
    Saved_At: record.savedAt,
    User: record.userName,
    Module: record.moduleName || formatModule(record.moduleId, t),
    Module_ID: record.moduleId,
    Game: record.gameTitle || formatModule(record.moduleId, t),
    Game_ID: record.gameId || record.moduleId,
    Difficulty: formatDifficulty(record.config?.drivingDifficulty ?? record.difficulty, t),
  };

  return rows.map((details) => ({ base, details }));
}

function toSessionDetailRows(record: TrainingRecord): CsvDetailRow[] {
  const details = record.details ?? {};
  const detailRows = record.detailRows && record.detailRows.length > 0 ? record.detailRows : [undefined];
  return detailRows.map((detailRow, index) => normalizeCsvRow({
    ...(detailRows.length > 1 ? { Detail_Row: index + 1 } : {}),
    ...details,
    ...(detailRow ?? {}),
  }) ?? {});
}

function toLegacyDetailRows(record: TrainingRecord, t: TFunction): CsvDetailRow[] {
  const firstResult = record.results[0];
  const readingWPS = record.config?.readingWPS ?? '';
  const readingCrowding = record.config?.readingCrowding ?? '';

  if (record.moduleId === 'driving-rehab') {
    const events = firstResult?.driving_events ?? [];
    if (events.length === 0) {
      return [stripEmptyValues({
        Trial_Type: firstResult?.trial_type,
        Response: firstResult?.response,
        RT_ms: firstResult?.average_rt,
        Duration_ms: firstResult?.duration_ms ?? firstResult?.rt,
        Average_FPS: firstResult?.average_fps,
        Lane_Deviations: firstResult?.lane_deviations,
        Route_Progress: firstResult?.route_progress,
      })];
    }

    return events.map((event, index) => stripEmptyValues({
      Trial_Type: firstResult?.trial_type,
      Round: index + 1,
      Response: event.response,
      RT_ms: event.rt_ms,
      Duration_ms: firstResult?.duration_ms ?? firstResult?.rt,
      Average_FPS: firstResult?.average_fps,
      Event: event.label,
      Valid: event.valid,
      Collision: event.collision,
      Preheld_Brake: event.brake_preheld,
      Lane_Deviations: firstResult?.lane_deviations,
      Route_Progress: firstResult?.route_progress,
    }));
  }

  return record.results.map((result, index) => stripEmptyValues({
    Mode: formatOculomotorMode(result.mode ?? record.oculomotorMode ?? record.config?.oculomotorMode, t),
    Path: formatOculomotorPath(result.pattern ?? record.oculomotorPattern ?? record.config?.oculomotorPattern, t),
    Trial_Type: result.trial_type,
    Round: index + 1,
    Target: result.target,
    Response: (result as TrialData & { response_text?: string }).response_text ?? result.response,
    Correct: formatCorrect(result.correct),
    RT_ms: result.rt ?? result.reading_time,
    Duration_ms: result.duration_ms,
    Score: result.score,
    Acquired_Targets: result.acquired_targets,
    Average_FPS: result.average_fps,
    AOI_Score: (result as TrialData & { aoi_score?: number }).aoi_score,
    Status: result.response,
    Lane_Deviations: result.lane_deviations,
    Route_Progress: result.route_progress,
    Reading_WPS: record.moduleId === 'reading-training' ? readingWPS : '',
    Reading_Crowding: record.moduleId === 'reading-training' ? readingCrowding : '',
  }));
}

function toTrainingRecord(value: unknown): TrainingRecord | null {
  const item = toObject(value);
  if (!item || !Array.isArray(item.results)) return null;

  return {
    id: typeof item.id === 'string' ? item.id : createRecordId(),
    savedAt: typeof item.savedAt === 'string' ? item.savedAt : new Date().toISOString(),
    trainingDate: typeof item.trainingDate === 'string' ? item.trainingDate : undefined,
    userName: typeof item.userName === 'string' ? item.userName : '',
    moduleId: typeof item.moduleId === 'string' ? item.moduleId : '',
    moduleName: typeof item.moduleName === 'string' ? item.moduleName : undefined,
    gameId: typeof item.gameId === 'string' ? item.gameId : undefined,
    gameTitle: typeof item.gameTitle === 'string' ? item.gameTitle : undefined,
    difficulty: typeof item.difficulty === 'string' ? item.difficulty : '',
    oculomotorMode: typeof item.oculomotorMode === 'string' ? item.oculomotorMode : undefined,
    oculomotorPattern: typeof item.oculomotorPattern === 'string' ? item.oculomotorPattern : undefined,
    config: toObject(item.config) as TrainingRecordConfig | undefined,
    details: normalizeCsvRow(toObject(item.details)),
    detailRows: Array.isArray(item.detailRows)
      ? item.detailRows.map((row) => normalizeCsvRow(toObject(row))).filter((row): row is CsvDetailRow => Boolean(row))
      : undefined,
    results: item.results as TrialData[],
  };
}

function toObject(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function createRecordId(): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}_${randomPart}`;
}

function formatSavedAt(savedAt: string): { date: string; time: string } {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) {
    return { date: '', time: '' };
  }
  return { date: formatDate(date), time: formatTime(date) };
}

function formatRecordDateTime(record: TrainingRecord): { date: string; time: string } {
  const savedAt = formatSavedAt(record.savedAt);
  return {
    date: record.trainingDate || savedAt.date,
    time: savedAt.time,
  };
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(date: Date): string {
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${hour}:${minute}:${second}`;
}

function formatModule(moduleId: string, t: TFunction): string {
  const key = MODULE_TITLE_KEYS[moduleId];
  return key ? t(key) : moduleId;
}

function formatDifficulty(difficulty: string, t: TFunction): string {
  if (difficulty === 'beginner' || difficulty === 'intermediate' || difficulty === 'advanced') {
    return t(`home.diff.${difficulty}` as TranslationKey);
  }
  return difficulty;
}

function formatOculomotorMode(mode: string | undefined, t: TFunction): string {
  return mode ? t(`preset.mode.${mode}` as TranslationKey) : '';
}

function formatOculomotorPath(path: string | undefined, t: TFunction): string {
  return path ? t(`preset.path.${path}` as TranslationKey) : '';
}

function formatCorrect(correct: boolean | undefined): string {
  if (correct === undefined) return '';
  return correct ? 'true' : 'false';
}

function hasSessionDetails(record: TrainingRecord): boolean {
  return Boolean(record.details || (record.detailRows && record.detailRows.length > 0));
}

function collectDetailKeys(rows: PreparedCsvRow[]): string[] {
  const baseKeys = new Set(BASE_CSV_COLUMNS.map((column) => column.key));
  const keys: string[] = [];
  rows.forEach((row) => {
    Object.keys(row.details).forEach((key) => {
      if (baseKeys.has(key) || keys.includes(key)) return;
      keys.push(key);
    });
  });
  return keys;
}

function normalizeCsvRow(row: CsvDetailRow | undefined): CsvDetailRow | undefined {
  if (!row) return undefined;
  const normalized = stripEmptyValues(row);
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function stripEmptyValues(row: CsvDetailRow): CsvDetailRow {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, normalizeCsvValue(value)]),
  );
}

function normalizeCsvValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return String(value);
  }
}

function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  const text = String(value);
  if (!/[",\r\n]/.test(text)) return text;

  return `"${text.replace(/"/g, '""')}"`;
}
