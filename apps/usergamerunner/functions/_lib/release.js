export const releaseSchemaVersion = 1;
export const maxReleaseBytes = 512 * 1024;
export const maxReleaseFiles = 192;
export const maxPackageBytes = 24 * 1024 * 1024;
export const maxPackageFileBytes = 8 * 1024 * 1024;

const gameIdPattern = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const fileSegmentPattern = /^[0-9A-Za-z._-]+$/;
const sha256Pattern = /^[0-9a-f]{64}$/;
const allowedCapabilities = new Set([
  'audio',
  'fullscreen',
  'gamepad',
  'keyboard',
  'pointer',
  'touch',
]);

export class ReleaseValidationError extends Error {}

export function IsValidGameId(value) {
  return typeof value === 'string' && value.length <= 64 && gameIdPattern.test(value);
}

export function IsValidVersion(value) {
  return typeof value === 'string' && value.length <= 64 && versionPattern.test(value);
}

export function NormalizePackagePath(value) {
  if (typeof value !== 'string'
    || value.length === 0
    || value.length > 256
    || value.startsWith('/')
    || value.includes('\\')
    || value.includes('?')
    || value.includes('#')
    || value.includes('%')) {
    return null;
  }

  const segments = value.split('/');
  if (segments.some((segment) => segment === ''
    || segment === '.'
    || segment === '..'
    || !fileSegmentPattern.test(segment))) {
    return null;
  }

  return segments.join('/');
}

export function EncodePackagePath(value) {
  return value.split('/').map(encodeURIComponent).join('/');
}

export function ReleaseKey(gameId, version) {
  return `releases/${gameId}/${version}/release.json`;
}

export function PackageKey(gameId, version, path) {
  return `releases/${gameId}/${version}/files/${path}`;
}

export function ParseGameRoute(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/games/')) {
    return null;
  }

  const rawSegments = pathname.split('/');
  if (rawSegments[0] !== '' || rawSegments[1] !== 'games' || rawSegments.length < 4) {
    return { kind: 'invalid' };
  }

  let gameId;
  let version;
  try {
    gameId = decodeURIComponent(rawSegments[2]);
    version = decodeURIComponent(rawSegments[3]);
  } catch {
    return { kind: 'invalid' };
  }

  if (!IsValidGameId(gameId) || !IsValidVersion(version)) {
    return { kind: 'invalid' };
  }

  const basePath = `/games/${encodeURIComponent(gameId)}/${encodeURIComponent(version)}/`;
  if (rawSegments.length === 4) {
    return { kind: 'redirect', basePath, gameId, version };
  }
  if (rawSegments.length === 5 && rawSegments[4] === '') {
    return { kind: 'launcher', basePath, gameId, version };
  }
  if (rawSegments.length !== 5 && rawSegments[4] !== 'package') {
    return { kind: 'invalid' };
  }

  if (rawSegments.length === 5) {
    const resource = rawSegments[4];
    if (resource === 'manifest.webmanifest') {
      return { kind: 'manifest', basePath, gameId, version };
    }
    if (resource === 'sw.js') {
      return { kind: 'service-worker', basePath, gameId, version };
    }
    if (resource === 'icon.svg') {
      return { kind: 'icon', basePath, gameId, version };
    }
    return { kind: 'invalid' };
  }

  if (rawSegments[4] !== 'package' || rawSegments.length < 6) {
    return { kind: 'invalid' };
  }

  let decodedSegments;
  try {
    decodedSegments = rawSegments.slice(5).map((segment) => decodeURIComponent(segment));
  } catch {
    return { kind: 'invalid' };
  }
  const path = NormalizePackagePath(decodedSegments.join('/'));
  if (!path || decodedSegments.some((segment) => segment.includes('/') || segment.includes('\\'))) {
    return { kind: 'invalid' };
  }

  return { kind: 'package', basePath, gameId, version, path };
}

export function ValidateRelease(value, expectedGameId, expectedVersion) {
  AssertPlainRecord(value, 'release');
  if (value.schemaVersion !== releaseSchemaVersion) {
    Fail('Unsupported release schema.');
  }
  if (value.status !== 'approved') {
    Fail('Release is not approved.');
  }
  if (value.gameId !== expectedGameId || value.version !== expectedVersion) {
    Fail('Release identity does not match its object key.');
  }
  if (!IsValidGameId(value.gameId) || !IsValidVersion(value.version)) {
    Fail('Release identity is invalid.');
  }
  AssertBoundedText(value.name, 1, 120, 'name');
  if (value.shortName !== undefined) AssertBoundedText(value.shortName, 1, 30, 'shortName');
  if (value.description !== undefined) AssertBoundedText(value.description, 0, 500, 'description');
  AssertPlainRecord(value.runtime, 'runtime');
  if (value.runtime.name !== 'jspsych' || value.runtime.major !== 8) {
    Fail('Only the approved jsPsych 8 runtime is supported.');
  }
  if (value.contentSha256 !== undefined
    && (typeof value.contentSha256 !== 'string' || !sha256Pattern.test(value.contentSha256))) {
    Fail('contentSha256 is invalid.');
  }
  if (value.approvedAt !== undefined
    && (typeof value.approvedAt !== 'string' || !Number.isFinite(Date.parse(value.approvedAt)))) {
    Fail('approvedAt is invalid.');
  }
  if (value.capabilities !== undefined
    && (!Array.isArray(value.capabilities)
      || value.capabilities.length > allowedCapabilities.size
      || new Set(value.capabilities).size !== value.capabilities.length
      || value.capabilities.some((capability) => typeof capability !== 'string'
        || !allowedCapabilities.has(capability)))) {
    Fail('capabilities is invalid.');
  }

  const entry = NormalizePackagePath(value.entry);
  if (!entry || !/\.html?$/i.test(entry)) {
    Fail('entry must name an HTML file in the release.');
  }
  if (!Array.isArray(value.files) || value.files.length === 0 || value.files.length > maxReleaseFiles) {
    Fail('files must contain a bounded, non-empty file list.');
  }

  const paths = new Set();
  let totalBytes = 0;
  const files = value.files.map((file, index) => {
    AssertPlainRecord(file, `files[${index}]`);
    const path = NormalizePackagePath(file.path);
    if (!path || paths.has(path)) {
      Fail(`files[${index}].path is invalid or duplicated.`);
    }
    paths.add(path);
    if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > maxPackageFileBytes) {
      Fail(`files[${index}].size is invalid.`);
    }
    totalBytes += file.size;
    if (totalBytes > maxPackageBytes) {
      Fail('Release is too large.');
    }
    if (typeof file.sha256 !== 'string' || !sha256Pattern.test(file.sha256)) {
      Fail(`files[${index}].sha256 is invalid.`);
    }
    if (file.contentType !== undefined
      && (typeof file.contentType !== 'string' || file.contentType.length < 1 || file.contentType.length > 100)) {
      Fail(`files[${index}].contentType is invalid.`);
    }
    return Object.freeze({
      path,
      sha256: file.sha256,
      size: file.size,
      contentType: file.contentType,
    });
  });

  if (!paths.has(entry)) {
    Fail('entry is not present in files.');
  }

  return Object.freeze({
    schemaVersion: releaseSchemaVersion,
    status: 'approved',
    gameId: value.gameId,
    version: value.version,
    name: value.name.trim(),
    shortName: (value.shortName ?? value.name).trim().slice(0, 30),
    description: value.description?.trim() || '居家訓練網遊戲',
    runtime: Object.freeze({ name: 'jspsych', major: 8 }),
    capabilities: Object.freeze([...(value.capabilities ?? [])]),
    contentSha256: value.contentSha256,
    approvedAt: value.approvedAt,
    entry,
    files: Object.freeze(files),
    fileByPath: paths,
  });
}

export function ContentTypeForPath(path) {
  const extension = path.slice(path.lastIndexOf('.')).toLowerCase();
  return mimeTypes.get(extension) ?? 'application/octet-stream';
}

function AssertPlainRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    Fail(`${label} must be an object.`);
  }
}

function AssertBoundedText(value, minimum, maximum, label) {
  if (typeof value !== 'string' || value.trim().length < minimum || value.trim().length > maximum) {
    Fail(`${label} is invalid.`);
  }
}

function Fail(message) {
  throw new ReleaseValidationError(message);
}

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.htm', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.csv', 'text/csv; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.ico', 'image/x-icon'],
  ['.mp3', 'audio/mpeg'],
  ['.m4a', 'audio/mp4'],
  ['.wav', 'audio/wav'],
  ['.ogg', 'audio/ogg'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.wasm', 'application/wasm'],
]);
