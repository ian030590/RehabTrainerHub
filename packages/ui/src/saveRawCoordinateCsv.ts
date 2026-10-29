import { CreateRemoteTrainingRecordVerificationToken, GetAuthToken } from './auth/authClient';
import type { RawCoordinateFile } from './rawCoordinateRecorder.js';

export async function SaveRawCoordinateCsv(file: RawCoordinateFile, session: { recordId: string; version: string; token: string },
  identity: { token: string | null; subjectId: string }, gameId: string) {
  if (GetAuthToken() !== identity.token) throw new Error('Account changed during game');
  const turnstileToken = await CreateRemoteTrainingRecordVerificationToken();
  if (GetAuthToken() !== identity.token) throw new Error('Account changed during verification');
  const response = await fetch('/api/raw-data', { method: 'POST', headers: {
    'Content-Type': 'text/csv; charset=utf-8', ...(identity.token ? { Authorization: `Bearer ${identity.token}` } : {}),
    'X-Raw-Data': JSON.stringify({ kind: file.kind, gameId, officialGameVersion: session.version, recordId: session.recordId,
      subjectId: identity.subjectId, runSessionToken: session.token, truncated: file.truncated, turnstileToken }),
  }, body: file.csv });
  if (!response.ok || GetAuthToken() !== identity.token) throw new Error('Coordinate upload failed or account changed');
}
