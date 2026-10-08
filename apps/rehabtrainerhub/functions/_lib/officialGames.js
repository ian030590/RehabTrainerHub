import releases from '../../../../packages/ui/src/officialGameReleases.json' with { type: 'json' };
import { GetSessionSecret, VerifySignedValue } from './auth.js';
import { ReadOfficialGameRelease } from '../../../usergamerunner/functions/_lib/officialCatalog.js';
export { releases as officialGameReleases };

export async function VerifyOfficialGameSession(input, env, userId, subjectId) {
  let claims;
  try {
    if (typeof input.runSessionToken !== 'string' || input.runSessionToken.length > 2048
      || input.runSessionToken.split('.').length !== 2) return false;
    claims = await VerifySignedValue(input.runSessionToken, GetSessionSecret(env));
  } catch { return false; }
  const record = input.record;
  if (claims.purpose !== 'official-game-result' || !Object.hasOwn(releases, claims.gameId ?? '')
    || claims.gameId !== record?.gameId || record.moduleId !== claims.gameId
    || claims.version !== input.officialGameVersion || claims.recordId !== record.id
    || claims.userId !== (userId || null) || claims.subjectId !== subjectId) return false;
  const release = await ReadOfficialGameRelease(env.GAME_RELEASE_BUCKET, claims.gameId, claims.version);
  return Boolean(release && (claims.contentSha256 === undefined || claims.contentSha256 === release.contentSha256));
}
