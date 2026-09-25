import {
  ClearAuthToken,
  CreateRemoteTrainingRecordVerificationToken,
  GetAuthToken,
  GetAuthUserIdFromToken,
  SaveRemoteTrainingRecord,
} from '@rehab-trainer/ui/auth/authClient';
import { GetHostedGameSettings, IsEmbeddedHubTraining, SendHostedGameScore } from '@rehab-trainer/ui/embeddedTraining';
import { defaultSiteUrls } from '@rehab-trainer/ui/siteUrls';
import { GetOrCreateSubjectId, GetOrCreateSubjectIdForUser } from '@rehab-trainer/ui/storage/subjectId';
import { FindOculomotorResult } from '../results/resultData';
import { BuildOculomotorMetadata } from './metadata';

interface OculomotorRecord {
  id: string;
  savedAt: string;
  userName: string;
  moduleId: 'oculomotor-training';
  gameId: 'oculomotor-training';
  gameTitle: string;
  difficulty: string;
  results: Record<string, unknown>[];
  details: Record<string, unknown>;
  detailRows: Record<string, unknown>[];
}

const rawFields = new Set(['gaze_records', 'gaze_samples', 'webgazer_data', 'webgazer_targets']);

export async function SaveOculomotorRecord(record: OculomotorRecord): Promise<boolean> {
  const hosted = IsEmbeddedHubTraining();
  const trial = record.results.find((item) => item.trial_type === 'pixi-oculomotor-training');
  const metadata = BuildOculomotorMetadata(trial);
  const summary = Object.fromEntries(Object.entries(trial ?? {}).filter(([key]) => !rawFields.has(key)));
  summary.gaze_record_count = Array.isArray(trial?.gaze_records) ? trial.gaze_records.length : 0;
  const compactRecord = {
    ...record,
    results: [summary],
    details: summary,
    detailRows: [summary],
    metadata,
    config: GetHostedGameSettings() ?? undefined,
  };

  if (!hosted) {
    void SaveRemoteTrainingRecord(defaultSiteUrls.hub, {
      appId: 'rehabtrainerhub', runtimeId: 'vision', record: compactRecord,
    }).catch((error) => {
      console.warn('Unable to save oculomotor summary remotely.', error);
      try {
        localStorage.setItem('rehabtrainerhub.oculomotor.latest-summary', JSON.stringify(compactRecord));
      } catch { /* The summary outbox and result page retain the available data. */ }
    });
  }
  const saved = await SaveOculomotorGazeRecords(record);
  if (hosted && saved) SendOculomotorHostedScore(record);
  return saved;
}

export function SendOculomotorHostedScore(record: OculomotorRecord): void {
  SendHostedGameScore(record, BuildOculomotorMetadata(FindOculomotorResult(record.results)));
}

export async function SaveOculomotorGazeRecords(record: OculomotorRecord): Promise<boolean> {
  const trial = FindOculomotorResult(record.results);
  if (!Array.isArray(trial?.gaze_records) || trial.gaze_records.length === 0) return true;
  const token = GetAuthToken();
  const userId = GetAuthUserIdFromToken(token);
  try {
    const payload = {
      recordId: record.id,
      subjectId: GetOrCreateSubjectIdForUser(userId),
      source: trial.eye_tracking_source,
      records: trial.gaze_records,
      metadata: BuildOculomotorMetadata(trial),
      turnstileToken: await CreateRemoteTrainingRecordVerificationToken(),
    };
    const apiBase = IsEmbeddedHubTraining() ? window.location.origin : defaultSiteUrls.hub;
    const post = (authorization: string | null) => fetch(`${apiBase}/api/oculomotor-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    let response = await post(token);
    if (response.status === 401 && token) {
      ClearAuthToken();
      payload.subjectId = GetOrCreateSubjectId();
      response = await post(null);
    }
    if (!response.ok) throw new Error(`Oculomotor CSV upload failed (${response.status}).`);
    return true;
  } catch (error) {
    console.warn('Unable to save oculomotor CSV remotely.', error);
    return false;
  }
}
