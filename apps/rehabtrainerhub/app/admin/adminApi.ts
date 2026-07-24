import {
  BuildApiUrl,
  GetAuthToken,
} from '@rehab-trainer/ui/auth/authClient';
import type {
  Article,
  ArticleCard,
  ArticleInput,
} from '../articleTypes';

export interface AdminOverviewSummary {
  patientCount: number;
  recordCount: number;
  trainingDays: number;
  latestActivityAt: string | null;
}

export interface AdminPatient {
  id: string;
  displayName: string;
  email: string | null;
  recordCount: number;
  lastTrainedAt: string | null;
}

export interface AdminOverviewResponse {
  summary: AdminOverviewSummary;
  patients: AdminPatient[];
  patientsTruncated?: boolean;
}

export interface AdminTrainingRecord {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string | null;
  appId: string;
  moduleId: string;
  gameId: string | null;
  trainingDate: string | null;
  savedAt: string;
  difficulty: string | null;
  userName: string | null;
  dataTrust: 'client-reported';
  payload: Record<string, unknown> | null;
}

export interface AdminRecordsPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminRecordsResponse {
  records: AdminTrainingRecord[];
  pagination: AdminRecordsPagination;
}

export interface AdminRecordFilters {
  patientId: string;
  appId: string;
  dateFrom: string;
  dateTo: string;
}

export interface AdminAssetResponse {
  url: string;
  key: string;
}

export class AdminApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

function BuildAdminUrl(
  path: string,
  query?: Record<string, string | number | undefined>,
): string {
  const url = new URL(BuildApiUrl(undefined, path), window.location.origin);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && String(value).trim()) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

async function ReadErrorMessage(response: Response): Promise<string> {
  const fallback = `Request failed with status ${response.status}.`;
  try {
    const payload = await response.json() as { error?: unknown };
    return typeof payload.error === 'string' && payload.error.trim()
      ? payload.error
      : fallback;
  } catch {
    return fallback;
  }
}

async function AdminFetch(
  path: string,
  init: RequestInit = {},
  query?: Record<string, string | number | undefined>,
): Promise<Response> {
  const token = GetAuthToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(BuildAdminUrl(path, query), {
    ...init,
    credentials: 'include',
    headers,
  });
  if (!response.ok) {
    throw new AdminApiError(await ReadErrorMessage(response), response.status);
  }
  return response;
}

async function ReadJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

export async function FetchAdminOverview(signal?: AbortSignal): Promise<AdminOverviewResponse> {
  return ReadJson<AdminOverviewResponse>(
    await AdminFetch('/api/admin/overview', { signal }),
  );
}

export async function FetchAdminRecords(
  filters: AdminRecordFilters,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
): Promise<AdminRecordsResponse> {
  return ReadJson<AdminRecordsResponse>(
    await AdminFetch('/api/admin/records', { signal }, {
      patientId: filters.patientId,
      appId: filters.appId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      page,
      pageSize,
    }),
  );
}

export async function FetchAdminRecordsCsv(
  filters: AdminRecordFilters,
  signal?: AbortSignal,
): Promise<{
  blob: Blob;
  filename: string;
  rowLimit: number;
  truncated: boolean;
}> {
  const response = await AdminFetch('/api/admin/records', { signal }, {
    patientId: filters.patientId,
    appId: filters.appId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    format: 'csv',
    limit: 5000,
  });
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
  return {
    blob: await response.blob(),
    filename: filenameMatch?.[1] ?? `rehab-training-records-${new Date().toISOString().slice(0, 10)}.csv`,
    rowLimit: Number(response.headers.get('X-Export-Row-Limit')) || 5000,
    truncated: response.headers.get('X-Export-Truncated') === 'true',
  };
}

export async function FetchAdminArticles(signal?: AbortSignal): Promise<ArticleCard[]> {
  const payload = await ReadJson<{ articles: ArticleCard[] }>(
    await AdminFetch('/api/admin/articles', { signal }),
  );
  return payload.articles;
}

export async function FetchAdminArticle(
  articleId: string,
  signal?: AbortSignal,
): Promise<Article> {
  const payload = await ReadJson<{ article: Article }>(
    await AdminFetch(
      `/api/admin/articles/${encodeURIComponent(articleId)}`,
      { signal },
    ),
  );
  return payload.article;
}

export async function CreateAdminArticle(input: ArticleInput): Promise<Article> {
  const response = await AdminFetch('/api/admin/articles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = await ReadJson<{ article: Article }>(response);
  return payload.article;
}

export async function UpdateAdminArticle(
  articleId: string,
  input: Partial<ArticleInput>,
): Promise<Article> {
  const response = await AdminFetch(`/api/admin/articles/${encodeURIComponent(articleId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = await ReadJson<{ article: Article }>(response);
  return payload.article;
}

export async function DeleteAdminArticle(articleId: string): Promise<void> {
  await AdminFetch(`/api/admin/articles/${encodeURIComponent(articleId)}`, {
    method: 'DELETE',
  });
}

export async function UploadAdminAsset(file: File): Promise<AdminAssetResponse> {
  const formData = new FormData();
  formData.set('file', file);
  return ReadJson<AdminAssetResponse>(
    await AdminFetch('/api/admin/assets', {
      method: 'POST',
      body: formData,
    }),
  );
}
