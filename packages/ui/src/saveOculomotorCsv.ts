import { CreateRemoteTrainingRecordVerificationToken, GetAuthToken } from './auth/authClient';
import { IsOculomotorCsvPayload } from './oculomotorCsv.js';
export type OculomotorCsvPayload = { records: (string | number | null)[][]; metadata: Record<string, string | number> };
export async function SaveOculomotorCsv(payload: OculomotorCsvPayload, session: { recordId: string; version: string; token: string }, identity: { token: string | null; subjectId: string }) {
  if (!IsOculomotorCsvPayload(payload) || GetAuthToken() !== identity.token) throw new Error('Invalid eye upload or changed identity');
  const turnstileToken = await CreateRemoteTrainingRecordVerificationToken();
  if (GetAuthToken() !== identity.token) throw new Error('Account changed during verification');
  const response = await fetch('/api/oculomotor-data', { method: 'POST', headers: {
    'Content-Type': 'application/json', ...(identity.token ? { Authorization: `Bearer ${identity.token}` } : {}),
  }, body: JSON.stringify({ ...payload, recordId: session.recordId, subjectId: identity.subjectId, source: 'webgazer',
    officialGameVersion: session.version, runSessionToken: session.token, turnstileToken }) });
  if (!response.ok || GetAuthToken() !== identity.token) throw new Error('Eye upload failed or account changed');
}
