'use client';

import { useEffect, useState } from 'react';
import { DownloadFile } from '@rehab-trainer/ui/downloadFile';
import {
  trainerCategoryTags,
  trainingPurposes,
} from '@rehab-trainer/hub-modules/catalog';
import {
  DownloadAdminGameReleaseArtifact,
  FetchAdminGameReleases,
  ReviewAdminGameRelease,
  type AdminGameRelease,
  type GameReleaseReviewStatus,
} from './adminApi';

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
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState('');
  const [evidence, setEvidence] = useState<Record<string, {
    sourceReviewed: boolean;
    playTested: boolean;
    metadataReviewed: boolean;
  }>>({});
  const [reloadKey, setReloadKey] = useState(0);

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
                <div>
                  <dt>遊戲大分類</dt>
                  <dd>{trainerCategoryTags.find((tag) => tag.id === release.trainer)?.label['zh-TW'] ?? release.trainer}</dd>
                </div>
                <div>
                  <dt>大廳篩選標籤</dt>
                  <dd>{trainingPurposes.find((tag) => tag.id === release.category)?.label['zh-TW'] ?? release.category}</dd>
                </div>
              </dl>
              <p><strong>遊戲名稱：</strong>{release.title}</p>
              <p><strong>公開摘要：</strong>{release.summary || '（未提供摘要）'}</p>
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

function FormatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-TW');
}
