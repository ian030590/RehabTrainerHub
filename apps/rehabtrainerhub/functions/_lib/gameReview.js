import { ErrorResponse } from './auth.js';

export const gameReviewRepository = 'ian030590/RehabTrainerHub';
export const gameReviewPolicyVersion = 1;

export function CheckGameReleaseOwner(request, env, user) {
  const ownerId = String(env.GAME_RELEASE_OWNER_USER_ID || '').trim();
  if (!ownerId) return ErrorResponse(request, env, 'Game release owner is not configured.', 503);
  if (user?.role !== 'admin' || user.id !== ownerId) return ErrorResponse(request, env, 'Only the game release owner can make this decision.', 403);
  return null;
}

export async function CreateGameReviewDigest(release) {
  const files = JSON.parse(release.files_json || '[]').map(file => ({
    path: file.path, byteSize: file.byteSize, contentType: file.contentType, sha256: file.sha256,
  })).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const snapshot = {
    policyVersion: gameReviewPolicyVersion,
    releaseId: release.id, gameId: release.game_id, slug: release.slug, version: release.version,
    title: release.submitted_title, summary: release.submitted_summary, author: release.submitted_developer_name,
    trainer: release.submitted_trainer, category: release.submitted_category, changes: release.change_notes || '',
    artifactType: release.artifact_type, entry: release.entry_path, artifactSha256: release.content_sha256,
    runtime: release.jspsych_version, capabilities: JSON.parse(release.capabilities_json || '[]').sort(), files,
  };
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(snapshot)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function BuildReviewIssueBody(release) {
  return [
    `<!-- trainerhub-release:${release.id} review-digest:${release.review_digest} -->`,
    '## 遊戲版本審核', '',
    `投稿編號：${release.id}`,
    `遊戲／版本：${EscapeIssueText(release.slug)} / ${EscapeIssueText(release.version)}`,
    `作者：${EscapeIssueText(release.submitted_developer_name)}`,
    `活動名稱：${EscapeIssueText(release.submitted_title)}`,
    `活動說明：${EscapeIssueText(release.submitted_summary)}`,
    `變更說明：${EscapeIssueText(release.change_notes || '未提供')}`,
    `要求能力：${JSON.parse(release.capabilities_json || '[]').map(EscapeIssueText).join('、') || '無'}`,
    `審核雜湊：${release.review_digest}`,
    `版本狀態：${release.status || 'pending_review'}`, '',
    `私有審核：https://trainerhub.cc/admin/?release=${encodeURIComponent(release.id)}`, '',
    '原始碼、套件與詳細掃描報告留在私有 R2，需授權登入後取得。',
    '每個版本必須重新審查。平台擁有者須在 Hub 核對此版本與審核雜湊後確認公開。',
    '修改標籤、勾選項目或關閉本 Issue 不會核准或發布遊戲。',
  ].join('\n');
}

export function IsGameReviewIssueUrl(value, issueNumber) {
  return Number.isSafeInteger(issueNumber) && issueNumber > 0
    && value === `https://github.com/${gameReviewRepository}/issues/${issueNumber}`;
}

function EscapeIssueText(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/@/g, '&#64;').replace(/([\\`*_{}\[\]()!#|])/g, '\\$1').replace(/\r?\n/g, ' ');
}
