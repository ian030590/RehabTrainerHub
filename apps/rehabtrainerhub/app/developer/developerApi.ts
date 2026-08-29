import {
  BuildApiUrl,
  GetAuthToken,
} from '@rehab-trainer/ui/auth/authClient';

export type DeveloperReleaseStatus = 'blocked' | 'pending_review' | 'publishing' | 'approved' | 'rejected' | 'revoked';
export type DeveloperManualReviewStatus = 'requested' | 'in_review' | 'changes_requested' | 'approved' | 'rejected';

export interface DeveloperValidationFinding {
  id: string;
  disposition: 'hard-block' | 'fix-or-manual-review' | 'manual-review' | 'info';
  code: string;
  filePath: string | null;
  line: number | null;
  column: number | null;
  messageKey: string;
}

export interface DeveloperRelease {
  id: string;
  version: string;
  status: DeveloperReleaseStatus;
  contentSha256: string;
  packageBytes: number;
  uncompressedBytes: number;
  fileCount: number;
  submissionId: string | null;
  scan: {
    blockCount?: number;
    reviewCount?: number;
    findingCodes?: string[];
  };
  manualReviewStatus: DeveloperManualReviewStatus | null;
  findings: DeveloperValidationFinding[];
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

export interface DeveloperGame {
  id: string;
  slug: string;
  developerName: string;
  title: string;
  summary: string;
  category: string;
  status: 'draft' | 'published' | 'suspended';
  activeReleaseId: string | null;
  createdAt: string;
  updatedAt: string;
  releases: DeveloperRelease[];
}

export interface GameSubmissionInput {
  packageFile: File;
  slug: string;
  title: string;
  developerName: string;
  summary: string;
  category: string;
  version: string;
  jsPsychVersion: string;
  capabilities: string[];
}

export interface GameSubmissionResponse {
  game: Pick<DeveloperGame, 'id' | 'slug' | 'title'>;
  release: DeveloperRelease & {
    findings: Array<{
      severity: 'block' | 'review' | 'info';
      code: string;
      filePath: string | null;
      message: string;
    }>;
  };
}

export interface ManualReviewRequestResponse {
  reviewRequest: {
    id: string;
    submissionId: string;
    scanRunId: string;
    findingIds: string[];
    status: 'requested';
    requestedAt: string;
  };
}

export async function FetchDeveloperGames(signal?: AbortSignal): Promise<DeveloperGame[]> {
  const response = await DeveloperFetch('/api/developer/games', { signal });
  const payload = await response.json() as { games?: DeveloperGame[] };
  return payload.games ?? [];
}

export async function SubmitDeveloperGame(input: GameSubmissionInput): Promise<GameSubmissionResponse> {
  const formData = new FormData();
  formData.set('package', input.packageFile);
  formData.set('slug', input.slug);
  formData.set('title', input.title);
  formData.set('developerName', input.developerName);
  formData.set('summary', input.summary);
  formData.set('category', input.category);
  formData.set('version', input.version);
  formData.set('jsPsychVersion', input.jsPsychVersion);
  formData.set('capabilities', JSON.stringify(input.capabilities));
  const response = await DeveloperFetch('/api/developer/games', {
    method: 'POST',
    body: formData,
  });
  return response.json() as Promise<GameSubmissionResponse>;
}

export async function RequestDeveloperGameManualReview(
  submissionId: string,
  reason: string,
): Promise<ManualReviewRequestResponse> {
  const response = await DeveloperFetch(
    `/api/developer/game-submissions/${encodeURIComponent(submissionId)}/review`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    },
  );
  return response.json() as Promise<ManualReviewRequestResponse>;
}

async function DeveloperFetch(path: string, init: RequestInit): Promise<Response> {
  const token = GetAuthToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(BuildApiUrl(undefined, path), {
    ...init,
    credentials: 'include',
    headers,
  });
  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;
    try {
      const payload = await response.json() as { error?: unknown };
      if (typeof payload.error === 'string' && payload.error.trim()) message = payload.error;
    } catch {
      // Retain the status fallback for non-JSON edge responses.
    }
    throw new Error(message);
  }
  return response;
}
