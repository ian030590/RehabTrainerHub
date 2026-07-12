import {
  getRemoteTrainingRecords,
  hasAuthToken,
  saveRemoteTrainingRecord,
} from '@rehab-trainer/ui/auth/authClient';
import { downloadCsvFile, downloadFile } from '@rehab-trainer/ui/downloadFile';
import type { TranslationKey } from '../i18n';
import { STORAGE_PREFIX } from './settings';
import { siteUrls } from './siteUrls';

type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;
type DetailRow = Record<string, unknown>;

export interface BrainTrainingRecord {
  id: string;
  savedAt: string;
  trainingDate?: string;
  userName: string;
  moduleId: string;
  gameId: string;
  gameTitle: string;
  difficulty: string;
  details?: DetailRow;
  detailRows?: DetailRow[];
}

const TRAINING_RECORDS_KEY = `${STORAGE_PREFIX}training_records_v1`;
const REMOTE_APP_ID = 'braintrainer';
const AUTH_API_BASE = import.meta.env.VITE_AUTH_API_BASE || siteUrls.hub;

export async function saveTrainingRecord(record: BrainTrainingRecord): Promise<void> {
  if (hasAuthToken()) {
    try {
      const saved = await saveRemoteTrainingRecord(AUTH_API_BASE, {
        appId: REMOTE_APP_ID,
        record,
      });
      if (saved) return;
    } catch (error) {
      console.warn('Unable to save remote BrainTrainer record. Falling back to localStorage.', error);
    }
  }

  const records = getLocalTrainingRecords();
  const index = records.findIndex((item) => item.id === record.id);
  if (index >= 0) records[index] = record;
  else records.push(record);
  localStorage.setItem(TRAINING_RECORDS_KEY, JSON.stringify(records));
}

export async function getTrainingRecords(): Promise<BrainTrainingRecord[]> {
  if (hasAuthToken()) {
    try {
      const remoteRecords = await getRemoteTrainingRecords(AUTH_API_BASE, REMOTE_APP_ID);
      if (remoteRecords) return remoteRecords.map(toTrainingRecord).filter((record): record is BrainTrainingRecord => Boolean(record));
    } catch (error) {
      console.warn('Unable to read remote BrainTrainer records. Falling back to localStorage.', error);
    }
  }

  return getLocalTrainingRecords();
}

export async function downloadAllTrainingRecordsCsv(_t: TFunction): Promise<boolean> {
  const records = await getTrainingRecords();
  if (records.length === 0) return false;
  downloadCsvFile(buildTrainingRecordsCsv(records), `braintrainer_records_${formatFileDate(new Date())}.csv`);
  return true;
}

export function downloadTrainingRecordCsv(record: BrainTrainingRecord): void {
  downloadCsvFile(buildTrainingRecordsCsv([record]), `${safeFilePart(record.gameId)}_${record.trainingDate ?? formatFileDate(new Date())}.csv`);
}

export function downloadTrainingRecordJson(record: BrainTrainingRecord): void {
  downloadFile(
    JSON.stringify(record, null, 2),
    `${safeFilePart(record.gameId)}_${record.trainingDate ?? formatFileDate(new Date())}.json`,
    'application/json;charset=utf-8',
  );
}

function getLocalTrainingRecords(): BrainTrainingRecord[] {
  const raw = localStorage.getItem(TRAINING_RECORDS_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map(toTrainingRecord).filter((record): record is BrainTrainingRecord => Boolean(record))
      : [];
  } catch {
    return [];
  }
}

function toTrainingRecord(value: unknown): BrainTrainingRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.savedAt !== 'string') return null;
  if (typeof item.userName !== 'string' || typeof item.moduleId !== 'string') return null;
  return {
    id: item.id,
    savedAt: item.savedAt,
    trainingDate: typeof item.trainingDate === 'string' ? item.trainingDate : undefined,
    userName: item.userName,
    moduleId: item.moduleId,
    gameId: typeof item.gameId === 'string' ? item.gameId : item.moduleId,
    gameTitle: typeof item.gameTitle === 'string' ? item.gameTitle : item.moduleId,
    difficulty: typeof item.difficulty === 'string' ? item.difficulty : '',
    details: toDetailRow(item.details),
    detailRows: Array.isArray(item.detailRows)
      ? item.detailRows.map(toDetailRow).filter((row): row is DetailRow => Boolean(row))
      : undefined,
  };
}

function toDetailRow(value: unknown): DetailRow | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as DetailRow
    : undefined;
}

function buildTrainingRecordsCsv(records: BrainTrainingRecord[]): string {
  const rows = records.flatMap((record) => {
    const details = record.details ?? {};
    const detailRows = record.detailRows?.length ? record.detailRows : [{}];
    return detailRows.map((detailRow, index): DetailRow => ({
      Saved_At: record.savedAt,
      Training_Date: record.trainingDate ?? '',
      User: record.userName,
      Module_ID: record.moduleId,
      Game_ID: record.gameId,
      Game: record.gameTitle,
      Difficulty: record.difficulty,
      Detail_Row: detailRows.length > 1 ? index + 1 : '',
      ...details,
      ...detailRow,
    }));
  });
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return [
    columns,
    ...rows.map((row) => columns.map((column) => toCsvCell(row[column]))),
  ].map((row) => row.join(',')).join('\n');
}

function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatFileDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function safeFilePart(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'braintrainer';
}
