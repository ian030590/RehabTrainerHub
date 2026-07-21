import {
  GetRemoteTrainingRecords,
  HasAuthToken,
  SaveRemoteTrainingRecord,
} from '@rehab-trainer/ui/auth/authClient';
import { CreateCsvContent } from '@rehab-trainer/ui/csv';
import type { TranslationKey } from '../i18n';
import type { TrialData } from '../pages/training/types';
import { DownloadCsvFile } from './downloadFile';
import { GetSetting, storagePrefix } from './settings';
import { siteUrls } from './siteUrls';

type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;

export const trainingRecordsChangedEvent = 'stroke-trainer-training-records-changed';

const trainingRecordsKey = `${storagePrefix}training_records_v1`;
const trainingRecordsDatabaseName = 'stroke-trainer-training-records';
const trainingRecordsDatabaseVersion = 1;
const trainingRecordsStoreName = 'records';
const remoteAppId = 'stroketrainer';
const authApiBase = siteUrls.hub;
let legacyMigrationPromise: Promise<void> | null = null;

const moduleTitleKeys: Record<string, TranslationKey> = {
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

const baseCsvColumns: CsvColumn[] = [
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

export async function GetTrainingRecords(): Promise<TrainingRecord[]> {
  if (HasAuthToken()) {
    try {
      const remoteRecords = await GetRemoteTrainingRecords(authApiBase, remoteAppId);
      if (remoteRecords) {
        return remoteRecords
          .map(ToTrainingRecord)
          .filter((record): record is TrainingRecord => record !== null)
          .sort((left, right) => left.savedAt.localeCompare(right.savedAt));
      }
    } catch (error) {
      console.warn('Unable to read remote training records. Falling back to IndexedDB.', error);
    }
  }

  try {
    await EnsureLegacyTrainingRecordsMigrated();
    const storedRecords = await ReadAllTrainingRecords();
    return storedRecords
      .map(ToTrainingRecord)
      .filter((record): record is TrainingRecord => record !== null)
      .sort((left, right) => left.savedAt.localeCompare(right.savedAt));
  } catch (error) {
    console.warn('Unable to read saved training records.', error);
    return [];
  }
}

export async function SaveTrainingRecord(args: SaveTrainingRecordArgs): Promise<TrainingRecord | null> {
  if (args.results.length === 0) return null;
  const now = new Date();

  const record: TrainingRecord = {
    id: CreateRecordId(),
    savedAt: now.toISOString(),
    trainingDate: FormatDate(now),
    userName: args.userName,
    moduleId: args.moduleId,
    difficulty: args.difficulty,
    oculomotorMode: args.oculomotorMode,
    oculomotorPattern: args.oculomotorPattern,
    config: args.config,
    results: args.results,
  };

  return AppendTrainingRecord(record);
}

export async function SaveTrainingSessionRecord(args: SaveTrainingSessionRecordArgs): Promise<TrainingRecord | null> {
  const now = new Date();
  const details = NormalizeCsvRow(args.details);
  const detailRows = args.detailRows
    ?.map((row) => NormalizeCsvRow(row))
    .filter((row): row is CsvDetailRow => Boolean(row));

  const record: TrainingRecord = {
    id: CreateRecordId(),
    savedAt: now.toISOString(),
    trainingDate: args.trainingDate || FormatDate(now),
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

  return AppendTrainingRecord(record);
}

async function AppendTrainingRecord(record: TrainingRecord): Promise<TrainingRecord | null> {
  if (HasAuthToken()) {
    try {
      const saved = await SaveRemoteTrainingRecord(authApiBase, {
        appId: remoteAppId,
        record,
      });
      if (saved) {
        window.dispatchEvent(new Event(trainingRecordsChangedEvent));
        return record;
      }
    } catch (error) {
      console.warn('Unable to save remote training record. Falling back to IndexedDB.', error);
    }
  }

  try {
    await EnsureLegacyTrainingRecordsMigrated();
    await WriteTrainingRecord(record);
    window.dispatchEvent(new Event(trainingRecordsChangedEvent));
    return record;
  } catch (error) {
    console.warn('Unable to save training record.', error);
    return null;
  }
}

export async function DownloadAllTrainingRecordsCsv(t: TFunction): Promise<boolean> {
  const records = await GetTrainingRecords();
  if (records.length === 0) return false;

  const now = new Date();
  const prefix = GetSetting('downloadDirectory');
  const filenameDate = FormatDate(now);
  const filenameTime = FormatTime(now).replace(/:/g, '');
  const filename = `${prefix ? `${prefix}_` : ''}training_records_${filenameDate}_${filenameTime}.csv`;

  DownloadCsvFile(BuildTrainingRecordsCsv(records, t), filename);
  return true;
}

async function EnsureLegacyTrainingRecordsMigrated(): Promise<void> {
  if (!legacyMigrationPromise) {
    legacyMigrationPromise = MigrateLegacyTrainingRecords().catch((error) => {
      legacyMigrationPromise = null;
      throw error;
    });
  }
  await legacyMigrationPromise;
}

async function MigrateLegacyTrainingRecords(): Promise<void> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(trainingRecordsKey);
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
    .map(ToTrainingRecord)
    .filter((record): record is TrainingRecord => record !== null);
  await WriteTrainingRecords(records);
  try {
    localStorage.removeItem(trainingRecordsKey);
  } catch (error) {
    console.warn('Legacy training records were migrated but could not be removed.', error);
  }
}

async function ReadAllTrainingRecords(): Promise<unknown[]> {
  const database = await OpenTrainingRecordsDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(trainingRecordsStoreName, 'readonly');
    const request = transaction.objectStore(trainingRecordsStoreName).getAll();
    request.onsuccess = () => resolve(request.result as unknown[]);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

async function WriteTrainingRecord(record: TrainingRecord): Promise<void> {
  await WriteTrainingRecords([record]);
}

async function WriteTrainingRecords(records: TrainingRecord[]): Promise<void> {
  if (records.length === 0) return;
  const database = await OpenTrainingRecordsDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(trainingRecordsStoreName, 'readwrite');
    const store = transaction.objectStore(trainingRecordsStoreName);
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

function OpenTrainingRecordsDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is unavailable.'));
      return;
    }
    const request = indexedDB.open(trainingRecordsDatabaseName, trainingRecordsDatabaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(trainingRecordsStoreName)) {
        const store = database.createObjectStore(trainingRecordsStoreName, { keyPath: 'id' });
        store.createIndex('savedAt', 'savedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Training records database upgrade was blocked.'));
  });
}

export function BuildTrainingRecordsCsv(records: TrainingRecord[], t: TFunction): string {
  const rows = records.flatMap((record) => ToPreparedCsvRows(record, t));
  const detailKeys = CollectDetailKeys(rows);
  const columns = [...baseCsvColumns, ...detailKeys.map((key) => ({ key, label: key }))];

  return CreateCsvContent([
    columns.map((column) => column.label),
    ...rows.map((row) => columns.map((column) => row.base[column.key] ?? row.details[column.key] ?? '')),
  ]);
}

function ToPreparedCsvRows(record: TrainingRecord, t: TFunction): PreparedCsvRow[] {
  const detailRows = HasSessionDetails(record) ? ToSessionDetailRows(record) : ToLegacyDetailRows(record, t);
  const rows = detailRows.length > 0 ? detailRows : [{}];
  const { date, time } = FormatRecordDateTime(record);
  const base = {
    Training_Date: date,
    Training_Time: time,
    Record_ID: record.id,
    Saved_At: record.savedAt,
    User: record.userName,
    Module: record.moduleName || FormatModule(record.moduleId, t),
    Module_ID: record.moduleId,
    Game: record.gameTitle || FormatModule(record.moduleId, t),
    Game_ID: record.gameId || record.moduleId,
    Difficulty: FormatDifficulty(record.config?.drivingDifficulty ?? record.difficulty, t),
  };

  return rows.map((details) => ({ base, details }));
}

function ToSessionDetailRows(record: TrainingRecord): CsvDetailRow[] {
  const details = record.details ?? {};
  const detailRows = record.detailRows && record.detailRows.length > 0 ? record.detailRows : [undefined];
  return detailRows.map((detailRow, index) => NormalizeCsvRow({
    ...(detailRows.length > 1 ? { Detail_Row: index + 1 } : {}),
    ...details,
    ...(detailRow ?? {}),
  }) ?? {});
}

function ToLegacyDetailRows(record: TrainingRecord, t: TFunction): CsvDetailRow[] {
  const firstResult = record.results[0];
  const readingWPS = record.config?.readingWPS ?? '';
  const readingCrowding = record.config?.readingCrowding ?? '';

  if (record.moduleId === 'driving-rehab') {
    const events = firstResult?.driving_events ?? [];
    if (events.length === 0) {
      return [StripEmptyValues({
        Trial_Type: firstResult?.trial_type,
        Response: firstResult?.response,
        RT_ms: firstResult?.average_rt,
        Duration_ms: firstResult?.duration_ms ?? firstResult?.rt,
        Average_FPS: firstResult?.average_fps,
        Lane_Deviations: firstResult?.lane_deviations,
        Route_Progress: firstResult?.route_progress,
      })];
    }

    return events.map((event, index) => StripEmptyValues({
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

  return record.results.map((result, index) => StripEmptyValues({
    Mode: FormatOculomotorMode(result.mode ?? record.oculomotorMode ?? record.config?.oculomotorMode, t),
    Path: FormatOculomotorPath(result.pattern ?? record.oculomotorPattern ?? record.config?.oculomotorPattern, t),
    Trial_Type: result.trial_type,
    Round: index + 1,
    Target: result.target,
    Response: (result as TrialData & { response_text?: string }).response_text ?? result.response,
    Correct: FormatCorrect(result.correct),
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

function ToTrainingRecord(value: unknown): TrainingRecord | null {
  const item = ToObject(value);
  if (!item || !Array.isArray(item.results)) return null;

  return {
    id: typeof item.id === 'string' ? item.id : CreateRecordId(),
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
    config: ToObject(item.config) as TrainingRecordConfig | undefined,
    details: NormalizeCsvRow(ToObject(item.details)),
    detailRows: Array.isArray(item.detailRows)
      ? item.detailRows.map((row) => NormalizeCsvRow(ToObject(row))).filter((row): row is CsvDetailRow => Boolean(row))
      : undefined,
    results: item.results as TrialData[],
  };
}

function ToObject(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function CreateRecordId(): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}_${randomPart}`;
}

function FormatSavedAt(savedAt: string): { date: string; time: string } {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) {
    return { date: '', time: '' };
  }
  return { date: FormatDate(date), time: FormatTime(date) };
}

function FormatRecordDateTime(record: TrainingRecord): { date: string; time: string } {
  const savedAt = FormatSavedAt(record.savedAt);
  return {
    date: record.trainingDate || savedAt.date,
    time: savedAt.time,
  };
}

function FormatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function FormatTime(date: Date): string {
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${hour}:${minute}:${second}`;
}

function FormatModule(moduleId: string, t: TFunction): string {
  const key = moduleTitleKeys[moduleId];
  return key ? t(key) : moduleId;
}

function FormatDifficulty(difficulty: string, t: TFunction): string {
  if (difficulty === 'beginner' || difficulty === 'intermediate' || difficulty === 'advanced') {
    return t(`home.diff.${difficulty}` as TranslationKey);
  }
  return difficulty;
}

function FormatOculomotorMode(mode: string | undefined, t: TFunction): string {
  return mode ? t(`preset.mode.${mode}` as TranslationKey) : '';
}

function FormatOculomotorPath(path: string | undefined, t: TFunction): string {
  return path ? t(`preset.path.${path}` as TranslationKey) : '';
}

function FormatCorrect(correct: boolean | undefined): string {
  if (correct === undefined) return '';
  return correct ? 'true' : 'false';
}

function HasSessionDetails(record: TrainingRecord): boolean {
  return Boolean(record.details || (record.detailRows && record.detailRows.length > 0));
}

function CollectDetailKeys(rows: PreparedCsvRow[]): string[] {
  const baseKeys = new Set(baseCsvColumns.map((column) => column.key));
  const keys: string[] = [];
  rows.forEach((row) => {
    Object.keys(row.details).forEach((key) => {
      if (baseKeys.has(key) || keys.includes(key)) return;
      keys.push(key);
    });
  });
  return keys;
}

function NormalizeCsvRow(row: CsvDetailRow | undefined): CsvDetailRow | undefined {
  if (!row) return undefined;
  const normalized = StripEmptyValues(row);
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function StripEmptyValues(row: CsvDetailRow): CsvDetailRow {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, NormalizeCsvValue(value)]),
  );
}

function NormalizeCsvValue(value: unknown): unknown {
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
