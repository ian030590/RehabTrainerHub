import {
  ClearAuthToken,
  CreateRemoteTrainingRecordVerificationToken,
  GetAuthToken,
  GetAuthUserIdFromToken,
} from '@rehab-trainer/ui/auth/authClient';
import { IsEmbeddedHubTraining } from '@rehab-trainer/ui/embeddedTraining';
import { defaultSiteUrls } from '@rehab-trainer/ui/siteUrls';
import { GetOrCreateSubjectId, GetOrCreateSubjectIdForUser } from '@rehab-trainer/ui/storage/subjectId';
import { BuildOculomotorCsvRows } from './oculomotorCsvRows';

export interface OculomotorCsvUpload {
  records: Record<string, unknown>[];
  metadata: Record<string, string | number>;
}

export async function UploadOculomotorCsv(recordId: string, upload: OculomotorCsvUpload): Promise<void> {
  if (!upload.records.length || upload.records.length > 36000) throw new Error('Invalid gaze sample count.');
  const token = GetAuthToken();
  const userId = GetAuthUserIdFromToken(token);
  const payload = {
    recordId,
    subjectId: GetOrCreateSubjectIdForUser(userId),
    source: 'webgazer',
    records: BuildOculomotorCsvRows(upload.records),
    metadata: upload.metadata,
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
}
