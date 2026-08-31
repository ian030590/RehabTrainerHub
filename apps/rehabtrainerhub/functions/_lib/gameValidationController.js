import {
  CreateGameScanReport,
  CreateGameScanReportDigest,
  CreateGameValidationResultMessage,
  IsGameValidationQueueMessage,
  ValidateUnsignedGameScanEvidence,
  gamePlatformPackageLimits,
  gameValidationLimits,
} from '../../../../packages/training-contracts/src/index.js';
import { InspectGamePackage } from './gamePackages.js';

const maximumArtifactBytes = gamePlatformPackageLimits.maximumTotalBytes;
const maximumFileBytes = gamePlatformPackageLimits.maximumFileBytes;
const quarantineArtifactPattern = /^quarantine\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/([a-f0-9]{64})\/artifact$/i;
const quarantineFilePattern = /^quarantine\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/([a-f0-9]{64})\/files\/(.+)$/i;

/**
 * Deployment contract for the queue controller. The controller may read an
 * object from quarantine and sign a bounded result; it has no put/delete or
 * general network capability. A separate Worker/VM supplies the executor and
 * private Ed25519 key when asynchronous validation is enabled.
 */
export const gameValidationControllerPolicy = Object.freeze({
  network: 'deny',
  quarantineAccess: 'read-only',
  releaseAccess: 'none',
  resultTransport: 'hub-internal-token',
  attestation: 'Ed25519',
});

/**
 * Build a deterministic, read-only queue controller. This module intentionally
 * does not claim to be a browser sandbox: `execute` must be supplied by the
 * disposable no-network Worker/VM. Keeping that boundary injectable allows
 * the Hub Functions and controller fixtures to share the same job/report
 * contract without ever executing developer bytes in the Hub request process.
 */
export function CreateGameValidationController({
  quarantineBucket,
  execute,
  signReport,
  toolVersions,
  now = () => Date.now(),
}) {
  if (!quarantineBucket || typeof quarantineBucket.get !== 'function') {
    throw new TypeError('A read-only quarantine bucket is required.');
  }
  if (typeof execute !== 'function') throw new TypeError('A disposable executor is required.');
  if (typeof signReport !== 'function') throw new TypeError('A controller report signer is required.');
  const normalizedToolVersions = NormalizeToolVersions(toolVersions);

  async function Process(message, { signal } = {}) {
    if (!IsGameValidationQueueMessage(message)) return { ok: false, code: 'invalid-message' };
    if (Date.parse(message.job.expiresAt) < now()) return { ok: false, code: 'job-expired' };
    const keyValidation = ValidateQuarantineKeys(message);
    if (!keyValidation.ok) return keyValidation;

    let artifactBytes;
    try {
      artifactBytes = await ReadObjectBytes(
        quarantineBucket,
        message.artifactKey,
        maximumArtifactBytes,
      );
      if (await Sha256Hex(artifactBytes) !== message.job.artifactSha256.toLowerCase()) {
        return { ok: false, code: 'artifact-hash-mismatch' };
      }
    } catch (error) {
      return { ok: false, code: error?.code || 'artifact-read-failed' };
    }

    const files = new Map();
    let totalBytes = artifactBytes.byteLength;
    try {
      for (const key of message.fileKeys) {
        const bytes = await ReadObjectBytes(quarantineBucket, key, maximumFileBytes);
        totalBytes += bytes.byteLength;
        if (totalBytes > maximumArtifactBytes) return { ok: false, code: 'package-size' };
        files.set(key, bytes);
      }
    } catch (error) {
      return { ok: false, code: error?.code || 'file-read-failed' };
    }

    let evidence;
    try {
      evidence = await execute({
        job: message.job,
        artifactBytes,
        files,
        signal,
        policy: gameValidationControllerPolicy,
      });
    } catch {
      return { ok: false, code: 'executor-failed' };
    }
    const evidenceResult = ValidateUnsignedGameScanEvidence(evidence, message.job);
    if (!evidenceResult.ok) return { ok: false, code: `evidence-${evidenceResult.code}` };

    const completedAt = new Date(now()).toISOString();
    const report = CreateGameScanReport({
      job: message.job,
      evidence: evidenceResult.value,
      toolVersions: normalizedToolVersions,
      completedAt,
    });
    let signedReport;
    try {
      signedReport = await signReport(report);
    } catch {
      return { ok: false, code: 'attestation-failed' };
    }
    try {
      const resultMessage = CreateGameValidationResultMessage({
        job: message.job,
        signedReport,
        receivedAt: completedAt,
      });
      return Object.freeze({ ok: true, message: resultMessage, report, evidence: evidenceResult.value });
    } catch {
      return { ok: false, code: 'invalid-signed-report' };
    }
  }

  return Object.freeze({ process: Process });
}

/**
 * Static intake plus an injected dynamic-smoke adapter. The adapter is
 * intentionally required for a clean pass; without it the evidence contains
 * a manual-review finding so deployment cannot accidentally advertise a full
 * malware CI result while only the synchronous scanner ran.
 */
export function CreateDisposableGameExecutor({
  inspect = InspectGamePackage,
  dynamicSmoke = null,
}) {
  if (typeof inspect !== 'function') throw new TypeError('A static package inspector is required.');
  if (dynamicSmoke !== null && typeof dynamicSmoke !== 'function') {
    throw new TypeError('Dynamic smoke adapter must be a function or null.');
  }

  return async function execute({ job, artifactBytes, files, signal }) {
    ThrowIfAborted(signal);
    const artifactFile = CreateArtifactFile(artifactBytes);
    const inspection = await inspect(artifactFile);
    ThrowIfAborted(signal);
    const findings = inspection.findings.map((finding) => ({
      disposition: finding.severity === 'block'
        ? 'hard-block'
        : finding.severity === 'review'
          ? 'fix-or-manual-review'
          : 'info',
      code: String(finding.code || 'static-finding').slice(0, gameValidationLimits.maximumCodeLength),
      filePath: finding.filePath || null,
      line: Number.isSafeInteger(finding.line) && finding.line > 0 ? finding.line : null,
      column: Number.isSafeInteger(finding.column) && finding.column > 0 ? finding.column : null,
      messageKey: String(finding.message || 'game.validation.staticFinding')
        .slice(0, gameValidationLimits.maximumMessageLength),
      evidence: null,
    }));
    let observedNetworkAttempts = [];
    let truncated = false;
    if (dynamicSmoke) {
      const dynamicResult = await dynamicSmoke({ job, artifactBytes, files, signal, policy: gameValidationControllerPolicy });
      if (!dynamicResult || !Array.isArray(dynamicResult.observedNetworkAttempts)
        || !Array.isArray(dynamicResult.findings)
        || typeof dynamicResult.truncated !== 'boolean') {
        throw new TypeError('Dynamic smoke evidence does not match the validator contract.');
      }
      observedNetworkAttempts = dynamicResult.observedNetworkAttempts;
      truncated = dynamicResult.truncated;
      findings.push(...dynamicResult.findings);
      for (const attempt of observedNetworkAttempts) {
        if (attempt.targetClass === 'same-runner-origin' || attempt.count <= 0) continue;
        findings.push({
          disposition: 'hard-block',
          code: 'network-attempt-observed',
          filePath: null,
          line: null,
          column: null,
          messageKey: 'game.validation.networkAttemptObserved',
          evidence: String(attempt.targetSample || '').slice(0, gameValidationLimits.maximumMessageLength),
        });
      }
    } else {
      findings.push({
        disposition: 'manual-review',
        code: 'dynamic-smoke-not-run',
        filePath: null,
        line: null,
        column: null,
        messageKey: 'game.validation.dynamicSmokeRequired',
        evidence: null,
      });
    }

    return {
      schemaVersion: 1,
      jobId: job.jobId,
      attempt: job.attempt,
      jobNonce: job.jobNonce,
      artifactSha256: job.artifactSha256,
      observedNetworkAttempts,
      findings: findings.slice(0, gameValidationLimits.maximumFindingCount),
      truncated,
    };
  };
}

export function CreateEd25519ReportSigner({ privateKey, keyId }) {
  if (!privateKey || typeof keyId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(keyId)) {
    throw new TypeError('A controller Ed25519 key and key id are required.');
  }
  return async function signReport(report) {
    const payload = new TextEncoder().encode(JSON.stringify(SortJsonValue(report)));
    const signature = await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, payload);
    return {
      report,
      reportSha256: await CreateGameScanReportDigest(report),
      attestation: {
        keyId,
        algorithm: 'Ed25519',
        value: EncodeBase64Url(new Uint8Array(signature)),
      },
    };
  };
}

function ValidateQuarantineKeys(message) {
  const artifactMatch = quarantineArtifactPattern.exec(message.artifactKey);
  if (!artifactMatch || artifactMatch[1].toLowerCase() !== message.job.artifactSha256.toLowerCase()) {
    return { ok: false, code: 'unsafe-artifact-key' };
  }
  const prefix = message.artifactKey.slice(0, -'/artifact'.length);
  const seen = new Set();
  for (const key of message.fileKeys) {
    const match = quarantineFilePattern.exec(key);
    if (!match || match[1].toLowerCase() !== message.job.artifactSha256.toLowerCase()
      || !key.startsWith(`${prefix}/files/`)
      || !IsSafePackagePath(match[2])
      || seen.has(key)) {
      return { ok: false, code: 'unsafe-file-key' };
    }
    seen.add(key);
  }
  return { ok: true };
}

function IsSafePackagePath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 240
    || value.includes('..') || value.includes('\\') || value.includes('%')
    || !/^[A-Za-z0-9._/-]+$/.test(value)) return false;
  return value.split('/').every((segment) => (
    segment.length > 0 && segment.length <= 100 && segment !== '.' && segment !== '..' && !segment.startsWith('.')
  ));
}

async function ReadObjectBytes(bucket, key, maximumBytes) {
  const object = await bucket.get(key);
  if (!object) throw CreateControllerError('object-not-found');
  if (Number.isFinite(object.size) && (object.size < 0 || object.size > maximumBytes)) {
    throw CreateControllerError('object-size');
  }
  const body = object.body && typeof object.body.arrayBuffer === 'function' ? object.body : object;
  if (typeof body.arrayBuffer !== 'function') throw CreateControllerError('object-body-unavailable');
  const bytes = new Uint8Array(await body.arrayBuffer());
  if (bytes.byteLength > maximumBytes) throw CreateControllerError('object-size');
  return bytes;
}

function CreateArtifactFile(bytes) {
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const copy = bytes.slice();
  return {
    name: isZip ? 'artifact.zip' : 'artifact.html',
    type: isZip ? 'application/zip' : 'text/html',
    size: copy.byteLength,
    async arrayBuffer() {
      return copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength);
    },
  };
}

function NormalizeToolVersions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Controller tool versions are required.');
  }
  const entries = Object.entries(value);
  if (entries.length === 0 || entries.length > gameValidationLimits.maximumToolCount) {
    throw new TypeError('Controller tool versions are invalid.');
  }
  const result = {};
  for (const [key, version] of entries) {
    if (!/^[A-Za-z0-9._:-]{1,64}$/.test(key)
      || typeof version !== 'string' || version.length === 0 || version.length > 128) {
      throw new TypeError('Controller tool versions are invalid.');
    }
    result[key] = version;
  }
  return Object.freeze(result);
}

function ThrowIfAborted(signal) {
  if (signal?.aborted) throw CreateControllerError('aborted');
}

function CreateControllerError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

async function Sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function SortJsonValue(value) {
  if (Array.isArray(value)) return value.map(SortJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, SortJsonValue(value[key])]));
}

function EncodeBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  if (typeof btoa !== 'function') throw CreateControllerError('base64-encoder-unavailable');
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}
