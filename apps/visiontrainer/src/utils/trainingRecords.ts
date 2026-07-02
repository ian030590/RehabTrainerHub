import type { TranslationKey } from '../i18n';
import type { TrialData } from '../pages/training/types';
import { downloadCsvFile } from './downloadFile';
import { getSetting, STORAGE_PREFIX } from './settings';

type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;

export const TRAINING_RECORDS_CHANGED_EVENT = 'vision-trainer-training-records-changed';

const LEGACY_TRAINING_RECORDS_KEY = `${STORAGE_PREFIX}training_records_v1`;
const TRAINING_HIGH_SCORES_KEY = `${STORAGE_PREFIX}training_high_scores_v1`;
const TRAINING_RECORDS_DB_NAME = `${STORAGE_PREFIX}training_records`;
const TRAINING_RECORDS_DB_VERSION = 1;
const TRAINING_RECORDS_STORE = 'records';

const MODULE_TITLE_KEYS: Record<string, TranslationKey> = {
  'moving-card': 'home.module.movingCard.title',
  'oculomotor-training': 'home.module.oculomotor.title',
  'gabor-patching': 'home.module.gaborPatching.title',
  'reading-training': 'home.module.reading.title',
  'driving-rehab': 'home.module.driving.title',
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

export function initializeTrainingRecords(): Promise<void> {
  return ensureLegacyRecordsMigrated();
}

export async function getTrainingRecords(): Promise<TrainingRecord[]> {
  try {
    const database = await getTrainingRecordsDatabase();
    await ensureLegacyRecordsMigrated(database);
    const transaction = database.transaction(TRAINING_RECORDS_STORE, 'readonly');
    const records = await requestToPromise<unknown[]>(
      transaction.objectStore(TRAINING_RECORDS_STORE).getAll(),
    );
    await transactionToPromise(transaction);

    return records
      .map(toTrainingRecord)
      .filter((record): record is TrainingRecord => record !== null)
      .sort((left, right) => left.savedAt.localeCompare(right.savedAt));
  } catch (error) {
    console.warn('Unable to read saved training records.', error);
    throw error;
  }
}

export async function getTrainingRecordCount(): Promise<number> {
  try {
    const database = await getTrainingRecordsDatabase();
    await ensureLegacyRecordsMigrated(database);
    const transaction = database.transaction(TRAINING_RECORDS_STORE, 'readonly');
    const count = await requestToPromise<number>(
      transaction.objectStore(TRAINING_RECORDS_STORE).count(),
    );
    await transactionToPromise(transaction);
    return count;
  } catch (error) {
    console.warn('Unable to count saved training records.', error);
    return 0;
  }
}

export async function saveTrainingRecord(args: SaveTrainingRecordArgs): Promise<TrainingRecord | null> {
  if (args.results.length === 0) return null;

  const record: TrainingRecord = {
    id: createRecordId(),
    savedAt: new Date().toISOString(),
    userName: args.userName,
    moduleId: args.moduleId,
    difficulty: args.difficulty,
    oculomotorMode: args.oculomotorMode,
    oculomotorPattern: args.oculomotorPattern,
    config: args.config,
    results: args.results,
  };

  try {
    const database = await getTrainingRecordsDatabase();
    await ensureLegacyRecordsMigrated(database);
    const transaction = database.transaction(TRAINING_RECORDS_STORE, 'readwrite');
    transaction.objectStore(TRAINING_RECORDS_STORE).put(record);
    await transactionToPromise(transaction);
    updateTrainingHighScores([record]);
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

function getTrainingRecordsDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    const openingDatabase = new Promise<IDBDatabase>((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB is not available in this browser.'));
        return;
      }

      const request = window.indexedDB.open(
        TRAINING_RECORDS_DB_NAME,
        TRAINING_RECORDS_DB_VERSION,
      );

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(TRAINING_RECORDS_STORE)) {
          const store = database.createObjectStore(TRAINING_RECORDS_STORE, { keyPath: 'id' });
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

function ensureLegacyRecordsMigrated(database?: IDBDatabase): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = migrateLegacyRecords(database).catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }
  return migrationPromise;
}

async function migrateLegacyRecords(existingDatabase?: IDBDatabase): Promise<void> {
  const raw = localStorage.getItem(LEGACY_TRAINING_RECORDS_KEY);
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
    .map(toTrainingRecord)
    .filter((record): record is TrainingRecord => record !== null)
    .sort((left, right) => left.savedAt.localeCompare(right.savedAt));

  if (records.length !== parsed.length) {
    console.warn('Some legacy training records could not be validated, so the source data was left in localStorage.');
    return;
  }

  const database = existingDatabase ?? await getTrainingRecordsDatabase();
  if (records.length > 0) {
    const transaction = database.transaction(TRAINING_RECORDS_STORE, 'readwrite');
    const store = transaction.objectStore(TRAINING_RECORDS_STORE);
    records.forEach((record) => store.put(record));
    await transactionToPromise(transaction);
    updateTrainingHighScores(records);
  }

  localStorage.removeItem(LEGACY_TRAINING_RECORDS_KEY);
  window.dispatchEvent(new Event(TRAINING_RECORDS_CHANGED_EVENT));
}

function updateTrainingHighScores(records: TrainingRecord[]): void {
  const highScores = readTrainingHighScores();

  records.forEach((record) => {
    const score = calculateTrainingScore(record);
    if (score === null) return;

    const key = createHighScoreKey(record.userName, record.moduleId);
    const current = highScores[key];
    if (current && current.score >= score) return;

    highScores[key] = {
      userName: record.userName,
      moduleId: record.moduleId,
      score,
      achievedAt: record.savedAt,
    };
  });

  localStorage.setItem(TRAINING_HIGH_SCORES_KEY, JSON.stringify(highScores));
}

function readTrainingHighScores(): Record<string, TrainingHighScore> {
  const raw = localStorage.getItem(TRAINING_HIGH_SCORES_KEY);
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    return toObject(parsed) as Record<string, TrainingHighScore> | undefined ?? {};
  } catch (error) {
    console.warn('Unable to read saved training high scores.', error);
    return {};
  }
}

function calculateTrainingScore(record: TrainingRecord): number | null {
  const firstResult = record.results[0];

  if (record.moduleId === 'gabor-patching') {
    return toFiniteNumber(firstResult?.score);
  }

  if (record.moduleId === 'oculomotor-training') {
    const aoiScore = toFiniteNumber(
      (firstResult as TrialData & { aoi_score?: number } | undefined)?.aoi_score,
    );
    return aoiScore ?? toFiniteNumber(firstResult?.acquired_targets);
  }

  if (record.moduleId === 'driving-rehab') {
    return toFiniteNumber(firstResult?.valid_event_count);
  }

  const scoredResults = record.moduleId === 'reading-training'
    ? record.results.filter((result) => result.trial_type === 'html-button-response')
    : record.results;
  return scoredResults.filter((result) => result.correct).length;
}

function createHighScoreKey(userName: string, moduleId: string): string {
  return `${encodeURIComponent(userName)}::${encodeURIComponent(moduleId)}`;
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'));
  });
}

export function buildTrainingRecordsCsv(records: TrainingRecord[], t: TFunction): string {
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

  const rows = records.flatMap((record) => toCsvRows(record, t));
  return [headers, ...rows].map((row) => row.map(toCsvCell).join(',')).join('\n');
}

function toCsvRows(record: TrainingRecord, t: TFunction): CsvRow[] {
  const firstResult = record.results[0];
  const moduleLabel = formatModule(record.moduleId, t);
  const difficulty = formatDifficulty(record.config?.drivingDifficulty ?? record.difficulty, t);
  const { date, time } = formatSavedAt(record.savedAt);
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
        '',
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
      '',
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
    formatOculomotorMode(result.mode ?? record.oculomotorMode ?? record.config?.oculomotorMode, t),
    formatOculomotorPath(result.pattern ?? record.oculomotorPattern ?? record.config?.oculomotorPattern, t),
    result.trial_type ?? '',
    index + 1,
    result.target ?? '',
    (result as TrialData & { response_text?: string }).response_text ?? result.response ?? '',
    formatCorrect(result.correct),
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

function toTrainingRecord(value: unknown): TrainingRecord | null {
  const item = toObject(value);
  if (!item || !Array.isArray(item.results)) return null;

  return {
    id: typeof item.id === 'string' ? item.id : createRecordId(),
    savedAt: typeof item.savedAt === 'string' ? item.savedAt : new Date().toISOString(),
    userName: typeof item.userName === 'string' ? item.userName : '',
    moduleId: typeof item.moduleId === 'string' ? item.moduleId : '',
    difficulty: typeof item.difficulty === 'string' ? item.difficulty : '',
    oculomotorMode: typeof item.oculomotorMode === 'string' ? item.oculomotorMode : undefined,
    oculomotorPattern: typeof item.oculomotorPattern === 'string' ? item.oculomotorPattern : undefined,
    config: toObject(item.config) as TrainingRecordConfig | undefined,
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

function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  const text = String(value);
  if (!/[",\r\n]/.test(text)) return text;

  return `"${text.replace(/"/g, '""')}"`;
}
