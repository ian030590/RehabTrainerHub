import { unzipSync } from 'fflate';

export const gamePackageLimits = Object.freeze({
  maximumCompressedBytes: 12 * 1024 * 1024,
  maximumFileBytes: 8 * 1024 * 1024,
  maximumFileCount: 192,
  maximumFindingCount: 200,
  maximumTextLineLength: 5000,
  maximumTotalBytes: 24 * 1024 * 1024,
  maximumTotalTextBytes: 4 * 1024 * 1024,
  maximumZipRatio: 100,
});

// Keep these root-relative URLs synchronized with the isolated runner's
// functions/_lib/runtime.js contract. Root-relative URLs always resolve on the
// runner origin, including when production moves to another registrable domain.
export const gamePackageRuntimeContract = Object.freeze({
  jsPsychVersion: '8.2.3',
  jsPsychUrl: '/runtime/jspsych-8.2.3.js',
  jsPsychCssUrl: '/runtime/jspsych-8.2.3.css',
  gameSdkVersion: '0.1.0',
  gameSdkUrl: '/runtime/trainerhub-game-sdk-0.1.0.js',
});

const entryPath = 'index.html';
const allowedCapabilities = new Set([
  'audio',
  'fullscreen',
  'keyboard',
  'pointer',
]);
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.mp3', 'audio/mpeg'],
  ['.mp4', 'video/mp4'],
  ['.ogg', 'audio/ogg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.wav', 'audio/wav'],
  ['.webm', 'video/webm'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
]);
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.mjs', '.svg']);
const blockedSourcePatterns = [
  ['network-fetch', /\bfetch\s*\(/i, 'fetch is not allowed; game results must use the platform bridge.'],
  ['network-xhr', /\bXMLHttpRequest\b/i, 'XMLHttpRequest is not allowed.'],
  ['network-websocket', /\bWebSocket\b/i, 'WebSocket is not allowed.'],
  ['network-event-source', /\bEventSource\b/i, 'EventSource is not allowed.'],
  ['network-beacon', /\bsendBeacon\s*\(/i, 'sendBeacon is not allowed.'],
  ['network-webrtc', /\b(?:webkit)?RTCPeerConnection\b/i, 'WebRTC peer connections are not allowed.'],
  ['cookie-access', /\bdocument\s*\.\s*cookie\b/i, 'Cookie access is not allowed.'],
  ['navigation', /\b(?:window\s*\.\s*)?location\s*(?:\.|=)/i, 'Page navigation is not allowed.'],
  ['top-navigation', /\b(?:window\s*\.\s*)?top\s*(?:\.|\[)/i, 'Top-window access is not allowed.'],
  ['computed-global-access', /\b(?:globalThis|window|self|document|parent|top|frames)\s*\[/i, 'Computed access to browser globals is not allowed.'],
  ['reflective-access', /\bReflect\s*\.\s*(?:get|set|construct)\s*\(/i, 'Reflective property access is not allowed.'],
  ['window-open', /\b(?:window\s*\.\s*)?open\s*\(/i, 'Opening another browsing context is not allowed.'],
  ['history-navigation', /\bhistory\s*\.\s*(?:back|forward|go|pushState|replaceState)\s*\(/i, 'History navigation is not allowed.'],
  ['document-write', /\bdocument\s*\.\s*(?:open|write|writeln)\s*\(/i, 'Dynamic document replacement is not allowed.'],
  ['service-worker', /\bserviceWorker\b/i, 'Uploaded code cannot register a service worker.'],
  ['worker', /\b(?:SharedWorker|Worker|importScripts)\b/i, 'Uploaded code cannot create workers.'],
  ['dynamic-code', /\b(?:eval\s*\(|new\s+Function\b|Function\s*\()/i, 'Dynamic code evaluation is not allowed.'],
  ['encoded-code', /\b(?:atob|btoa)\s*\(/i, 'Encoded source helpers require manual rejection.'],
  ['external-url', /\bhttps?:\/\/|(?:src|href)\s*=\s*["']\s*\/\//i, 'External URLs are not allowed in a game package.'],
  ['form', /<\s*form\b/i, 'Form submission is not allowed.'],
  ['anchor-navigation', /<\s*a\b[^>]*\bhref\s*=/i, 'Navigational links are not allowed in a game package.'],
  ['css-import', /@import\b/i, 'CSS imports are not allowed.'],
  ['nested-frame', /<\s*(?:iframe|frame|object|embed)\b/i, 'Nested browsing contexts and embedded objects are not allowed.'],
  ['base-element', /<\s*base\b/i, 'The base element is not allowed.'],
  ['meta-refresh', /<\s*meta\b[^>]*http-equiv\s*=\s*["']?refresh/i, 'Meta refresh is not allowed.'],
];

export function NormalizeGameCapabilities(value) {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value || '[]');
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed)) return null;
  const normalized = [...new Set(parsed.map((item) => String(item || '').trim()))].sort();
  return normalized.every((item) => allowedCapabilities.has(item)) ? normalized : null;
}

export async function InspectGamePackage(file) {
  if (!IsUploadedFile(file)) {
    throw new GamePackageError('A game HTML or ZIP file is required.', 'missing-package');
  }
  if (file.size <= 0 || file.size > gamePackageLimits.maximumCompressedBytes) {
    throw new GamePackageError('The game package must be between 1 byte and 12 MB.', 'package-size');
  }

  const packageBytes = new Uint8Array(await file.arrayBuffer());
  const artifactType = DetectArtifactType(file, packageBytes);
  const rawFiles = artifactType === 'html'
    ? new Map([[entryPath, packageBytes]])
    : ExtractZipFiles(packageBytes);
  if (!rawFiles.has(entryPath)) {
    throw new GamePackageError('The package root must contain index.html.', 'missing-entry');
  }
  const entryHtml = DecodeUtf8(rawFiles.get(entryPath), entryPath);

  const files = [];
  const findings = [];
  let totalBytes = 0;
  let totalTextBytes = 0;
  let executableCorpus = '';
  let sourceCorpus = '';
  for (const [path, bytes] of rawFiles) {
    const normalizedPath = NormalizePackagePath(path);
    if (!normalizedPath) {
      throw new GamePackageError(`Unsafe package path: ${path}`, 'unsafe-path');
    }
    const contentType = GetContentType(normalizedPath);
    if (!contentType) {
      AddFinding(findings, {
        severity: 'block',
        code: 'unsupported-file-type',
        filePath: normalizedPath,
        message: 'This file type is not allowed in a game package.',
      });
      continue;
    }
    if (bytes.byteLength > gamePackageLimits.maximumFileBytes) {
      throw new GamePackageError(`Package file is larger than 8 MB: ${normalizedPath}`, 'file-size');
    }
    totalBytes += bytes.byteLength;
    if (totalBytes > gamePackageLimits.maximumTotalBytes) {
      throw new GamePackageError('Expanded game package is larger than 24 MB.', 'expanded-size');
    }

    const extension = GetExtension(normalizedPath);
    if (textExtensions.has(extension)) {
      totalTextBytes += bytes.byteLength;
      if (totalTextBytes > gamePackageLimits.maximumTotalTextBytes) {
        throw new GamePackageError('Executable and text source is larger than 4 MB.', 'source-size');
      }
      const source = DecodeUtf8(bytes, normalizedPath);
      sourceCorpus += `\n${source}`;
      if (extension === '.js' || extension === '.mjs') {
        executableCorpus += `\n${StripCommentsAndStrings(source)}`;
      } else if (extension === '.html') {
        executableCorpus += `\n${ExtractExecutableSource(source)}`;
      }
      ScanSource(normalizedPath, source, findings);
    } else {
      ScanBinarySignature(normalizedPath, extension, bytes, findings);
    }
    files.push({
      path: normalizedPath,
      bytes,
      byteSize: bytes.byteLength,
      contentType,
      sha256: await Sha256Hex(bytes),
    });
  }

  if (!HasExactClassicScriptSource(entryHtml, gamePackageRuntimeContract.jsPsychUrl)) {
    AddFinding(findings, {
      severity: 'block',
      code: 'missing-platform-jspsych-runtime',
      filePath: entryPath,
      message: `Load the platform jsPsych ${gamePackageRuntimeContract.jsPsychVersion} runtime from ${gamePackageRuntimeContract.jsPsychUrl}.`,
    });
  }
  if (!HasExactNamedModuleImport(
    sourceCorpus,
    'RunTrainerHubJsPsychGame',
    gamePackageRuntimeContract.gameSdkUrl,
  )) {
    AddFinding(findings, {
      severity: 'block',
      code: 'missing-platform-sdk-runtime',
      filePath: entryPath,
      message: `Import RunTrainerHubJsPsychGame from ${gamePackageRuntimeContract.gameSdkUrl}.`,
    });
  }

  const passesJsPsychInitializer = /\binitJsPsych\s*\(/.test(executableCorpus)
    || /\binitJsPsych\s*:\s*(?:jsPsychModule\s*\.\s*)?initJsPsych\b/.test(executableCorpus)
    || /\{\s*initJsPsych\s*[,}]/.test(executableCorpus);
  if (!passesJsPsychInitializer) {
    AddFinding(findings, {
      severity: 'block',
      code: 'missing-jspsych',
      filePath: entryPath,
      message: 'Pass the platform jsPsychModule.initJsPsych initializer to the Game SDK.',
    });
  }
  if (!/\bawait\s+RunTrainerHubJsPsychGame\s*\(/.test(executableCorpus)) {
    AddFinding(findings, {
      severity: 'block',
      code: 'missing-platform-bridge',
      filePath: entryPath,
      message: 'The game must run its jsPsych timeline through RunTrainerHubJsPsychGame().',
    });
  }

  const blockCount = findings.filter((finding) => finding.severity === 'block').length;
  const reviewCount = findings.filter((finding) => finding.severity === 'review').length;
  return {
    artifactType,
    blockCount,
    contentSha256: await Sha256Hex(packageBytes),
    entryPath,
    files,
    findings,
    packageData: packageBytes,
    packageBytes: packageBytes.byteLength,
    reviewCount,
    totalBytes,
  };
}

function ExtractExecutableSource(html) {
  const scripts = [];
  const scriptPattern = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;
  let match;
  while ((match = scriptPattern.exec(html)) !== null) {
    scripts.push(StripCommentsAndStrings(match[1]));
  }
  return scripts.join('\n');
}

function StripCommentsAndStrings(source) {
  let result = '';
  let mode = 'code';
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (mode === 'line-comment') {
      if (character === '\n') {
        mode = 'code';
        result += '\n';
      } else {
        result += ' ';
      }
      continue;
    }
    if (mode === 'block-comment') {
      if (character === '*' && next === '/') {
        result += '  ';
        index += 1;
        mode = 'code';
      } else {
        result += character === '\n' ? '\n' : ' ';
      }
      continue;
    }
    if (mode !== 'code') {
      result += character === '\n' ? '\n' : ' ';
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if ((mode === 'single-string' && character === "'")
        || (mode === 'double-string' && character === '"')
        || (mode === 'template-string' && character === '`')) {
        mode = 'code';
      }
      continue;
    }
    if (character === '/' && next === '/') {
      result += '  ';
      index += 1;
      mode = 'line-comment';
    } else if (character === '/' && next === '*') {
      result += '  ';
      index += 1;
      mode = 'block-comment';
    } else if (character === "'") {
      result += ' ';
      mode = 'single-string';
    } else if (character === '"') {
      result += ' ';
      mode = 'double-string';
    } else if (character === '`') {
      result += ' ';
      mode = 'template-string';
    } else {
      result += character;
    }
  }
  return result;
}

export function NormalizeGameSlug(value) {
  const slug = String(value || '').trim().toLowerCase();
  return /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(slug) ? slug : null;
}

export function NormalizeGameVersion(value) {
  const version = String(value || '').trim();
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(version)
    && version.length <= 64
    ? version
    : null;
}

export function NormalizePackagePath(value) {
  const path = String(value || '').normalize('NFC');
  if (
    !path
    || path.length > 240
    || path.startsWith('/')
    || path.endsWith('/')
    || path.includes('\\')
    || path.includes('?')
    || path.includes('#')
    || path.includes('%')
    || path.includes('\0')
    || /[\u0000-\u001f\u007f]/.test(path)
    || !/^[A-Za-z0-9._/-]+$/.test(path)
  ) {
    return null;
  }
  const segments = path.split('/');
  if (segments.some((segment) => (
    !segment
    || segment === '.'
    || segment === '..'
    || segment.length > 100
    || segment.startsWith('.')
    || segment.includes(':')
  ))) {
    return null;
  }
  return segments.join('/');
}

export class GamePackageError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'GamePackageError';
    this.code = code;
  }
}

function IsUploadedFile(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof value.arrayBuffer === 'function'
    && Number.isFinite(value.size),
  );
}

function DetectArtifactType(file, bytes) {
  const name = String(file.name || '').toLowerCase();
  const type = String(file.type || '').toLowerCase().split(';')[0];
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (isZip && (name.endsWith('.zip') || type === 'application/zip' || !type)) return 'zip';
  if (name.endsWith('.html') || name.endsWith('.htm') || type === 'text/html') return 'html';
  throw new GamePackageError('Only a single HTML file or a ZIP package is accepted.', 'artifact-type');
}

function ExtractZipFiles(bytes) {
  const entries = ReadZipCentralDirectory(bytes);
  const extracted = unzipSync(bytes);
  const files = new Map();
  const extractedNames = new Map(
    Object.entries(extracted).map(([name, value]) => [name.normalize('NFC'), value]),
  );
  for (const entry of entries) {
    if (entry.directory) continue;
    const value = extractedNames.get(entry.path);
    if (!value || value.byteLength !== entry.uncompressedSize) {
      throw new GamePackageError(`Unable to safely expand ${entry.path}.`, 'zip-expand');
    }
    files.set(entry.path, value);
  }
  return files;
}

function ReadZipCentralDirectory(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = FindEndOfCentralDirectory(view);
  if (eocdOffset < 0) throw new GamePackageError('Invalid ZIP directory.', 'zip-directory');
  const diskNumber = view.getUint16(eocdOffset + 4, true);
  const centralDisk = view.getUint16(eocdOffset + 6, true);
  const diskEntries = view.getUint16(eocdOffset + 8, true);
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralSize = view.getUint32(eocdOffset + 12, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);
  if (diskNumber !== 0 || centralDisk !== 0 || diskEntries !== totalEntries) {
    throw new GamePackageError('Multi-volume ZIP files are not accepted.', 'zip-multivolume');
  }
  if (totalEntries === 0 || totalEntries > gamePackageLimits.maximumFileCount) {
    throw new GamePackageError(
      `ZIP packages may contain at most ${gamePackageLimits.maximumFileCount} files.`,
      'zip-file-count',
    );
  }
  if (centralOffset + centralSize > eocdOffset) {
    throw new GamePackageError('Invalid ZIP central directory bounds.', 'zip-directory');
  }

  const entries = [];
  const seenPaths = new Set();
  let offset = centralOffset;
  let totalBytes = 0;
  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== 0x02014b50) {
      throw new GamePackageError('Invalid ZIP entry.', 'zip-entry');
    }
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const externalAttributes = view.getUint32(offset + 38, true);
    const end = offset + 46 + nameLength + extraLength + commentLength;
    if (end > bytes.byteLength) throw new GamePackageError('Truncated ZIP entry.', 'zip-entry');
    if ((flags & 0x1) !== 0) throw new GamePackageError('Encrypted ZIP entries are not accepted.', 'zip-encrypted');
    if (![0, 8].includes(method)) throw new GamePackageError('Unsupported ZIP compression method.', 'zip-compression');
    const unixMode = (externalAttributes >>> 16) & 0xffff;
    if ((unixMode & 0xf000) === 0xa000) {
      throw new GamePackageError('ZIP symbolic links are not accepted.', 'zip-symlink');
    }
    const rawName = bytes.subarray(offset + 46, offset + 46 + nameLength);
    const path = DecodeZipName(rawName, flags).normalize('NFC');
    const directory = path.endsWith('/');
    const normalizedPath = directory ? NormalizeDirectoryPath(path) : NormalizePackagePath(path);
    if (!normalizedPath) throw new GamePackageError(`Unsafe ZIP path: ${path}`, 'unsafe-path');
    const comparisonPath = normalizedPath.toLocaleLowerCase('en-US');
    if (seenPaths.has(comparisonPath)) {
      throw new GamePackageError(`Duplicate ZIP path: ${normalizedPath}`, 'duplicate-path');
    }
    seenPaths.add(comparisonPath);
    if (!directory) {
      if (uncompressedSize > gamePackageLimits.maximumFileBytes) {
        throw new GamePackageError(`ZIP entry is larger than 8 MB: ${normalizedPath}`, 'file-size');
      }
      totalBytes += uncompressedSize;
      if (totalBytes > gamePackageLimits.maximumTotalBytes) {
        throw new GamePackageError('Expanded ZIP is larger than 24 MB.', 'expanded-size');
      }
      if (
        uncompressedSize > 1024 * 1024
        && compressedSize > 0
        && uncompressedSize / compressedSize > gamePackageLimits.maximumZipRatio
      ) {
        throw new GamePackageError(`Suspicious ZIP compression ratio: ${normalizedPath}`, 'zip-bomb');
      }
    }
    entries.push({
      compressedSize,
      directory,
      path: normalizedPath,
      uncompressedSize,
    });
    offset = end;
  }
  return entries;
}

function FindEndOfCentralDirectory(view) {
  const minimumOffset = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  return -1;
}

function DecodeZipName(bytes, flags) {
  const utf8 = (flags & 0x800) !== 0;
  if (!utf8 && bytes.some((byte) => byte > 0x7f)) {
    throw new GamePackageError('Non-UTF-8 ZIP paths are not accepted.', 'zip-path-encoding');
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new GamePackageError('Invalid UTF-8 ZIP path.', 'zip-path-encoding');
  }
}

function NormalizeDirectoryPath(value) {
  const trimmed = String(value).replace(/\/+$/, '');
  return NormalizePackagePath(`${trimmed}/placeholder`)?.replace(/\/placeholder$/, '') || null;
}

function DecodeUtf8(bytes, path) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new GamePackageError(`Text file is not valid UTF-8: ${path}`, 'text-encoding');
  }
}

function ScanSource(path, source, findings) {
  if (IsBundledPlatformRuntime(path, source)) {
    AddFinding(findings, {
      severity: 'block',
      code: 'bundled-platform-runtime',
      filePath: path,
      message: 'Do not bundle jsPsych or the TrainerHub Game SDK; load the reviewed platform runtime from /runtime/.',
    });
  }
  for (const [code, pattern, message] of blockedSourcePatterns) {
    if (pattern.test(source)) {
      AddFinding(findings, { severity: 'block', code, filePath: path, message });
    }
  }
  if (source.split(/\r?\n/).some((line) => line.length > gamePackageLimits.maximumTextLineLength)) {
    AddFinding(findings, {
      severity: 'block',
      code: 'minified-or-obfuscated',
      filePath: path,
      message: 'Source lines must remain readable and may not exceed 5,000 characters.',
    });
  }
  const escapedTokens = source.match(/\\(?:x[0-9a-f]{2}|u[0-9a-f]{4})/gi)?.length ?? 0;
  if (escapedTokens > 30 && escapedTokens * 20 > source.length) {
    AddFinding(findings, {
      severity: 'block',
      code: 'encoded-source',
      filePath: path,
      message: 'The source contains an unusually high amount of encoded text.',
    });
  }
}

function HasExactClassicScriptSource(html, expectedUrl) {
  const escapedUrl = EscapeRegExp(expectedUrl);
  const tagPattern = /<script\b[^>]*>/gi;
  const sourcePattern = new RegExp(`\\bsrc\\s*=\\s*(["'])${escapedUrl}\\1`, 'i');
  let match;
  while ((match = tagPattern.exec(html)) !== null) {
    if (sourcePattern.test(match[0])
      && !/\btype\s*=\s*(["'])module\1/i.test(match[0])
      && !/\basync\b/i.test(match[0])) return true;
  }
  return false;
}

function HasExactNamedModuleImport(source, exportedName, expectedUrl) {
  const escapedName = EscapeRegExp(exportedName);
  const escapedUrl = EscapeRegExp(expectedUrl);
  return new RegExp(
    `\\bimport\\s*\\{[^}]*\\b${escapedName}\\b[^}]*\\}\\s*from\\s*(["'])${escapedUrl}\\1`,
    'i',
  ).test(source);
}

function IsBundledPlatformRuntime(path, source) {
  const knownRuntimeName = /(?:^|\/)(?:jspsych(?:\.browser)?(?:\.min)?|trainerhub-game-sdk(?:-[0-9.]+)?(?:\.min)?)\.(?:js|mjs)$/i;
  return knownRuntimeName.test(path)
    || (/\bvar\s+jsPsychModule\s*=\s*\(function\s*\(exports\)/.test(source)
      && /\bvar\s+initJsPsych\s*=\s*jsPsychModule\.initJsPsych\b/.test(source))
    || (/\bexport\s+async\s+function\s+RunTrainerHubJsPsychGame\s*\(/.test(source)
      && source.includes('trainerhub.game-platform/v1'));
}

function EscapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ScanBinarySignature(path, extension, bytes, findings) {
  const valid = extension === '.png'
    ? bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    : extension === '.jpg' || extension === '.jpeg'
      ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : extension === '.gif'
        ? bytes.length >= 6 && String.fromCharCode(...bytes.subarray(0, 3)) === 'GIF'
        : extension === '.webp'
          ? bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF'
            && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP'
          : true;
  if (!valid) {
    AddFinding(findings, {
      severity: 'block',
      code: 'mime-signature-mismatch',
      filePath: path,
      message: 'The file signature does not match its extension.',
    });
  }
}

function AddFinding(findings, finding) {
  if (findings.length < gamePackageLimits.maximumFindingCount) findings.push(finding);
}

function GetExtension(path) {
  const match = String(path).toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] ?? '';
}

function GetContentType(path) {
  return contentTypes.get(GetExtension(path)) ?? null;
}

async function Sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
