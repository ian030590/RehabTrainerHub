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

export const trainingRecordsChangedEvent = 'vision-trainer-training-records-changed';

const legacyTrainingRecordsKey = `${storagePrefix}training_records_v1`;
const trainingHighScoresKey = `${storagePrefix}training_high_scores_v1`;
const trainingRecordsDbName = `${storagePrefix}training_records`;
const trainingRecordsDbVersion = 1;
const trainingRecordsStore = 'records';
const remoteAppId = 'visiontrainer';
const authApiBase = siteUrls.hub;

const moduleTitleKeys: Record<string, TranslationKey> = {
  'moving-card': 'home.module.movingCard.title',
  'oculomotor-training': 'home.module.oculomotor.title',
  'gabor-patching': 'home.module.gaborPatching.title',
  'reading-training': 'home.module.reading.title',
  'driving-rehab': 'home.module.driving.title',
  'ufov-assessment': 'assess.ufov.title',
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
  ufovDetails?: Record<string, unknown>;
  ufovSummary?: unknown;
}

export interface TrainingRecord {
  id: string;
  savedAt: string;
  userName: string;
  moduleId: string;
  difficulty: string;
  oculomotorMode?: string;
  oculomotorPattern?: string;
  config?: TrainingRecordConfig;
  results: TrialData[];
}

export interface TrainingHighScore {
  userName: string;
  moduleId: string;
  score: number;
  achievedAt: string;
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

type CsvRow = unknown[];

let databasePromise: Promise<IDBDatabase> | null = null;
let migrationPromise: Promise<void> | null = null;

export function InitializeTrainingRecords(): Promise<void> {
  return EnsureLegacyRecordsMigrated();
}

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
    const database = await GetTrainingRecordsDatabase();
    await EnsureLegacyRecordsMigrated(database);
    const transaction = database.transaction(trainingRecordsStore, 'readonly');
    const records = await RequestToPromise<unknown[]>(
      transaction.objectStore(trainingRecordsStore).getAll(),
    );
    await TransactionToPromise(transaction);

    return records
      .map(ToTrainingRecord)
      .filter((record): record is TrainingRecord => record !== null)
      .sort((left, right) => left.savedAt.localeCompare(right.savedAt));
  } catch (error) {
    console.warn('Unable to read saved training records.', error);
    throw error;
  }
}

export async function GetTrainingRecordCount(): Promise<number> {
  if (HasAuthToken()) {
    try {
      const remoteRecords = await GetRemoteTrainingRecords(authApiBase, remoteAppId);
      if (remoteRecords) return remoteRecords.length;
    } catch (error) {
      console.warn('Unable to count remote training records. Falling back to IndexedDB.', error);
    }
  }

  try {
    const database = await GetTrainingRecordsDatabase();
    await EnsureLegacyRecordsMigrated(database);
    const transaction = database.transaction(trainingRecordsStore, 'readonly');
    const count = await RequestToPromise<number>(
      transaction.objectStore(trainingRecordsStore).count(),
    );
    await TransactionToPromise(transaction);
    return count;
  } catch (error) {
    console.warn('Unable to count saved training records.', error);
    return 0;
  }
}

export async function SaveTrainingRecord(args: SaveTrainingRecordArgs): Promise<TrainingRecord | null> {
  if (args.results.length === 0) return null;

  const record: TrainingRecord = {
    id: CreateRecordId(),
    savedAt: new Date().toISOString(),
    userName: args.userName,
    moduleId: args.moduleId,
    difficulty: args.difficulty,
    oculomotorMode: args.oculomotorMode,
    oculomotorPattern: args.oculomotorPattern,
    config: args.config,
    results: args.results,
  };

  if (HasAuthToken()) {
    try {
      const saved = await SaveRemoteTrainingRecord(authApiBase, {
        appId: remoteAppId,
        record,
      });
      if (saved) {
        UpdateTrainingHighScores([record]);
        window.dispatchEvent(new Event(trainingRecordsChangedEvent));
        return record;
      }
    } catch (error) {
      console.warn('Unable to save remote training record. Falling back to IndexedDB.', error);
    }
  }

  try {
    const database = await GetTrainingRecordsDatabase();
    await EnsureLegacyRecordsMigrated(database);
    const transaction = database.transaction(trainingRecordsStore, 'readwrite');
    transaction.objectStore(trainingRecordsStore).put(record);
    await TransactionToPromise(transaction);
    UpdateTrainingHighScores([record]);
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

function GetTrainingRecordsDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    const openingDatabase = new Promise<IDBDatabase>((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB is not available in this browser.'));
        return;
      }

      const request = window.indexedDB.open(
        trainingRecordsDbName,
        trainingRecordsDbVersion,
      );

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(trainingRecordsStore)) {
          const store = database.createObjectStore(trainingRecordsStore, { keyPath: 'id' });
          store.createIndex('savedAt', 'savedAt');
          store.createIndex('userName', 'userName');
          store.createIndex('moduleId', 'moduleId');
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          databasePromise = null;
        };
        resolve(database);
      };
      request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB.'));
      request.onblocked = () => console.warn('Opening the training records database is blocked.');
    });

    databasePromise = openingDatabase.catch((error) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

function EnsureLegacyRecordsMigrated(database?: IDBDatabase): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = MigrateLegacyRecords(database).catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }
  return migrationPromise;
}

async function MigrateLegacyRecords(existingDatabase?: IDBDatabase): Promise<void> {
  const raw = localStorage.getItem(legacyTrainingRecordsKey);
  if (!raw) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn('Legacy training records could not be parsed and were left in localStorage.', error);
    return;
  }

  if (!Array.isArray(parsed)) {
    console.warn('Legacy training records are not stored as an array and were left in localStorage.');
    return;
  }

  const records = parsed
    .map(ToTrainingRecord)
    .filter((record): record is TrainingRecord => record !== null)
    .sort((left, right) => left.savedAt.localeCompare(right.savedAt));

  if (records.length !== parsed.length) {
    console.warn('Some legacy training records could not be validated, so the source data was left in localStorage.');
    return;
  }

  const database = existingDatabase ?? await GetTrainingRecordsDatabase();
  if (records.length > 0) {
    const transaction = database.transaction(trainingRecordsStore, 'readwrite');
    const store = transaction.objectStore(trainingRecordsStore);
    records.forEach((record) => store.put(record));
    await TransactionToPromise(transaction);
    UpdateTrainingHighScores(records);
  }

  localStorage.removeItem(legacyTrainingRecordsKey);
  window.dispatchEvent(new Event(trainingRecordsChangedEvent));
}

function UpdateTrainingHighScores(records: TrainingRecord[]): void {
  const highScores = ReadTrainingHighScores();

  records.forEach((record) => {
    const score = CalculateTrainingScore(record);
    if (score === null) return;

    const key = CreateHighScoreKey(record.userName, record.moduleId);
    const current = highScores[key];
    if (current && current.score >= score) return;

    highScores[key] = {
      userName: record.userName,
      moduleId: record.moduleId,
      score,
      achievedAt: record.savedAt,
    };
  });

  localStorage.setItem(trainingHighScoresKey, JSON.stringify(highScores));
}

function ReadTrainingHighScores(): Record<string, TrainingHighScore> {
  const raw = localStorage.getItem(trainingHighScoresKey);
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    return ToObject(parsed) as Record<string, TrainingHighScore> | undefined ?? {};
  } catch (error) {
    console.warn('Unable to read saved training high scores.', error);
    return {};
  }
}

function CalculateTrainingScore(record: TrainingRecord): number | null {
  const firstResult = record.results[0];

  if (record.moduleId === 'gabor-patching') {
    return ToFiniteNumber(firstResult?.score);
  }

  if (record.moduleId === 'oculomotor-training') {
    const aoiScore = ToFiniteNumber(
      (firstResult as TrialData & { aoi_score?: number } | undefined)?.aoi_score,
    );
    return aoiScore ?? ToFiniteNumber(firstResult?.acquired_targets);
  }

  if (record.moduleId === 'driving-rehab') {
    return ToFiniteNumber(firstResult?.valid_event_count);
  }

  const scoredResults = record.moduleId === 'reading-training'
    ? record.results.filter((result) => result.trial_type === 'html-button-response')
    : record.results;
  return scoredResults.filter((result) => result.correct).length;
}

function CreateHighScoreKey(userName: string, moduleId: string): string {
  return `${encodeURIComponent(userName)}::${encodeURIComponent(moduleId)}`;
}

function ToFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function RequestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function TransactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'));
  });
}

export function BuildTrainingRecordsCsv(records: TrainingRecord[], t: TFunction): string {
  const headers = [
    t('exp.csv.sessionId'),
    t('exp.csv.savedAt'),
    t('exp.csv.user'),
    t('exp.csv.date'),
    t('exp.csv.time'),
    t('exp.csv.module'),
    t('exp.csv.moduleId'),
    t('exp.csv.diff'),
    t('exp.csv.mode'),
    t('exp.csv.path'),
    t('exp.csv.trialType'),
    t('exp.csv.round'),
    t('exp.csv.target'),
    t('exp.csv.response'),
    t('exp.csv.correct'),
    t('exp.csv.rt'),
    t('exp.csv.duration'),
    t('exp.csv.score'),
    t('exp.csv.acquired'),
    t('exp.csv.fps'),
    t('exp.csv.aoi'),
    t('exp.csv.status'),
    t('exp.csv.event'),
    t('exp.csv.valid'),
    t('exp.csv.collision'),
    t('exp.csv.preBrake'),
    t('exp.csv.laneDeviations'),
    t('exp.csv.routeProgress'),
    t('exp.csv.readingWps'),
    t('exp.csv.readingCrowding'),
  ];

  const rows = records.flatMap((record) => ToCsvRows(record, t));
  return CreateCsvContent([headers, ...rows]);
}

function ToCsvRows(record: TrainingRecord, t: TFunction): CsvRow[] {
  const firstResult = record.results[0];
  const moduleLabel = FormatModule(record.moduleId, t);
  const difficulty = FormatDifficulty(record.config?.drivingDifficulty ?? record.difficulty, t);
  const { date, time } = FormatSavedAt(record.savedAt);
  const readingWPS = record.config?.readingWPS ?? '';
  const readingCrowding = record.config?.readingCrowding ?? '';

  const base = [
    record.id,
    record.savedAt,
    record.userName,
    date,
    time,
    moduleLabel,
    record.moduleId,
    difficulty,
  ];

  if (record.moduleId === 'driving-rehab') {
    const events = firstResult?.driving_events ?? [];
    if (events.length === 0) {
      return [[
        ...base,
        '',
        firstResult?.route_label ?? firstResult?.route_id ?? '',
        firstResult?.trial_type ?? '',
        '',
        '',
        firstResult?.response ?? '',
        '',
        firstResult?.average_rt ?? '',
        firstResult?.duration_ms ?? firstResult?.rt ?? '',
        '',
        '',
        firstResult?.average_fps ?? '',
        '',
        '',
        '',
        '',
        '',
        '',
        firstResult?.lane_deviations ?? '',
        firstResult?.route_progress ?? '',
        '',
        '',
      ]];
    }

    return events.map((event, index) => [
      ...base,
      '',
      firstResult?.route_label ?? firstResult?.route_id ?? '',
      firstResult?.trial_type ?? '',
      index + 1,
      '',
      event.response,
      '',
      event.rt_ms ?? '',
      firstResult?.duration_ms ?? firstResult?.rt ?? '',
      '',
      '',
      firstResult?.average_fps ?? '',
      '',
      '',
      event.label,
      event.valid,
      event.collision,
      event.brake_preheld,
      firstResult?.lane_deviations ?? '',
      firstResult?.route_progress ?? '',
      '',
      '',
    ]);
  }

  return record.results.map((result, index) => [
    ...base,
    FormatOculomotorMode(result.mode ?? record.oculomotorMode ?? record.config?.oculomotorMode, t),
    FormatOculomotorPath(result.pattern ?? record.oculomotorPattern ?? record.config?.oculomotorPattern, t),
    result.trial_type ?? '',
    index + 1,
    result.target ?? '',
    (result as TrialData & { response_text?: string }).response_text ?? result.response ?? '',
    FormatCorrect(result.correct),
    result.rt ?? result.reading_time ?? '',
    result.duration_ms ?? '',
    result.score ?? '',
    result.acquired_targets ?? '',
    result.average_fps ?? '',
    (result as TrialData & { aoi_score?: number }).aoi_score ?? '',
    result.response ?? '',
    '',
    '',
    '',
    '',
    result.lane_deviations ?? '',
    result.route_progress ?? '',
    record.moduleId === 'reading-training' ? readingWPS : '',
    record.moduleId === 'reading-training' ? readingCrowding : '',
  ]);
}

function ToTrainingRecord(value: unknown): TrainingRecord | null {
  const item = ToObject(value);
  if (!item || !Array.isArray(item.results)) return null;

  return {
    id: typeof item.id === 'string' ? item.id : CreateRecordId(),
    savedAt: typeof item.savedAt === 'string' ? item.savedAt : new Date().toISOString(),
    userName: typeof item.userName === 'string' ? item.userName : '',
    moduleId: typeof item.moduleId === 'string' ? item.moduleId : '',
    difficulty: typeof item.difficulty === 'string' ? item.difficulty : '',
    oculomotorMode: typeof item.oculomotorMode === 'string' ? item.oculomotorMode : undefined,
    oculomotorPattern: typeof item.oculomotorPattern === 'string' ? item.oculomotorPattern : undefined,
    config: ToObject(item.config) as TrainingRecordConfig | undefined,
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

