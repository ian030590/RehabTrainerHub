import { SaveRemoteTrainingRecord } from '@rehab-trainer/ui/auth/authClient';
import { GetHostedGameSettings, SendHostedGameScore } from '@rehab-trainer/ui/embeddedTraining';
import { defaultSiteUrls } from '@rehab-trainer/ui/siteUrls';

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

export async function SaveOculomotorRecord(record: OculomotorRecord): Promise<void> {
  if (SendHostedGameScore(record)) return;

  const trial = record.results.find((item) => item.trial_type === 'pixi-oculomotor-training');
  const summary = Object.fromEntries(Object.entries(trial ?? {}).filter(([key]) => !rawFields.has(key)));
  summary.gaze_record_count = Array.isArray(trial?.gaze_records) ? trial.gaze_records.length : 0;
  const compactRecord = {
    ...record,
    id: crypto.randomUUID(),
    results: [summary],
    details: summary,
    detailRows: [summary],
    config: GetHostedGameSettings() ?? undefined,
  };

  try {
    await SaveRemoteTrainingRecord(defaultSiteUrls.hub, {
      appId: 'rehabtrainerhub',
      runtimeId: 'vision',
      record: compactRecord,
    });
  } catch (error) {
    console.warn('Unable to save oculomotor summary remotely.', error);
    try {
      localStorage.setItem('rehabtrainerhub.oculomotor.latest-summary', JSON.stringify(compactRecord));
    } catch {
      // The complete per-sample record is still available for CSV download on this result page.
    }
  }
}
