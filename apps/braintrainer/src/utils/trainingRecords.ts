import {
  GetRemoteTrainingRecords,
  HasAuthToken,
  SaveRemoteTrainingRecord,
} from '@rehab-trainer/ui/auth/authClient';
import { CreateCsvContent } from '@rehab-trainer/ui/csv';
import { DownloadCsvFile, DownloadFile } from '@rehab-trainer/ui/downloadFile';
import type { TranslationKey } from '../i18n';
import { storagePrefix } from './settings';
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

const trainingRecordsKey = `${storagePrefix}training_records_v1`;
const remoteAppId = 'braintrainer';
const authApiBase = siteUrls.hub;

export async function SaveTrainingRecord(record: BrainTrainingRecord): Promise<void> {
  if (HasAuthToken()) {
    try {
      const saved = await SaveRemoteTrainingRecord(authApiBase, {
        appId: remoteAppId,
        record,
      });
      if (saved) return;
    } catch (error) {
      console.warn('Unable to save remote BrainTrainer record. Falling back to localStorage.', error);
    }
  }

  const records = GetLocalTrainingRecords();
  const index = records.findIndex((item) => item.id === record.id);
  if (index >= 0) records[index] = record;
  else records.push(record);
  localStorage.setItem(trainingRecordsKey, JSON.stringify(records));
}

export async function GetTrainingRecords(): Promise<BrainTrainingRecord[]> {
  if (HasAuthToken()) {
    try {
      const remoteRecords = await GetRemoteTrainingRecords(authApiBase, remoteAppId);
      if (remoteRecords) return remoteRecords.map(ToTrainingRecord).filter((record): record is BrainTrainingRecord => Boolean(record));
    } catch (error) {
      console.warn('Unable to read remote BrainTrainer records. Falling back to localStorage.', error);
    }
  }

  return GetLocalTrainingRecords();
}

export async function DownloadAllTrainingRecordsCsv(_t: TFunction): Promise<boolean> {
  const records = await GetTrainingRecords();
  if (records.length === 0) return false;
  DownloadCsvFile(BuildTrainingRecordsCsv(records), `braintrainer_records_${FormatFileDate(new Date())}.csv`);
  return true;
}

export function DownloadTrainingRecordCsv(record: BrainTrainingRecord): void {
  DownloadCsvFile(BuildTrainingRecordsCsv([record]), `${SafeFilePart(record.gameId)}_${record.trainingDate ?? FormatFileDate(new Date())}.csv`);
}

export function DownloadTrainingRecordJson(record: BrainTrainingRecord): void {
  DownloadFile(
    JSON.stringify(record, null, 2),
    `${SafeFilePart(record.gameId)}_${record.trainingDate ?? FormatFileDate(new Date())}.json`,
    'application/json;charset=utf-8',
  );
}

function GetLocalTrainingRecords(): BrainTrainingRecord[] {
  const raw = localStorage.getItem(trainingRecordsKey);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map(ToTrainingRecord).filter((record): record is BrainTrainingRecord => Boolean(record))
      : [];
  } catch {
    return [];
  }
}

function ToTrainingRecord(value: unknown): BrainTrainingRecord | null {
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
    details: ToDetailRow(item.details),
    detailRows: Array.isArray(item.detailRows)
      ? item.detailRows.map(ToDetailRow).filter((row): row is DetailRow => Boolean(row))
      : undefined,
  };
}

function ToDetailRow(value: unknown): DetailRow | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as DetailRow
    : undefined;
}

function BuildTrainingRecordsCsv(records: BrainTrainingRecord[]): string {
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
  return CreateCsvContent([
    columns,
    ...rows.map((row) => columns.map((column) => row[column])),
  ]);
}

function FormatFileDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function SafeFilePart(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'braintrainer';
}
