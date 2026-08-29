'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { DownloadFile } from '@rehab-trainer/ui/downloadFile';
import {
  DownloadAdminGameReleaseArtifact,
  FetchAdminGameValidationQueue,
  FetchAdminGameReleases,
  FetchAdminGameReports,
  FetchAdminGameReleaseSource,
  FetchAdminGameReleaseDiff,
  ReviewAdminGameSubmission,
  ReviewAdminGameRelease,
  UpdateAdminGameReport,
  type AdminGameRelease,
  type AdminGameReleaseDiff,
  type AdminGameReport,
  type AdminGameReportStatus,
  type AdminGameFindingOverride,
  type AdminGameSubmission,
  type GameValidationQueue,
  type GameReleaseReviewStatus,
} from './adminApi';

type FindingOverrideState = Record<string, Record<string, AdminGameFindingOverride>>;

const statusLabels: Readonly<Record<GameReleaseReviewStatus, string>> = {
  blocked: '自動掃描阻擋',
  pending_review: '等待人工審核',
  publishing: '正在發布／可重試',
  approved: '已核准發布',
  rejected: '已退回',
  revoked: '已緊急下架',
};

export function GameReleaseManager() {
  const [filter, setFilter] = useState<GameReleaseReviewStatus | ''>('pending_review');
  const [releases, setReleases] = useState<AdminGameRelease[]>([]);
  const [reports, setReports] = useState<AdminGameReport[]>([]);
  const [validationSubmissions, setValidationSubmissions] = useState<AdminGameSubmission[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState('');
  const [evidence, setEvidence] = useState<Record<string, {
    sourceReviewed: boolean;
    playTested: boolean;
    metadataReviewed: boolean;
  }>>({});
  const [findingOverrides, setFindingOverrides] = useState<Record<string, Record<string, AdminGameFindingOverride>>>({});
  const [sourceContent, setSourceContent] = useState<Record<string, string>>({});
  const [sourceErrors, setSourceErrors] = useState<Record<string, string>>({});
  const [sourceBusy, setSourceBusy] = useState('');
  const [releaseDiffs, setReleaseDiffs] = useState<Record<string, AdminGameReleaseDiff>>({});
  const [diffErrors, setDiffErrors] = useState<Record<string, string>>({});
  const [diffBusy, setDiffBusy] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [reportBusyId, setReportBusyId] = useState('');
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setError('');
    void FetchAdminGameReleases(filter || undefined, controller.signal)
      .then((nextReleases) => {
        setReleases(nextReleases);
        setStatus('ready');
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        console.warn('Unable to load game releases.', loadError);
        setError('目前無法載入遊戲送審版本，請稍後再試。');
        setStatus('error');
      });
    return () => controller.abort();
  }, [filter, reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    void FetchAdminGameReports(undefined, controller.signal)
      .then(setReports)
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) console.warn('Unable to load game reports.', loadError);
      });
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    const queues: GameValidationQueue[] = [
      'ready-for-review',
      'manual-review-requested',
      'security-blocked',
      'processing',
    ];
    void Promise.all(queues.map((queue) => (
      FetchAdminGameValidationQueue(queue, controller.signal).catch((loadError: unknown) => {
        if (!controller.signal.aborted) console.warn(`Unable to load validation queue: ${queue}.`, loadError);
        return [];
      })
    ))).then((queueResults) => {
      if (controller.signal.aborted) return;
      const unique = new Map<string, AdminGameSubmission>();
      queueResults.flat().forEach((submission) => unique.set(submission.id, submission));
      setValidationSubmissions([...unique.values()]);
    });
    return () => controller.abort();
  }, [reloadKey]);

  const review = async (release: AdminGameRelease, decision: 'approve' | 'reject' | 'revoke') => {
    const verb = decision === 'approve' ? '核准並發布' : decision === 'revoke' ? '緊急下架' : '退回';
    if (!window.confirm(`確定要${verb}「${release.title}」v${release.version}？`)) return;
    setBusyId(release.id);
    setError('');
    try {
      const reviewEvidence = evidence[release.id] ?? {
        sourceReviewed: false,
        playTested: false,
        metadataReviewed: false,
      };
      await ReviewAdminGameRelease(release.id, decision, notes[release.id] ?? '', reviewEvidence);
      setReloadKey((current) => current + 1);
    } catch (reviewError) {
      console.warn('Unable to review game release.', reviewError);
      setError('審核操作失敗；檔案未發布，請確認儲存空間與版本狀態後再試。');
    } finally {
      setBusyId('');
    }
  };

  const reviewValidationSubmission = async (
    submission: AdminGameSubmission,
    decision: 'approve' | 'reject' | 'request-changes',
  ) => {
    const verb = decision === 'approve' ? '通過人工判讀' : decision === 'request-changes' ? '要求修改' : '退回人工判讀';
    if (!window.confirm(`確定要對「${submission.title}」v${submission.targetVersion}${verb}？`)) return;
    setBusyId(`submission:${submission.id}`);
    setError('');
    try {
      const reviewEvidence = evidence[submission.id] ?? {
        sourceReviewed: false,
        playTested: false,
        metadataReviewed: false,
      };
      await ReviewAdminGameSubmission(
        submission.id,
        decision,
        notes[submission.id] ?? '',
        reviewEvidence,
        BuildFindingOverrides(submission, findingOverrides[submission.id]),
      );
      setReloadKey((current) => current + 1);
    } catch (reviewError) {
      console.warn('Unable to review validation submission.', reviewError);
      setError('人工判讀操作失敗；submission 狀態未變更，請重新載入後再試。');
    } finally {
      setBusyId('');
    }
  };

  const downloadArtifact = async (release: AdminGameRelease) => {
    setBusyId(release.id);
    setError('');
    try {
      const artifact = await DownloadAdminGameReleaseArtifact(release.id);
      DownloadFile(artifact.blob, artifact.filename, 'application/octet-stream');
    } catch (downloadError) {
      console.warn('Unable to download game review artifact.', downloadError);
      setError('無法下載送審原始檔，請勿在未完成原始碼核對的情況下核准。');
    } finally {
      setBusyId('');
    }
  };

  const loadSource = async (release: AdminGameRelease, path: string) => {
    const sourceKey = `${release.id}:${path}`;
    setSourceBusy(sourceKey);
    setSourceErrors((current) => ({ ...current, [sourceKey]: '' }));
    try {
      const source = await FetchAdminGameReleaseSource(release.id, path);
      setSourceContent((current) => ({ ...current, [sourceKey]: source }));
    } catch (sourceError) {
      console.warn('Unable to load reviewed source file.', sourceError);
      setSourceErrors((current) => ({ ...current, [sourceKey]: '無法載入此原始碼檔案。' }));
    } finally {
      setSourceBusy('');
    }
  };

  const loadDiff = async (release: AdminGameRelease) => {
    if (!release.submissionId) return;
    setDiffBusy(release.id);
    setDiffErrors((current) => ({ ...current, [release.id]: '' }));
    try {
      const diff = await FetchAdminGameReleaseDiff(release.id);
      setReleaseDiffs((current) => ({ ...current, [release.id]: diff }));
    } catch (diffError) {
      console.warn('Unable to load release attempt diff.', diffError);
      setDiffErrors((current) => ({ ...current, [release.id]: '無法載入此版本與上一個 attempt 的差異。' }));
    } finally {
      setDiffBusy('');
    }
  };

  const updateReport = async (report: AdminGameReport, nextStatus: AdminGameReportStatus) => {
    const note = (reportNotes[report.id] ?? report.resolutionNote ?? '').trim();
    if (['resolved', 'rejected'].includes(nextStatus) && note.length < 2) {
      setError('結案或駁回檢舉前請填寫處理備註。');
      return;
    }
    setReportBusyId(report.id);
    setError('');
    try {
      await UpdateAdminGameReport(report.id, nextStatus, note);
      setReloadKey((current) => current + 1);
    } catch (reportError) {
      console.warn('Unable to update game report.', reportError);
      setError('檢舉狀態更新失敗，請重新載入後再試。');
    } finally {
      setReportBusyId('');
    }
  };

  return (
    <div className="admin-game-review">
      <div className="admin-section-toolbar">
        <div>
          <p className="page-kicker">Game review</p>
          <h2>開發者遊戲審核</h2>
          <p>核對未混淆原始碼、自動掃描結果與試玩內容；只有核准的相同雜湊版本會發布。</p>
        </div>
        <label className="admin-field admin-game-status-filter">
          <span>版本狀態</span>
          <select
            onChange={(event) => setFilter(event.target.value as GameReleaseReviewStatus | '')}
            value={filter}
          >
            <option value="">全部</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="admin-alert admin-alert-error" role="alert">{error}</p>}
      {reports.length > 0 && (
        <section className="admin-game-reports" aria-labelledby="admin-game-reports-title">
          <div className="section-title-row">
            <div>
              <p className="page-kicker">Community reports</p>
              <h3 id="admin-game-reports-title">玩家檢舉</h3>
            </div>
            <span>{reports.length}</span>
          </div>
          <ul>
            {reports.map((report) => (
              <li key={report.id}>
                <div className="admin-game-report-heading">
                  <strong>{report.title} v{report.version}</strong>
                  <span className={`release-status release-status-${report.status}`}>{FormatReportStatus(report.status)}</span>
                </div>
                <small>{FormatReportReason(report.reason)} · {report.reporterDisplayName} · {FormatDateTime(report.createdAt)}</small>
                <p>{report.details}</p>
                <label className="admin-field">
                  <span>處理備註</span>
                  <textarea
                    maxLength={2000}
                    onChange={(event) => setReportNotes((current) => ({ ...current, [report.id]: event.target.value }))}
                    rows={2}
                    value={reportNotes[report.id] ?? report.resolutionNote ?? ''}
                  />
                </label>
                <div className="admin-game-report-actions">
                  {report.status !== 'in_review' && report.status !== 'resolved' && (
                    <button
                      className="admin-button admin-button-secondary"
                      disabled={reportBusyId === report.id}
                      onClick={() => void updateReport(report, 'in_review')}
                      type="button"
                    >
                      標記處理中
                    </button>
                  )}
                  {report.status === 'in_review' && (
                    <button
                      className="admin-button admin-button-secondary"
                      disabled={reportBusyId === report.id}
                      onClick={() => void updateReport(report, 'open')}
                      type="button"
                    >
                      重新開啟
                    </button>
                  )}
                  {['open', 'in_review'].includes(report.status) && (
                    <>
                      <button
                        className="admin-button admin-button-primary"
                        disabled={reportBusyId === report.id || (reportNotes[report.id] ?? report.resolutionNote ?? '').trim().length < 2}
                        onClick={() => void updateReport(report, 'resolved')}
                        type="button"
                      >
                        標記已處理
                      </button>
                      <button
                        className="admin-button admin-button-secondary"
                        disabled={reportBusyId === report.id || (reportNotes[report.id] ?? report.resolutionNote ?? '').trim().length < 2}
                        onClick={() => void updateReport(report, 'rejected')}
                        type="button"
                      >
                        駁回檢舉
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {status === 'loading' && (
        <div aria-label="正在載入遊戲送審版本" className="admin-state" role="status">
          <span className="minimal-loading-spinner" aria-hidden="true" />
        </div>
      )}
      {status === 'error' && (
        <button className="admin-button admin-button-secondary" onClick={() => setReloadKey((key) => key + 1)} type="button">
          重新載入
        </button>
      )}
      {validationSubmissions.length > 0 && (
        <section className="admin-validation-queue" aria-label="非同步驗證佇列">
          <h3>非同步驗證佇列</h3>
          <p>這些 submission 與舊版 release 分開管理；hard-block 只能修正後重新送審，不能在後台直接放行。</p>
          <div className="admin-game-release-list">
            {validationSubmissions.map((submission) => (
              <article className="admin-game-release" key={`submission-${submission.id}`}>
                <header>
                  <div>
                    <span className={`release-status release-status-${submission.scan.status ?? 'processing'}`}>
                      {submission.scan.status ?? '處理中'}
                    </span>
                    <h3>{submission.title} <small>v{submission.targetVersion}</small></h3>
                    <p>{submission.owner.displayName} · {submission.artifactType.toUpperCase()} · attempt {submission.scan.attempt ?? '—'}</p>
                  </div>
                  <dl>
                    <div><dt>發現</dt><dd>{submission.findings.length}</dd></div>
                    <div><dt>套件</dt><dd>{FormatBytes(submission.packageBytes)}</dd></div>
                    <div><dt>人工覆核</dt><dd>{submission.review?.status ?? '尚未申請'}</dd></div>
                  </dl>
                </header>
                <details open={submission.findings.length > 0}>
                  <summary>驗證發現（{submission.findings.length}）</summary>
                  {submission.findings.length === 0 ? (
                    <p>目前沒有 finding；仍須依 release checklist 完成人工查核。</p>
                  ) : (
                    <ul className="admin-game-findings">
                      {submission.findings.map((finding) => (
                        <li key={finding.id}>
                          <strong>{finding.disposition} · {finding.code}</strong>
                          <span>{finding.filePath ?? '整個套件'}</span>
                          <p>{finding.messageKey}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
                <dl className="admin-game-identifiers">
                  <div><dt>Artifact SHA-256</dt><dd><code>{submission.artifactSha256}</code></dd></div>
                  <div><dt>Policy</dt><dd><code>{submission.scan.policyVersion ?? '—'}</code></dd></div>
                </dl>
                {submission.scan.report && (
                  <details className="admin-game-scan-report">
                    <summary>Controller report · {submission.scan.report.verdict ?? 'unknown'}</summary>
                    <dl className="admin-game-identifiers">
                      <div><dt>Report SHA-256</dt><dd><code>{submission.scan.report.sha256}</code></dd></div>
                      <div><dt>Attestation key</dt><dd><code>{submission.scan.report.attestationKeyId}</code></dd></div>
                      <div><dt>Received</dt><dd>{new Date(submission.scan.report.receivedAt).toLocaleString()}</dd></div>
                    </dl>
                    {submission.scan.report.networkAttempts.length > 0 ? (
                      <ul className="admin-game-findings">
                        {submission.scan.report.networkAttempts.map((attempt, index) => (
                          <li key={`${attempt.kind}-${attempt.targetSample}-${index}`}>
                            <strong>{attempt.kind} · {attempt.targetClass}</strong>
                            <span>{attempt.targetSample || 'opaque target'} · {attempt.count}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p>Controller dynamic smoke observed no network attempts.</p>}
                  </details>
                )}
                {submission.review && ['requested', 'in_review'].includes(submission.review.status) && (
                  <div className="admin-game-review-actions">
                    <label className="admin-field">
                      <span>人工判讀備註</span>
                      <textarea
                        maxLength={2000}
                        onChange={(event) => setNotes((current) => ({ ...current, [submission.id]: event.target.value }))}
                        placeholder="記錄 finding 查核結果、試玩結果或需要修改的項目"
                        rows={3}
                        value={notes[submission.id] ?? ''}
                      />
                    </label>
                    <fieldset className="admin-game-evidence">
                      <legend>人工判讀紀錄</legend>
                      <label>
                        <input
                          checked={evidence[submission.id]?.sourceReviewed ?? false}
                          onChange={(event) => setEvidence((current) => ({
                            ...current,
                            [submission.id]: {
                              sourceReviewed: event.target.checked,
                              playTested: current[submission.id]?.playTested ?? false,
                              metadataReviewed: current[submission.id]?.metadataReviewed ?? false,
                            },
                          }))}
                          type="checkbox"
                        />
                        已閱讀原始碼並核對爭議 finding
                      </label>
                      <label>
                        <input
                          checked={evidence[submission.id]?.playTested ?? false}
                          onChange={(event) => setEvidence((current) => ({
                            ...current,
                            [submission.id]: {
                              sourceReviewed: current[submission.id]?.sourceReviewed ?? false,
                              playTested: event.target.checked,
                              metadataReviewed: current[submission.id]?.metadataReviewed ?? false,
                            },
                          }))}
                          type="checkbox"
                        />
                        已在隔離、無帳戶資料的環境完成試玩
                      </label>
                      <label>
                        <input
                          checked={evidence[submission.id]?.metadataReviewed ?? false}
                          onChange={(event) => setEvidence((current) => ({
                            ...current,
                            [submission.id]: {
                              sourceReviewed: current[submission.id]?.sourceReviewed ?? false,
                              playTested: current[submission.id]?.playTested ?? false,
                              metadataReviewed: event.target.checked,
                            },
                          }))}
                          type="checkbox"
                        />
                        已核對公開描述且沒有未經證實的醫療或療效宣稱
                      </label>
                    </fieldset>
                    {submission.findings.some((finding) => (
                      finding.disposition === 'fix-or-manual-review'
                      || finding.disposition === 'manual-review'
                    )) && (
                      <fieldset className="admin-game-overrides">
                        <legend>逐項 finding 覆核證據</legend>
                        {submission.findings
                          .filter((finding) => (
                            finding.disposition === 'fix-or-manual-review'
                            || finding.disposition === 'manual-review'
                          ))
                          .map((finding) => {
                            const draft = findingOverrides[submission.id]?.[finding.id];
                            return (
                              <div className="admin-game-override" key={finding.id}>
                                <strong>{finding.code}</strong>
                                <label className="admin-field">
                                  <span>判定</span>
                                  <select
                                    onChange={(event) => UpdateFindingOverride(setFindingOverrides, submission.id, finding.id, {
                                      decision: event.target.value as AdminGameFindingOverride['decision'],
                                    })}
                                    value={draft?.decision ?? 'dismiss'}
                                  >
                                    <option value="dismiss">Dismiss：確認為誤判</option>
                                    <option value="accept">Accept：保留風險並記錄</option>
                                  </select>
                                </label>
                                <label className="admin-field">
                                  <span>理由</span>
                                  <input
                                    maxLength={2000}
                                    onChange={(event) => UpdateFindingOverride(setFindingOverrides, submission.id, finding.id, { reason: event.target.value })}
                                    required
                                    value={draft?.reason ?? ''}
                                  />
                                </label>
                                <label className="admin-field">
                                  <span>證據</span>
                                  <textarea
                                    maxLength={2000}
                                    onChange={(event) => UpdateFindingOverride(setFindingOverrides, submission.id, finding.id, { evidence: event.target.value })}
                                    required
                                    rows={2}
                                    value={draft?.evidence ?? ''}
                                  />
                                </label>
                              </div>
                            );
                          })}
                      </fieldset>
                    )}
                    <div>
                      <button
                        className="admin-button admin-button-primary"
                        disabled={busyId === `submission:${submission.id}`
                          || submission.scan.status !== 'passed'
                          || submission.findings.some((finding) => finding.disposition === 'hard-block')
                          || !evidence[submission.id]?.sourceReviewed
                          || !evidence[submission.id]?.playTested
                          || !evidence[submission.id]?.metadataReviewed}
                        onClick={() => void reviewValidationSubmission(submission, 'approve')}
                        type="button"
                      >
                        通過人工判讀
                      </button>
                      <button
                        className="admin-button admin-button-secondary"
                        disabled={busyId === `submission:${submission.id}`}
                        onClick={() => void reviewValidationSubmission(submission, 'request-changes')}
                        type="button"
                      >
                        要求修改
                      </button>
                      <button
                        className="admin-button admin-button-secondary"
                        disabled={busyId === `submission:${submission.id}`}
                        onClick={() => void reviewValidationSubmission(submission, 'reject')}
                        type="button"
                      >
                        退回申請
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      {status === 'ready' && releases.length === 0 && (
        <div className="admin-state">
          <span className="material-symbols-outlined" aria-hidden="true">task_alt</span>
          <h3>此狀態目前沒有版本</h3>
        </div>
      )}

      <div className="admin-game-release-list">
        {releases.map((release) => (
          <article className="admin-game-release" key={release.id}>
            <header>
              <div>
                <span className={`release-status release-status-${release.status}`}>{statusLabels[release.status]}</span>
                <h3>{release.title} <small>v{release.version}</small></h3>
                <p>{release.owner.displayName} · {release.artifactType.toUpperCase()} · jsPsych {release.jsPsychVersion}</p>
              </div>
              <dl>
                <div><dt>檔案</dt><dd>{release.fileCount}</dd></div>
                <div><dt>解壓大小</dt><dd>{FormatBytes(release.uncompressedBytes)}</dd></div>
                <div><dt>能力</dt><dd>{release.capabilities.join('、') || '無'}</dd></div>
              </dl>
            </header>

            <section className="admin-game-public-metadata" aria-label="預計公開的遊戲資料">
              <h4>預計公開內容</h4>
              <dl>
                <div><dt>開發者名稱</dt><dd>{release.developerName}</dd></div>
                <div><dt>分類</dt><dd>{release.category}</dd></div>
                <div>
                  <dt>授權條款</dt>
                  <dd>
                    {release.license.url ? (
                      <a href={release.license.url} rel="noreferrer" target="_blank">{release.license.label}</a>
                    ) : release.license.label}
                  </dd>
                </div>
              </dl>
              <p><strong>遊戲名稱：</strong>{release.title}</p>
              <p><strong>公開摘要：</strong>{release.summary || '（未提供摘要）'}</p>
              {release.license.id === 'not-declared' && (
                <p className="admin-alert admin-alert-error" role="alert">
                  尚未宣告授權條款；伺服器不會允許此版本發布。
                </p>
              )}
            </section>

            <details open={release.status === 'pending_review' || release.status === 'blocked'}>
              <summary>掃描結果（{release.findings.length}）</summary>
              {release.findings.length === 0 ? (
                <p>沒有自動掃描發現；仍須人工閱讀原始碼並試玩。</p>
              ) : (
                <ul className="admin-game-findings">
                  {release.findings.map((finding, index) => (
                    <li key={`${finding.code}-${finding.filePath ?? ''}-${index}`}>
                      <strong>{finding.severity === 'block' ? '阻擋' : '檢查'} · {finding.code}</strong>
                      <span>{finding.filePath ?? '整個套件'}</span>
                      <p>{finding.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </details>

            <details>
              <summary>版本識別資料</summary>
              <dl className="admin-game-identifiers">
                <div><dt>入口</dt><dd><code>{release.entryPath}</code></dd></div>
                <div><dt>SHA-256</dt><dd><code>{release.contentSha256}</code></dd></div>
                <div><dt>送審時間</dt><dd><time dateTime={release.submittedAt}>{FormatDateTime(release.submittedAt)}</time></dd></div>
              </dl>
            </details>

            <details className="admin-game-source-viewer">
              <summary>原始碼檢視器（純文字、不執行）</summary>
              <p>檔案會以 <code>text/plain</code> 顯示；此檢視器不建立 HTML preview、不載入 script，也不代表已完成隔離試玩。</p>
              {release.files.filter((file) => IsSourceViewerFile(file.contentType, file.path)).length === 0 ? (
                <p>此版本沒有可供純文字檢視的檔案。</p>
              ) : (
                <ul className="admin-game-source-list">
                  {release.files
                    .filter((file) => IsSourceViewerFile(file.contentType, file.path))
                    .slice(0, 100)
                    .map((file) => {
                      const sourceKey = `${release.id}:${file.path}`;
                      return (
                        <li key={file.path}>
                          <div className="admin-game-source-file-heading">
                            <code>{file.path}</code>
                            <button
                              className="admin-button admin-button-secondary"
                              disabled={sourceBusy === sourceKey}
                              onClick={() => void loadSource(release, file.path)}
                              type="button"
                            >
                              {sourceBusy === sourceKey ? '載入中…' : sourceContent[sourceKey] !== undefined ? '重新載入' : '檢視'}
                            </button>
                          </div>
                          {sourceErrors[sourceKey] && <p className="admin-alert admin-alert-error">{sourceErrors[sourceKey]}</p>}
                          {sourceContent[sourceKey] !== undefined && (
                            <pre className="admin-game-source-content">{sourceContent[sourceKey]}</pre>
                          )}
                        </li>
                      );
                    })}
                </ul>
              )}
            </details>

            {release.submissionId && (
              <details className="admin-game-source-diff">
                <summary>與上一個 submission attempt 的差異（純文字）</summary>
                <p>只比較同一遊戲與 target version 的檔案雜湊；文字檔在大小限制內以純文字顯示，HTML 不會被執行。</p>
                <button
                  className="admin-button admin-button-secondary"
                  disabled={diffBusy === release.id}
                  onClick={() => void loadDiff(release)}
                  type="button"
                >
                  {diffBusy === release.id ? '載入差異中…' : releaseDiffs[release.id] ? '重新載入差異' : '檢視差異'}
                </button>
                {diffErrors[release.id] && <p className="admin-alert admin-alert-error">{diffErrors[release.id]}</p>}
                {releaseDiffs[release.id] && (
                  <div className="admin-game-diff-content">
                    <small>
                      Current attempt {releaseDiffs[release.id].currentAttempt ?? '—'} · Previous attempt {releaseDiffs[release.id].previousAttempt ?? '—'}
                      {releaseDiffs[release.id].truncated ? ' · 顯示內容已截斷' : ''}
                    </small>
                    {releaseDiffs[release.id].previousAttempt === null ? (
                      <p>沒有較早的 attempt；目前檔案視為新增。</p>
                    ) : releaseDiffs[release.id].changes.length === 0 ? (
                      <p>兩個 attempt 的檔案內容相同。</p>
                    ) : (
                      <ul className="admin-game-findings">
                        {releaseDiffs[release.id].changes.map((change) => (
                          <li key={change.path}>
                            <strong>{change.status} · {change.path}</strong>
                            <span>
                              before {change.before?.sha256?.slice(0, 12) ?? '—'} · after {change.after?.sha256?.slice(0, 12) ?? '—'}
                            </span>
                            {(change.beforeText !== undefined || change.afterText !== undefined) && (
                              <div className="admin-game-diff-text">
                                <pre>{change.beforeText ?? '（不存在或超出大小限制）'}</pre>
                                <pre>{change.afterText ?? '（不存在或超出大小限制）'}</pre>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </details>
            )}

            <div className="admin-game-artifact-actions">
              <button
                className="admin-button admin-button-secondary"
                disabled={busyId === release.id}
                onClick={() => void downloadArtifact(release)}
                type="button"
              >
                下載送審原始檔
              </button>
              <p>請在不含登入資料的隔離測試環境閱讀原始碼並試玩；不要直接在日常瀏覽器開啟。</p>
            </div>

            {(release.status === 'pending_review' || release.status === 'publishing' || release.status === 'blocked') && (
              <div className="admin-game-review-actions">
                <label className="admin-field">
                  <span>審核備註</span>
                  <textarea
                    maxLength={2000}
                    onChange={(event) => setNotes((current) => ({ ...current, [release.id]: event.target.value }))}
                    placeholder="記錄人工檢查、試玩結果或退回原因"
                    rows={3}
                    value={notes[release.id] ?? ''}
                  />
                </label>
                <fieldset className="admin-game-evidence">
                  <legend>人工審核紀錄</legend>
                  <label>
                    <input
                      checked={evidence[release.id]?.sourceReviewed ?? false}
                      onChange={(event) => setEvidence((current) => ({
                        ...current,
                        [release.id]: {
                          sourceReviewed: event.target.checked,
                          playTested: current[release.id]?.playTested ?? false,
                          metadataReviewed: current[release.id]?.metadataReviewed ?? false,
                        },
                      }))}
                      type="checkbox"
                    />
                    已閱讀未混淆原始碼並核對掃描項目
                  </label>
                  <label>
                    <input
                      checked={evidence[release.id]?.playTested ?? false}
                      onChange={(event) => setEvidence((current) => ({
                        ...current,
                        [release.id]: {
                          sourceReviewed: current[release.id]?.sourceReviewed ?? false,
                          playTested: event.target.checked,
                          metadataReviewed: current[release.id]?.metadataReviewed ?? false,
                        },
                      }))}
                      type="checkbox"
                    />
                    已在隔離、無帳戶資料的環境完成試玩
                  </label>
                  <label>
                    <input
                      checked={evidence[release.id]?.metadataReviewed ?? false}
                      onChange={(event) => setEvidence((current) => ({
                        ...current,
                        [release.id]: {
                          sourceReviewed: current[release.id]?.sourceReviewed ?? false,
                          playTested: current[release.id]?.playTested ?? false,
                          metadataReviewed: event.target.checked,
                        },
                      }))}
                      type="checkbox"
                    />
                    已核對公開名稱、開發者、分類與摘要，且沒有未經證實的醫療、療效或適用族群宣稱
                  </label>
                </fieldset>
                <div>
                  <button
                    className="admin-button admin-button-primary"
                    disabled={busyId === release.id
                      || release.status === 'blocked'
                      || !evidence[release.id]?.sourceReviewed
                      || !evidence[release.id]?.playTested
                      || !evidence[release.id]?.metadataReviewed}
                    onClick={() => void review(release, 'approve')}
                    type="button"
                  >
                    核准相同雜湊版本
                  </button>
                  {release.status !== 'publishing' && (
                    <button
                      className="admin-button admin-button-secondary"
                      disabled={busyId === release.id}
                      onClick={() => void review(release, 'reject')}
                      type="button"
                    >
                      退回版本
                    </button>
                  )}
                </div>
              </div>
            )}
            {release.status === 'approved' && (
              <div className="admin-game-review-actions admin-game-revoke-actions">
                <label className="admin-field">
                  <span>緊急下架原因</span>
                  <textarea
                    maxLength={2000}
                    onChange={(event) => setNotes((current) => ({ ...current, [release.id]: event.target.value }))}
                    placeholder="記錄新發現的安全、內容或權利問題"
                    required
                    rows={3}
                    value={notes[release.id] ?? ''}
                  />
                </label>
                <div>
                  <button
                    className="admin-button admin-button-secondary"
                    disabled={busyId === release.id || !(notes[release.id] ?? '').trim()}
                    onClick={() => void review(release, 'revoke')}
                    type="button"
                  >
                    緊急下架並撤銷線上啟動
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function FormatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function IsSourceViewerFile(contentType: string, path: string): boolean {
  return /^(?:text\/|application\/(?:javascript|json|xml)|image\/svg\+xml)/i.test(contentType)
    || /\.(?:css|html?|js|json|md|mjs|svg|txt|xml)$/i.test(path);
}

function BuildFindingOverrides(
  submission: AdminGameSubmission,
  drafts: Record<string, AdminGameFindingOverride> | undefined,
): AdminGameFindingOverride[] {
  return submission.findings
    .filter((finding) => finding.disposition === 'fix-or-manual-review' || finding.disposition === 'manual-review')
    .map((finding) => drafts?.[finding.id] ?? {
      findingId: finding.id,
      decision: 'dismiss',
      reason: '',
      evidence: '',
    });
}

function UpdateFindingOverride(
  setFindingOverrides: Dispatch<SetStateAction<FindingOverrideState>>,
  submissionId: string,
  findingId: string,
  patch: Partial<AdminGameFindingOverride>,
) {
  setFindingOverrides((current) => {
    const previous = current[submissionId]?.[findingId];
    const nextOverride: AdminGameFindingOverride = previous
      ? { ...previous, ...patch, findingId }
      : { findingId, decision: 'dismiss', reason: '', evidence: '', ...patch };
    return {
      ...current,
      [submissionId]: {
        ...current[submissionId],
        [findingId]: nextOverride,
      },
    };
  });
}

function FormatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-TW');
}

function FormatReportStatus(value: AdminGameReportStatus): string {
  const labels: Record<AdminGameReportStatus, string> = {
    open: '待處理',
    in_review: '處理中',
    resolved: '已處理',
    rejected: '已駁回',
  };
  return labels[value];
}

function FormatReportReason(value: AdminGameReport['reason']): string {
  const labels: Record<AdminGameReport['reason'], string> = {
    safety: '安全性',
    copyright: '著作權',
    privacy: '隱私',
    content: '內容',
    other: '其他',
  };
  return labels[value];
}
