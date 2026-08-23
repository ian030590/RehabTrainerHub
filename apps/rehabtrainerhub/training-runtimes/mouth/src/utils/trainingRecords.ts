import {
  GetRemoteTrainingRecords,
  HasAuthToken,
  SaveRemoteTrainingRecord,
} from '@rehab-trainer/ui/auth/authClient';
import { CreateCsvContent } from '@rehab-trainer/ui/csv';
import { DownloadCsvFile } from '@rehab-trainer/ui/downloadFile';
import type { TranslationKey } from '../i18n';
import { GetSetting, storagePrefix } from './settings';
import { siteUrls } from './siteUrls';

type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;
type DetailRow = Record<string, unknown>;

interface MouthTrainingRecord {
  id: string;
  savedAt: string;
  trainingDate?: string;
  userName: string;
  moduleId: string;
  moduleName?: string;
  gameId: string;
  gameTitle: string;
  difficulty: string;
  details?: DetailRow;
  detailRows?: DetailRow[];
}

interface SaveTrainingSessionRecordArgs {
  userName: string;
  moduleId: string;
  moduleName?: string;
  gameId: string;
  gameTitle: string;
  difficulty: string;
  trainingDate?: string;
  details?: DetailRow;
  detailRows?: DetailRow[];
}

const recordsKey = `${storagePrefix}training_records_v1`;
const remoteAppId = 'mouthtrainer';

export async function SaveTrainingSessionRecord(args: SaveTrainingSessionRecordArgs): Promise<MouthTrainingRecord | null> {
  const record: MouthTrainingRecord = {
    id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    savedAt: new Date().toISOString(),
    trainingDate: args.trainingDate,
    userName: args.userName,
    moduleId: args.moduleId,
    moduleName: args.moduleName,
    gameId: args.gameId,
    gameTitle: args.gameTitle,
    difficulty: args.difficulty,
    details: args.details,
    detailRows: args.detailRows,
  };

  if (HasAuthToken()) {
    try {
      const saved = await SaveRemoteTrainingRecord(siteUrls.hub, { appId: remoteAppId, record });
      if (saved) return record;
    } catch (error) {
      console.warn('Unable to save remote MouthTrainer record. Falling back to localStorage.', error);
    }
  }

  const records = ReadLocalRecords();
  records.push(record);
  localStorage.setItem(recordsKey, JSON.stringify(records));
  return record;
}

export async function DownloadAllTrainingRecordsCsv(_t: TFunction): Promise<boolean> {
  const records = await GetRecords();
  if (!records.length) return false;
  const date = new Date().toISOString().slice(0, 10);
  const prefix = GetSetting('downloadDirectory');
  DownloadCsvFile(BuildCsv(records), `${prefix ? `${prefix}_` : ''}mouthtrainer_records_${date}.csv`);
  return true;
}

async function GetRecords(): Promise<MouthTrainingRecord[]> {
  if (HasAuthToken()) {
    try {
      const records = await GetRemoteTrainingRecords(siteUrls.hub, remoteAppId);
      if (records) return records.map(ToRecord).filter((record): record is MouthTrainingRecord => Boolean(record));
    } catch (error) {
      console.warn('Unable to read remote MouthTrainer records. Falling back to localStorage.', error);
    }
  }
  return ReadLocalRecords();
}

function ReadLocalRecords(): MouthTrainingRecord[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(recordsKey) || '[]');
    return Array.isArray(value) ? value.map(ToRecord).filter((record): record is MouthTrainingRecord => Boolean(record)) : [];
  } catch {
    return [];
  }
}

function ToRecord(value: unknown): MouthTrainingRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.savedAt !== 'string' || typeof item.userName !== 'string' || typeof item.moduleId !== 'string') return null;
  return {
    id: item.id,
    savedAt: item.savedAt,
    trainingDate: typeof item.trainingDate === 'string' ? item.trainingDate : undefined,
    userName: item.userName,
    moduleId: item.moduleId,
    moduleName: typeof item.moduleName === 'string' ? item.moduleName : undefined,
    gameId: typeof item.gameId === 'string' ? item.gameId : item.moduleId,
    gameTitle: typeof item.gameTitle === 'string' ? item.gameTitle : item.moduleId,
    difficulty: typeof item.difficulty === 'string' ? item.difficulty : '',
    details: ToDetailRow(item.details),
    detailRows: Array.isArray(item.detailRows) ? item.detailRows.map(ToDetailRow).filter((row): row is DetailRow => Boolean(row)) : undefined,
  };
}

function ToDetailRow(value: unknown): DetailRow | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as DetailRow : undefined;
}

function BuildCsv(records: MouthTrainingRecord[]): string {
  const rows = records.flatMap((record) => {
    const detailRows = record.detailRows?.length ? record.detailRows : [{}];
    return detailRows.map((detail, index): DetailRow => ({
      Saved_At: record.savedAt,
      Training_Date: record.trainingDate ?? '',
      User: record.userName,
      Module: record.moduleName ?? record.moduleId,
      Module_ID: record.moduleId,
      Game: record.gameTitle,
      Game_ID: record.gameId,
      Difficulty: record.difficulty,
      Detail_Row: detailRows.length > 1 ? index + 1 : '',
      ...record.details,
      ...detail,
    }));
  });
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return CreateCsvContent([columns, ...rows.map((row) => columns.map((column) => row[column]))]);
}
