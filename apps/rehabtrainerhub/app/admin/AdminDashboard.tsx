'use client';

import {
  useEffect,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { DownloadFile } from '@rehab-trainer/ui/downloadFile';
import { useHubAuth } from '../HubNavigation';
import { ArticleManager } from './ArticleManager';
import {
  FetchAdminOverview,
  FetchAdminRecords,
  FetchAdminRecordsCsv,
  type AdminOverviewResponse,
  type AdminRecordFilters,
  type AdminRecordsResponse,
} from './adminApi';

type AdminTab = 'overview' | 'records' | 'articles';
type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';
type StaffRole = 'therapist' | 'admin';

const tabItems: readonly { id: AdminTab; label: string; icon: string }[] = [
  { id: 'overview', label: '數據總覽', icon: 'monitoring' },
  { id: 'records', label: '訓練紀錄', icon: 'table_view' },
  { id: 'articles', label: '衛教文章', icon: 'article' },
];

const emptyFilters: AdminRecordFilters = {
  patientId: '',
  appId: '',
  dateFrom: '',
  dateTo: '',
};

const pageSize = 20;

const appOptions = [
  { id: 'motortrainer', label: 'MotorTrainer' },
  { id: 'visiontrainer', label: 'VisionTrainer' },
  { id: 'braintrainer', label: 'BrainTrainer' },
  { id: 'mouthtrainer', label: 'MouthTrainer' },
  { id: 'rehabtrainerhub', label: 'Rehab Trainer Hub' },
] as const;

function GetUserRole(user: unknown): string {
  if (!user || typeof user !== 'object' || !('role' in user)) return 'patient';
  const role = (user as { role?: unknown }).role;
  return typeof role === 'string' ? role : 'patient';
}

function IsStaffRole(role: string): role is StaffRole {
  return role === 'therapist' || role === 'admin';
}

function FormatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function FormatTrainingDate(value: string | null, fallback: string): string {
  const target = value || fallback;
  const date = new Date(value ? `${value}T00:00:00` : fallback);
  if (Number.isNaN(date.getTime())) return target;
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function GetAppLabel(appId: string): string {
  return appOptions.find((app) => app.id === appId)?.label ?? appId;
}

function FormatRecordPayload(payload: Record<string, unknown> | null): string {
  if (!payload) return '沒有可顯示的詳細資料';
  const serialized = JSON.stringify(payload, null, 2);
  const maximumDisplayLength = 20_000;
  return serialized.length > maximumDisplayLength
    ? `${serialized.slice(0, maximumDisplayLength)}\n…其餘內容請下載 CSV 查看`
    : serialized;
}

function AdminAccessMessage({
  signedIn,
}: {
  signedIn: boolean;
}) {
  return (
    <main className="admin-page" id="main-content">
      <header className="page-heading">
        <p className="page-kicker">Therapist administration</p>
        <h1>治療師後台</h1>
      </header>
      <section className="admin-access-notice" role="status">
        <span className="material-symbols-outlined" aria-hidden="true">
          {signedIn ? 'block' : 'lock'}
        </span>
        <div>
          <h2>{signedIn ? '此帳號沒有後台權限' : '請先登入治療師帳號'}</h2>
          <p>
            {signedIn
              ? '治療師後台只開放已授權的治療師與系統管理員使用。'
              : '請使用右上角帳號按鈕登入；系統會依帳號角色判斷存取權限。'}
          </p>
        </div>
      </section>
    </main>
  );
}

export function AdminDashboard() {
  const { user } = useHubAuth();
  const role = GetUserRole(user);
  const isStaff = IsStaffRole(role);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [overviewStatus, setOverviewStatus] = useState<LoadStatus>('idle');
  const [overviewError, setOverviewError] = useState('');
  const [overviewKey, setOverviewKey] = useState(0);

  const [draftFilters, setDraftFilters] = useState<AdminRecordFilters>(emptyFilters);
  const [filters, setFilters] = useState<AdminRecordFilters>(emptyFilters);
  const [filterError, setFilterError] = useState('');
  const [records, setRecords] = useState<AdminRecordsResponse | null>(null);
  const [recordsStatus, setRecordsStatus] = useState<LoadStatus>('idle');
  const [recordsError, setRecordsError] = useState('');
  const [recordsNotice, setRecordsNotice] = useState('');
  const [recordsKey, setRecordsKey] = useState(0);
  const [page, setPage] = useState(1);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!isStaff) {
      setOverview(null);
      setOverviewStatus('idle');
      return;
    }

    const controller = new AbortController();
    setOverviewStatus('loading');
    setOverviewError('');
    void FetchAdminOverview(controller.signal)
      .then((nextOverview) => {
        setOverview(nextOverview);
        setOverviewStatus('ready');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn('Unable to load therapist overview.', error);
        setOverviewError('目前無法載入後台總覽，請稍後再試。');
        setOverviewStatus('error');
      });
    return () => controller.abort();
  }, [isStaff, overviewKey]);

  useEffect(() => {
    if (!isStaff || activeTab !== 'records') return;

    const controller = new AbortController();
    setRecordsStatus('loading');
    setRecordsError('');
    void FetchAdminRecords(filters, page, pageSize, controller.signal)
      .then((nextRecords) => {
        setRecords(nextRecords);
        setRecordsStatus('ready');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn('Unable to load therapist records.', error);
        setRecordsError('目前無法載入訓練紀錄，請稍後再試。');
        setRecordsStatus('error');
      });
    return () => controller.abort();
  }, [activeTab, filters, isStaff, page, recordsKey]);

  if (!isStaff) {
    return <AdminAccessMessage signedIn={Boolean(user)} />;
  }

  const selectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    window.requestAnimationFrame(() => {
      document.getElementById(`admin-tab-${tab}`)?.focus();
    });
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = tabItems.findIndex((item) => item.id === activeTab);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabItems.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabItems.length) % tabItems.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabItems.length - 1;
    if (nextIndex === currentIndex) return;
    event.preventDefault();
    selectTab(tabItems[nextIndex].id);
  };

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draftFilters.dateFrom && draftFilters.dateTo
      && draftFilters.dateFrom > draftFilters.dateTo) {
      setFilterError('開始日期不得晚於結束日期。');
      return;
    }
    setFilterError('');
    setRecordsNotice('');
    setPage(1);
    setFilters({ ...draftFilters });
  };

  const clearFilters = () => {
    setDraftFilters(emptyFilters);
    setFilters(emptyFilters);
    setFilterError('');
    setRecordsNotice('');
    setPage(1);
  };

  const downloadCsv = async () => {
    setIsDownloading(true);
    setRecordsError('');
    setRecordsNotice('');
    try {
      const csv = await FetchAdminRecordsCsv(filters);
      DownloadFile(csv.blob, csv.filename, csv.blob.type || 'text/csv;charset=utf-8');
      if (csv.truncated) {
        setRecordsNotice(
          `資料超過 ${csv.rowLimit.toLocaleString('zh-TW')} 筆；已下載最新資料。請縮小日期或患者篩選範圍以分批下載完整紀錄。`,
        );
      }
    } catch (error) {
      console.warn('Unable to download therapist records.', error);
      setRecordsError('CSV 下載失敗，請稍後再試。');
    } finally {
      setIsDownloading(false);
    }
  };

  const summary = overview?.summary;
  const patients = overview?.patients ?? [];
  const pagination = records?.pagination;
  const totalPages = Math.max(1, pagination?.totalPages ?? 1);

  return (
    <main className="admin-page" id="main-content">
      <header className="admin-page-heading">
        <div>
          <p className="page-kicker">Therapist administration</p>
          <h1>治療師後台</h1>
          <p>查看患者訓練資料、下載紀錄，並維護問答中心的衛教文章。</p>
        </div>
        <span className="admin-role-badge">
          <span className="material-symbols-outlined" aria-hidden="true">
            {role === 'admin' ? 'admin_panel_settings' : 'clinical_notes'}
          </span>
          {role === 'admin' ? '系統管理員' : '治療師'}
        </span>
      </header>

      <div className="admin-tabs" aria-label="治療師後台功能" role="tablist">
        {tabItems.map((item) => (
          <button
            aria-controls={`admin-panel-${item.id}`}
            aria-selected={activeTab === item.id}
            className={activeTab === item.id ? 'is-active' : ''}
            id={`admin-tab-${item.id}`}
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            onKeyDown={handleTabKeyDown}
            role="tab"
            tabIndex={activeTab === item.id ? 0 : -1}
            type="button"
          >
            <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <section
        aria-labelledby="admin-tab-overview"
        className="admin-tab-panel"
        hidden={activeTab !== 'overview'}
        id="admin-panel-overview"
        role="tabpanel"
        tabIndex={0}
      >
        <div className="admin-section-toolbar">
          <div>
            <p className="page-kicker">Overview</p>
            <h2>數據總覽</h2>
            <p>統計範圍會依目前帳號可管理的患者權限顯示。</p>
          </div>
          <button
            className="admin-button admin-button-secondary"
            disabled={overviewStatus === 'loading'}
            onClick={() => setOverviewKey((current) => current + 1)}
            type="button"
          >
            <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
            更新
          </button>
        </div>

        {overviewStatus === 'loading' && !overview && (
          <div className="admin-state" role="status">
            <span className="material-symbols-outlined" aria-hidden="true">progress_activity</span>
            <p>正在載入後台總覽…</p>
          </div>
        )}

        {overviewStatus === 'error' && (
          <div className="admin-state admin-state-error" role="alert">
            <span className="material-symbols-outlined" aria-hidden="true">error</span>
            <p>{overviewError}</p>
            <button
              className="admin-button admin-button-secondary"
              onClick={() => setOverviewKey((current) => current + 1)}
              type="button"
            >
              重新載入
            </button>
          </div>
        )}

        {overview && (
          <>
            <section className="admin-kpi-grid" aria-label="訓練資料摘要">
              <article>
                <span className="material-symbols-outlined" aria-hidden="true">groups</span>
                <div>
                  <p>可管理患者</p>
                  <strong>{summary?.patientCount ?? 0}</strong>
                  <small>人</small>
                </div>
              </article>
              <article>
                <span className="material-symbols-outlined" aria-hidden="true">exercise</span>
                <div>
                  <p>訓練紀錄</p>
                  <strong>{summary?.recordCount ?? 0}</strong>
                  <small>筆</small>
                </div>
              </article>
              <article>
                <span className="material-symbols-outlined" aria-hidden="true">calendar_month</span>
                <div>
                  <p>有訓練的日期</p>
                  <strong>{summary?.trainingDays ?? 0}</strong>
                  <small>天</small>
                </div>
              </article>
              <article className="admin-kpi-latest">
                <span className="material-symbols-outlined" aria-hidden="true">schedule</span>
                <div>
                  <p>最近訓練活動</p>
                  <strong>
                    {summary?.latestActivityAt
                      ? (
                          <time dateTime={summary.latestActivityAt}>
                            {FormatDateTime(summary.latestActivityAt)}
                          </time>
                        )
                      : '尚無紀錄'}
                  </strong>
                </div>
              </article>
            </section>

            <section className="admin-patient-section" aria-labelledby="admin-patient-title">
              <div className="section-title-row">
                <div>
                  <p className="page-kicker">Patients</p>
                  <h2 id="admin-patient-title">患者摘要</h2>
                </div>
                <p>{patients.length} 位患者</p>
              </div>

              {patients.length === 0 ? (
                <div className="admin-state">
                  <span className="material-symbols-outlined" aria-hidden="true">person_off</span>
                  <h3>目前沒有可管理的患者</h3>
                  <p>患者完成指派後，摘要會顯示在這裡。</p>
                </div>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <caption className="sr-only">患者訓練摘要</caption>
                    <thead>
                      <tr>
                        <th scope="col">患者</th>
                        <th scope="col">電子郵件</th>
                        <th scope="col">紀錄數</th>
                        <th scope="col">最近訓練</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patients.map((patient) => (
                        <tr key={patient.id}>
                          <th scope="row">{patient.displayName}</th>
                          <td>{patient.email ?? '—'}</td>
                          <td>{patient.recordCount}</td>
                          <td>
                            {patient.lastTrainedAt ? (
                              <time dateTime={patient.lastTrainedAt}>
                                {FormatDateTime(patient.lastTrainedAt)}
                              </time>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </section>

      <section
        aria-labelledby="admin-tab-records"
        className="admin-tab-panel"
        hidden={activeTab !== 'records'}
        id="admin-panel-records"
        role="tabpanel"
        tabIndex={0}
      >
        <div className="admin-section-toolbar">
          <div>
            <p className="page-kicker">Training records</p>
            <h2>訓練紀錄</h2>
            <p>依患者、日期與訓練器篩選，或下載目前篩選範圍的 CSV。</p>
          </div>
          <button
            className="admin-button admin-button-primary"
            disabled={isDownloading || recordsStatus === 'loading'}
            onClick={() => void downloadCsv()}
            type="button"
          >
            <span className="material-symbols-outlined" aria-hidden="true">download</span>
            {isDownloading ? '下載中…' : '下載 CSV'}
          </button>
        </div>

        <form className="admin-filter-panel" onSubmit={applyFilters}>
          <label className="admin-field">
            <span>患者 ID 或選擇患者</span>
            <input
              list="admin-patient-options"
              onChange={(event) => setDraftFilters((current) => ({
                ...current,
                patientId: event.target.value,
              }))}
              placeholder="留空代表全部患者"
              type="text"
              value={draftFilters.patientId}
            />
            <datalist id="admin-patient-options">
              {patients.map((patient) => (
                <option
                  key={patient.id}
                  label={`${patient.displayName}${patient.email ? ` (${patient.email})` : ''}`}
                  value={patient.id}
                />
              ))}
            </datalist>
            {overview?.patientsTruncated && (
              <small>患者較多，選單僅列出最近訓練的 500 位；仍可直接輸入患者 ID。</small>
            )}
          </label>

          <label className="admin-field">
            <span>訓練器</span>
            <select
              onChange={(event) => setDraftFilters((current) => ({
                ...current,
                appId: event.target.value,
              }))}
              value={draftFilters.appId}
            >
              <option value="">全部訓練器</option>
              {appOptions.map((app) => (
                <option key={app.id} value={app.id}>{app.label}</option>
              ))}
            </select>
          </label>

          <label className="admin-field">
            <span>開始日期</span>
            <input
              onChange={(event) => setDraftFilters((current) => ({
                ...current,
                dateFrom: event.target.value,
              }))}
              type="date"
              value={draftFilters.dateFrom}
            />
          </label>

          <label className="admin-field">
            <span>結束日期</span>
            <input
              min={draftFilters.dateFrom || undefined}
              onChange={(event) => setDraftFilters((current) => ({
                ...current,
                dateTo: event.target.value,
              }))}
              type="date"
              value={draftFilters.dateTo}
            />
          </label>

          <div className="admin-filter-actions">
            <button className="admin-button admin-button-primary" type="submit">套用篩選</button>
            <button
              className="admin-button admin-button-secondary"
              onClick={clearFilters}
              type="button"
            >
              清除
            </button>
          </div>
          {filterError && <p className="admin-filter-error" role="alert">{filterError}</p>}
        </form>

        {recordsError && recordsStatus !== 'error' && (
          <p className="admin-alert admin-alert-error" role="alert">{recordsError}</p>
        )}
        {recordsNotice && (
          <p className="admin-alert admin-alert-warning" role="status">{recordsNotice}</p>
        )}

        {recordsStatus === 'loading' && (
          <div className="admin-state" role="status">
            <span className="material-symbols-outlined" aria-hidden="true">progress_activity</span>
            <p>正在載入訓練紀錄…</p>
          </div>
        )}

        {recordsStatus === 'error' && (
          <div className="admin-state admin-state-error" role="alert">
            <span className="material-symbols-outlined" aria-hidden="true">error</span>
            <p>{recordsError}</p>
            <button
              className="admin-button admin-button-secondary"
              onClick={() => setRecordsKey((current) => current + 1)}
              type="button"
            >
              重新載入
            </button>
          </div>
        )}

        {recordsStatus === 'ready' && records?.records.length === 0 && (
          <div className="admin-state">
            <span className="material-symbols-outlined" aria-hidden="true">search_off</span>
            <h3>找不到符合條件的紀錄</h3>
            <p>請調整患者、日期或訓練器篩選條件。</p>
          </div>
        )}

        {recordsStatus === 'ready' && records && records.records.length > 0 && (
          <>
            <div className="admin-record-summary" aria-live="polite">
              共 {records.pagination.total} 筆，第 {records.pagination.page} / {totalPages} 頁
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table admin-record-table">
                <caption className="sr-only">患者訓練紀錄</caption>
                <thead>
                  <tr>
                    <th scope="col">訓練日期</th>
                    <th scope="col">患者</th>
                    <th scope="col">訓練器</th>
                    <th scope="col">模組</th>
                    <th scope="col">遊戲</th>
                    <th scope="col">難度</th>
                    <th scope="col">儲存時間</th>
                  </tr>
                </thead>
                <tbody>
                  {records.records.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <time dateTime={record.trainingDate ?? record.savedAt}>
                          {FormatTrainingDate(record.trainingDate, record.savedAt)}
                        </time>
                      </td>
                      <th scope="row">
                        <span>{record.patientName}</span>
                        {record.patientEmail && <small>{record.patientEmail}</small>}
                      </th>
                      <td>{GetAppLabel(record.appId)}</td>
                      <td>{record.moduleId}</td>
                      <td>{record.gameId ?? '—'}</td>
                      <td>{record.difficulty ?? '—'}</td>
                      <td>
                        <time dateTime={record.savedAt}>{FormatDateTime(record.savedAt)}</time>
                        <details className="admin-record-details">
                          <summary>查看詳細數據（客戶端回報）</summary>
                          <pre>{FormatRecordPayload(record.payload)}</pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav className="admin-pagination" aria-label="訓練紀錄分頁">
              <button
                className="admin-button admin-button-secondary"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                type="button"
              >
                上一頁
              </button>
              <span aria-live="polite">第 {page} / {totalPages} 頁</span>
              <button
                className="admin-button admin-button-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                type="button"
              >
                下一頁
              </button>
            </nav>
          </>
        )}
      </section>

      <section
        aria-labelledby="admin-tab-articles"
        className="admin-tab-panel"
        hidden={activeTab !== 'articles'}
        id="admin-panel-articles"
        role="tabpanel"
        tabIndex={0}
      >
        <ArticleManager onArticlesChanged={() => setOverviewKey((current) => current + 1)} />
      </section>
    </main>
  );
}
