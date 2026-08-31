/**
 * Dependency-free contracts for the asynchronous uploaded-game validator.
 *
 * This module is intentionally usable by a Cloudflare Worker, the queue
 * controller, and fixture tests. It never reads an artifact, opens a browser,
 * or executes developer code. The executor's output is treated as hostile
 * input and is bounded before a report can be produced.
 */

export const gameValidationSchemaVersion = 1;
export const gameValidationLimits = Object.freeze({
  maximumTransportBytes: 1024 * 1024,
  maximumFindingCount: 200,
  maximumNetworkAttemptCount: 100,
  maximumTargetSampleLength: 256,
  maximumMessageLength: 2048,
  maximumPathLength: 256,
  maximumCodeLength: 96,
  maximumToolCount: 32,
  maximumArtifactKeyLength: 512,
  maximumFileKeyCount: 192,
});

export const gameValidationQueueSchema = 'trainerhub.game-validation/v1';
export const gameValidationQueueType = 'scan-request';
export const gameValidationResultType = 'scan-result';
export const gameValidationJobTtlSeconds = 15 * 60;

export const gameValidationFindingDispositions = Object.freeze([
  'hard-block',
  'fix-or-manual-review',
  'manual-review',
  'info',
]);

export const gameValidationNetworkKinds = Object.freeze([
  'fetch',
  'navigation',
  'websocket',
  'webrtc',
  'resource',
]);

export const gameValidationNetworkTargetClasses = Object.freeze([
  'same-runner-origin',
  'external-origin',
  'opaque',
]);

export function IsGameValidationJob(value) {
  if (!IsRecord(value)
    || !IsOpaqueIdentifier(value.jobId)
    || !IsPositiveInteger(value.attempt)
    || !IsOpaqueIdentifier(value.jobNonce)
    || !IsOpaqueIdentifier(value.submissionId)
    || !IsSha256(value.artifactSha256)
    || !IsBoundedString(value.policyVersion, 1, 96)
    || value.limitsProfile !== 'uploaded-game-v1'
    || !IsIsoDate(value.issuedAt)
    || !IsIsoDate(value.expiresAt)) return false;
  return Date.parse(value.expiresAt) > Date.parse(value.issuedAt);
}

/**
 * Build a short-lived job envelope. The queue payload contains no user
 * credentials; the controller uses the opaque quarantine keys to read the
 * already-hashed artifact and file inventory.
 */
export function CreateGameValidationJob(input) {
  if (!IsRecord(input)) throw new TypeError('A validation job input is required.');
  const issuedAt = input.issuedAt === undefined ? new Date().toISOString() : input.issuedAt;
  const expiresAt = input.expiresAt === undefined
    ? new Date(Date.parse(issuedAt) + gameValidationJobTtlSeconds * 1000).toISOString()
    : input.expiresAt;
  const job = {
    jobId: input.jobId,
    attempt: input.attempt,
    jobNonce: input.jobNonce,
    submissionId: input.submissionId,
    artifactSha256: typeof input.artifactSha256 === 'string'
      ? input.artifactSha256.toLowerCase()
      : input.artifactSha256,
    policyVersion: input.policyVersion,
    limitsProfile: input.limitsProfile ?? 'uploaded-game-v1',
    issuedAt,
    expiresAt,
  };
  return FreezeGameValidationJob(job);
}

export function IsGameValidationQueueMessage(value) {
  return IsRecord(value)
    && value.schema === gameValidationQueueSchema
    && value.type === gameValidationQueueType
    && IsGameValidationJob(value.job)
    && IsSafeQueueKey(value.artifactKey)
    && Array.isArray(value.fileKeys)
    && value.fileKeys.length <= gameValidationLimits.maximumFileKeyCount
    && value.fileKeys.every(IsSafeQueueKey)
    && value.fileKeys.length > 0
    && IsIsoDate(value.enqueuedAt);
}

export function IsGameValidationResultMessage(value) {
  return IsRecord(value)
    && value.schema === gameValidationQueueSchema
    && value.type === gameValidationResultType
    && IsGameValidationJob(value.job)
    && IsSignedGameScanReport(value.signedReport)
    && IsIsoDate(value.receivedAt);
}

/**
 * Build the controller-to-Hub result envelope and enforce the same transport
 * bound used by queue requests. Keeping creation here prevents a worker from
 * accidentally emitting an unbounded report or a job object that differs
 * from the signed payload.
 */
export function CreateGameValidationResultMessage({
  job,
  signedReport,
  receivedAt = undefined,
}) {
  const message = {
    schema: gameValidationQueueSchema,
    type: gameValidationResultType,
    job: FreezeGameValidationJob(job),
    signedReport,
    receivedAt: receivedAt ?? new Date().toISOString(),
  };
  if (!IsGameValidationResultMessage(message) || !IsReportBoundToJob(message.signedReport.report, message.job)) {
    throw new TypeError('Validation result message does not match the bounded contract.');
  }
  const encodedBytes = new TextEncoder().encode(JSON.stringify(message));
  if (encodedBytes.byteLength > gameValidationLimits.maximumTransportBytes) {
    throw new TypeError('Validation result message exceeds the transport limit.');
  }
  return Object.freeze(message);
}

function IsReportBoundToJob(report, job) {
  return IsGameScanReport(report)
    && IsGameValidationJob(job)
    && report.jobId === job.jobId
    && report.attempt === job.attempt
    && report.jobNonce === job.jobNonce
    && report.submissionId === job.submissionId
    && report.artifactSha256.toLowerCase() === job.artifactSha256.toLowerCase()
    && report.policyVersion === job.policyVersion;
}

export function CreateGameValidationQueueMessage({ job, artifactKey, fileKeys, enqueuedAt = undefined }) {
  const frozenJob = FreezeGameValidationJob(job);
  const message = {
    schema: gameValidationQueueSchema,
    type: gameValidationQueueType,
    key: CreateGameValidationJobKey(frozenJob.jobId, frozenJob.attempt),
    job: frozenJob,
    artifactKey,
    fileKeys: [...(fileKeys ?? [])],
    enqueuedAt: enqueuedAt ?? new Date().toISOString(),
  };
  if (!IsGameValidationQueueMessage(message)) {
    throw new TypeError('Validation queue message does not match the bounded contract.');
  }
  const encodedBytes = new TextEncoder().encode(JSON.stringify(message));
  if (encodedBytes.byteLength > gameValidationLimits.maximumTransportBytes) {
    throw new TypeError('Validation queue message exceeds the transport limit.');
  }
  return Object.freeze({
    ...message,
    fileKeys: Object.freeze([...message.fileKeys]),
  });
}

/**
 * Result application is a compare-and-set operation. A report is accepted
 * only while its row is still queued/running and its nonce/hash match the
 * job that was issued for that attempt. Callers must perform the conditional
 * UPDATE using this predicate; this helper deliberately performs no I/O.
 */
export function CanApplyGameScanReport({ currentStatus, currentJobNonce, currentArtifactSha256, job, report, now = Date.now() }) {
  return (currentStatus === 'queued' || currentStatus === 'running')
    && IsGameValidationJob(job)
    && currentJobNonce === job.jobNonce
    && typeof currentArtifactSha256 === 'string'
    && currentArtifactSha256.toLowerCase() === job.artifactSha256.toLowerCase()
    && IsGameScanReportForJob(report, job, now);
}

export function IsGameScanFinding(value) {
  if (!IsRecord(value)
    || !gameValidationFindingDispositions.includes(value.disposition)
    || !IsBoundedString(value.code, 1, gameValidationLimits.maximumCodeLength)
    || !IsBoundedString(value.messageKey, 1, gameValidationLimits.maximumMessageLength)) return false;
  if (value.filePath !== undefined && value.filePath !== null
    && !IsBoundedString(value.filePath, 1, gameValidationLimits.maximumPathLength)) return false;
  if (value.line !== undefined && value.line !== null && !IsSafePositiveInteger(value.line)) return false;
  if (value.column !== undefined && value.column !== null && !IsSafePositiveInteger(value.column)) return false;
  if (value.evidence !== undefined && value.evidence !== null
    && !IsBoundedString(value.evidence, 1, gameValidationLimits.maximumMessageLength)) return false;
  return true;
}

export function IsGameNetworkAttempt(value) {
  return IsRecord(value)
    && gameValidationNetworkKinds.includes(value.kind)
    && gameValidationNetworkTargetClasses.includes(value.targetClass)
    && IsBoundedString(value.targetSample, 0, gameValidationLimits.maximumTargetSampleLength)
    && IsSafeNonNegativeInteger(value.count);
}

export function IsUnsignedGameScanEvidence(value) {
  return IsRecord(value)
    && value.schemaVersion === gameValidationSchemaVersion
    && IsOpaqueIdentifier(value.jobId)
    && IsPositiveInteger(value.attempt)
    && IsOpaqueIdentifier(value.jobNonce)
    && IsSha256(value.artifactSha256)
    && Array.isArray(value.observedNetworkAttempts)
    && value.observedNetworkAttempts.length <= gameValidationLimits.maximumNetworkAttemptCount
    && value.observedNetworkAttempts.every(IsGameNetworkAttempt)
    && Array.isArray(value.findings)
    && value.findings.length <= gameValidationLimits.maximumFindingCount
    && value.findings.every(IsGameScanFinding)
    && typeof value.truncated === 'boolean';
}

export function ValidateUnsignedGameScanEvidence(value, expectedJob = undefined) {
  if (!IsUnsignedGameScanEvidence(value)) return { ok: false, code: 'invalid-schema' };
  if (expectedJob && (!IsGameValidationJob(expectedJob)
    || value.jobId !== expectedJob.jobId
    || value.attempt !== expectedJob.attempt
    || value.jobNonce !== expectedJob.jobNonce
    || value.artifactSha256.toLowerCase() !== expectedJob.artifactSha256.toLowerCase())) {
    return { ok: false, code: 'job-mismatch' };
  }
  if (value.truncated) return { ok: false, code: 'truncated' };
  return { ok: true, value: FreezeEvidence(value) };
}

export function CreateGameValidationJobKey(jobId, attempt) {
  if (!IsOpaqueIdentifier(jobId) || !IsPositiveInteger(attempt)) {
    throw new TypeError('A valid validation job id and attempt are required.');
  }
  return `${jobId}:${attempt}`;
}

export function DetermineGameScanVerdict(findings) {
  if (!Array.isArray(findings) || !findings.every(IsGameScanFinding)) {
    throw new TypeError('Scan findings do not match the bounded validator contract.');
  }
  if (findings.some((finding) => finding.disposition === 'hard-block')) return 'hard-block';
  if (findings.some((finding) => finding.disposition === 'manual-review'
    || finding.disposition === 'fix-or-manual-review')) return 'manual-review-eligible';
  return 'pass';
}

export function CreateGameScanReport({ job, evidence, toolVersions, completedAt }) {
  if (!IsGameValidationJob(job)) throw new TypeError('Invalid game validation job.');
  const evidenceResult = ValidateUnsignedGameScanEvidence(evidence, job);
  const normalizedTools = NormalizeToolVersions(toolVersions);
  const observedNetworkAttempts = IsUnsignedGameScanEvidence(evidence)
    ? evidence.observedNetworkAttempts
    : [];
  if (!evidenceResult.ok) {
    const resourceFinding = {
      disposition: 'hard-block',
      code: `validator-${evidenceResult.code}`,
      filePath: null,
      line: null,
      column: null,
      messageKey: `game.validation.${evidenceResult.code}`,
      evidence: null,
    };
    const findings = [...(IsUnsignedGameScanEvidence(evidence) ? evidence.findings : []), resourceFinding]
      .filter(IsGameScanFinding)
      .slice(0, gameValidationLimits.maximumFindingCount);
    return FreezeReport({
      schemaVersion: gameValidationSchemaVersion,
      jobId: job.jobId,
      attempt: job.attempt,
      jobNonce: job.jobNonce,
      submissionId: job.submissionId,
      artifactSha256: job.artifactSha256,
      policyVersion: job.policyVersion,
      toolVersions: normalizedTools,
      verdict: 'hard-block',
      observedNetworkAttempts,
      findings,
      completedAt: NormalizeCompletedAt(completedAt),
    });
  }
  const normalizedFindings = evidenceResult.value.findings;
  return FreezeReport({
    schemaVersion: gameValidationSchemaVersion,
    jobId: job.jobId,
    attempt: job.attempt,
    jobNonce: job.jobNonce,
    submissionId: job.submissionId,
    artifactSha256: job.artifactSha256,
    policyVersion: job.policyVersion,
    toolVersions: normalizedTools,
    verdict: DetermineGameScanVerdict(normalizedFindings),
    observedNetworkAttempts: evidenceResult.value.observedNetworkAttempts,
    findings: normalizedFindings,
    completedAt: NormalizeCompletedAt(completedAt),
  });
}

export function IsGameScanReport(value) {
  return IsRecord(value)
    && value.schemaVersion === gameValidationSchemaVersion
    && IsOpaqueIdentifier(value.jobId)
    && IsPositiveInteger(value.attempt)
    && IsOpaqueIdentifier(value.jobNonce)
    && IsOpaqueIdentifier(value.submissionId)
    && IsSha256(value.artifactSha256)
    && IsBoundedString(value.policyVersion, 1, 96)
    && IsRecord(value.toolVersions)
    && Object.keys(value.toolVersions).length <= gameValidationLimits.maximumToolCount
    && Object.entries(value.toolVersions).every(([key, version]) => (
      IsBoundedString(key, 1, 64) && IsBoundedString(version, 1, 128)
    ))
    && ['pass', 'changes-required', 'manual-review-eligible', 'hard-block'].includes(value.verdict)
    && Array.isArray(value.observedNetworkAttempts)
    && value.observedNetworkAttempts.length <= gameValidationLimits.maximumNetworkAttemptCount
    && value.observedNetworkAttempts.every(IsGameNetworkAttempt)
    && Array.isArray(value.findings)
    && value.findings.length <= gameValidationLimits.maximumFindingCount
    && value.findings.every(IsGameScanFinding)
    && IsIsoDate(value.completedAt);
}

export function AssertGameScanReport(value) {
  if (!IsGameScanReport(value)) throw new TypeError('Invalid game scan report.');
  return FreezeReport(value);
}

export function IsGameScanReportForJob(report, job, now = Date.now()) {
  return IsGameScanReport(report)
    && IsGameValidationJob(job)
    && report.jobId === job.jobId
    && report.attempt === job.attempt
    && report.jobNonce === job.jobNonce
    && report.submissionId === job.submissionId
    && report.artifactSha256.toLowerCase() === job.artifactSha256.toLowerCase()
    && report.policyVersion === job.policyVersion
    && now <= Date.parse(job.expiresAt);
}

/**
 * Canonical JSON used for report hashing/signing. Object keys are sorted and
 * arrays retain their semantic order; report findings/tool versions are
 * normalized by CreateGameScanReport before this function is called.
 */
export function CanonicalizeGameScanReport(report) {
  const normalized = AssertGameScanReport(report);
  return JSON.stringify(SortJsonValue(normalized));
}

export async function CreateGameScanReportDigest(report) {
  const bytes = new TextEncoder().encode(CanonicalizeGameScanReport(report));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function IsSignedGameScanReport(value) {
  return IsRecord(value)
    && IsGameScanReport(value.report)
    && IsSha256(value.reportSha256)
    && IsRecord(value.attestation)
    && IsBoundedString(value.attestation.keyId, 1, 128)
    && value.attestation.algorithm === 'Ed25519'
    && IsBase64Url(value.attestation.value);
}

/**
 * Verify the controller attestation and the report digest before a result is
 * admitted to the Hub. A caller may pass a CryptoKey or an Ed25519 JWK from a
 * versioned public-key registry. Unknown key formats fail closed.
 */
export async function VerifySignedGameScanReport(value, publicKey) {
  if (!IsSignedGameScanReport(value)) return { ok: false, code: 'invalid-schema' };
  const reportSha256 = await CreateGameScanReportDigest(value.report);
  if (value.reportSha256.toLowerCase() !== reportSha256) {
    return { ok: false, code: 'report-digest-mismatch' };
  }
  let verificationKey = publicKey;
  try {
    if (!IsCryptoVerificationKey(publicKey)) {
      if (!IsEd25519PublicJwk(publicKey)) return { ok: false, code: 'invalid-public-key' };
      verificationKey = await crypto.subtle.importKey(
        'jwk',
        publicKey,
        { name: 'Ed25519' },
        false,
        ['verify'],
      );
    }
    const signature = DecodeBase64Url(value.attestation.value);
    const payload = new TextEncoder().encode(CanonicalizeGameScanReport(value.report));
    const valid = await crypto.subtle.verify(
      { name: 'Ed25519' },
      verificationKey,
      signature,
      payload,
    );
    return valid
      ? { ok: true, keyId: value.attestation.keyId }
      : { ok: false, code: 'invalid-signature' };
  } catch {
    return { ok: false, code: 'invalid-signature' };
  }
}

export function FreezeGameValidationJob(job) {
  if (!IsGameValidationJob(job)) throw new TypeError('Invalid game validation job.');
  return Object.freeze({ ...job });
}

function NormalizeToolVersions(value) {
  if (!IsRecord(value)) throw new TypeError('Validator tool versions are required.');
  const entries = Object.entries(value);
  if (entries.length > gameValidationLimits.maximumToolCount) {
    throw new TypeError('Too many validator tool versions.');
  }
  const output = {};
  for (const [key, version] of entries.sort(([left], [right]) => left.localeCompare(right))) {
    if (!IsBoundedString(key, 1, 64) || !IsBoundedString(version, 1, 128)) {
      throw new TypeError('Validator tool version is invalid.');
    }
    output[key] = version;
  }
  return Object.freeze(output);
}

function NormalizeCompletedAt(value) {
  if (value === undefined) return new Date().toISOString();
  if (!IsIsoDate(value)) throw new TypeError('Report completion time is invalid.');
  return value;
}

function FreezeEvidence(value) {
  return Object.freeze({
    ...value,
    artifactSha256: value.artifactSha256.toLowerCase(),
    observedNetworkAttempts: Object.freeze(value.observedNetworkAttempts.map((attempt) => Object.freeze({ ...attempt }))),
    findings: Object.freeze(value.findings.map((finding) => Object.freeze({
      filePath: null,
      line: null,
      column: null,
      evidence: null,
      ...finding,
    }))),
  });
}

function FreezeReport(value) {
  return Object.freeze({
    ...value,
    artifactSha256: value.artifactSha256.toLowerCase(),
    toolVersions: Object.freeze({ ...value.toolVersions }),
    observedNetworkAttempts: Object.freeze(value.observedNetworkAttempts.map((attempt) => Object.freeze({ ...attempt }))),
    findings: Object.freeze(value.findings.map((finding) => Object.freeze({
      filePath: null,
      line: null,
      column: null,
      evidence: null,
      ...finding,
    }))),
  });
}

function SortJsonValue(value) {
  if (Array.isArray(value)) return value.map(SortJsonValue);
  if (!IsRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, SortJsonValue(value[key])]));
}

function IsRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function IsSafeQueueKey(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= gameValidationLimits.maximumArtifactKeyLength
    && !value.startsWith('/')
    && !value.includes('\\')
    && !value.split('/').includes('..')
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function IsCryptoVerificationKey(value) {
  return value !== null
    && typeof value === 'object'
    && value.type === 'public'
    && value.algorithm?.name === 'Ed25519';
}

function IsEd25519PublicJwk(value) {
  return IsRecord(value)
    && value.kty === 'OKP'
    && value.crv === 'Ed25519'
    && typeof value.x === 'string'
    && value.x.length >= 16;
}

function DecodeBase64Url(value) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  if (typeof atob === 'function') {
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }
  throw new TypeError('Base64 decoder is unavailable.');
}

function IsOpaqueIdentifier(value) {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
}

function IsSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function IsBase64Url(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16,4096}$/.test(value);
}

function IsBoundedString(value, minimum, maximum) {
  return typeof value === 'string'
    && value.length >= minimum
    && value.length <= maximum
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function IsPositiveInteger(value) {
  return IsSafePositiveInteger(value) && value <= 1_000_000;
}

function IsSafePositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function IsSafeNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function IsIsoDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}
