const notificationKinds = Object.freeze([
  'request-changes',
  'rejected',
  'revoked',
  'validation-failed',
  'review-requested',
]);
const maximumPayloadBytes = 8 * 1024;

export { notificationKinds };

/**
 * Notifications are persisted in the same D1 batch as the state transition.
 * Delivery workers may retry independently; no external provider is called
 * from a review request or release publication transaction.
 */
export function CreateGamePlatformNotificationStatement(db, {
  recipientUserId,
  gameId,
  releaseId = null,
  submissionId = null,
  kind,
  payload = {},
  createdAt = new Date().toISOString(),
}) {
  if (!notificationKinds.includes(kind)) throw new TypeError('Invalid game notification kind.');
  const payloadJson = JSON.stringify(payload ?? {});
  if (new TextEncoder().encode(payloadJson).byteLength > maximumPayloadBytes) {
    throw new TypeError('Game notification payload is too large.');
  }
  return db
    .prepare(`
      INSERT INTO game_platform_notifications (
        id, recipient_user_id, game_id, release_id, submission_id,
        kind, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      crypto.randomUUID(),
      recipientUserId,
      gameId,
      releaseId,
      submissionId,
      kind,
      payloadJson,
      createdAt,
    );
}

export function CreateNotificationReadQuery(db, recipientUserId, limit = 50) {
  const safeLimit = Number.isSafeInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 50;
  return db
    .prepare(`
      SELECT id, game_id, release_id, submission_id, kind,
             payload_json, delivered_at, created_at
      FROM game_platform_notifications
      WHERE recipient_user_id = ?
      ORDER BY created_at DESC
      LIMIT ${safeLimit}
    `)
    .bind(recipientUserId);
}
