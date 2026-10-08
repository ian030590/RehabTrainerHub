import releases from '../../../../packages/ui/src/officialGameReleases.json' with { type: 'json' };
import { GetSessionSecret, VerifySignedValue } from './auth.js';
export { releases as officialGameReleases };

export async function VerifyOfficialGameSession(input, env, userId, subjectId) {
  try {
    if (typeof input.runSessionToken !== 'string' || input.runSessionToken.length > 2048
      || input.runSessionToken.split('.').length !== 2) return false;
    const claims = await VerifySignedValue(input.runSessionToken, GetSessionSecret(env));
    const record = input.record;
    return claims.purpose === 'official-game-result'
      && claims.gameId === record?.gameId && record.moduleId === claims.gameId
      && claims.version === input.officialGameVersion && claims.version === releases[claims.gameId]?.version
      && claims.recordId === record.id && claims.userId === (userId || null)
      && claims.subjectId === subjectId;
  } catch { return false; }
}
