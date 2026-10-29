import { defaultRehabTimeZone, GetServerDate } from './progress.js';
import { SensorAllowed } from '../../../../packages/ui/src/selfContainedGame.js';

export const rawCoordinateKinds = ['hand', 'pose', 'tongue', 'head'];

export function OfficialRecordedDate(claims, timeZone = defaultRehabTimeZone) {
  if (!Number.isSafeInteger(claims?.iat) || claims.iat < 0) throw new TypeError('Invalid session issue time.');
  return GetServerDate(new Date(claims.iat * 1000), timeZone);
}

export function RawCoordinateKindAllowed(gameId, capabilities, kind) {
  if (kind === 'hand') return Array.isArray(capabilities) && capabilities.includes('hand-tracking');
  return SensorAllowed({ gameId, capabilities }, kind);
}

export function RawDataKey(kind, gameId, subjectId, recordedDate, recordId) {
  return `pending/${kind}/${gameId}/${subjectId}/${recordedDate}/${recordId}.csv`;
}

export async function CsvSha256(csv) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(csv));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function StoreImmutableCsv(bucket, key, csv, metadata) {
  if (!bucket?.put || !bucket?.get) throw new Error('Raw storage unavailable.');
  const sha256 = await CsvSha256(csv);
  const options = { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'text/csv; charset=utf-8' },
    customMetadata: { ...metadata, sha256 } };
  const MatchesMetadata = object => metadata.officialGameVersion === undefined
    || (object?.customMetadata?.officialGameVersion === metadata.officialGameVersion
      && object?.customMetadata?.gazeSampleCount === metadata.gazeSampleCount);
  const previous = await bucket.get(key);
  if (previous && (!MatchesMetadata(previous) || await CsvSha256(await previous.text()) !== sha256)) return null;
  // Sync deletes CSVs; a reserved checksum survives archival and interrupted writes.
  const reserved = await bucket.put(`checksums/${key}`, '', { onlyIf: options.onlyIf, customMetadata: options.customMetadata });
  if (!reserved) {
    const checksum = await bucket.get(`checksums/${key}`);
    if (checksum?.customMetadata?.sha256 !== sha256 || !MatchesMetadata(checksum)) return null;
    options.customMetadata = { ...checksum.customMetadata };
  }
  const written = await bucket.put(key, csv, options);
  if (!written) {
    const existing = await bucket.get(key);
    if (!existing || !MatchesMetadata(existing) || await CsvSha256(await existing.text()) !== sha256) {
      return null;
    }
  }
  // Only a completed write gets a receipt that can authorize a summary after the CSV has been archived.
  const receipt = await bucket.put(`receipts/${key}`, '', { onlyIf: options.onlyIf, customMetadata: options.customMetadata });
  if (!receipt && (await bucket.get(`receipts/${key}`))?.customMetadata?.sha256 !== sha256) return null;
  return sha256;
}

export function BuildRoundsCsv(rounds) {
  const keys = [...new Set(rounds.flatMap(row => Object.keys(row)))];
  return [['round_index', ...keys].join(','), ...rounds.map((row, index) =>
    [index + 1, ...keys.map(key => !Object.hasOwn(row, key) || row[key] == null ? '' : Decimal(row[key]))].join(','))].join('\n') + '\n';
}

function Decimal(value) {
  const text = String(value);
  if (!text.includes('e')) return text;
  const [mantissa, exponent] = text.split('e');
  const sign = mantissa.startsWith('-') ? '-' : '';
  const unsigned = mantissa.replace('-', '');
  const digits = unsigned.replace('.', '');
  const decimal = (unsigned.indexOf('.') < 0 ? unsigned.length : unsigned.indexOf('.')) + Number(exponent);
  return sign + (decimal <= 0 ? '0.' + '0'.repeat(-decimal) + digits
    : decimal >= digits.length ? digits + '0'.repeat(decimal - digits.length) : digits.slice(0, decimal) + '.' + digits.slice(decimal));
}
