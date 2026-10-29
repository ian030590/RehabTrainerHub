export async function EnsureAccountSubjectId(db, userId) {
  const account = await db.prepare('SELECT subject_id FROM app_users WHERE id = ?').bind(userId).first();
  if (!account) throw new Error('Account unavailable.');
  if (account.subject_id) return account.subject_id;

  // D1 batches are atomic; competing requests relabel history with the winning ID.
  await db.batch([
    db.prepare('UPDATE app_users SET subject_id = ? WHERE id = ? AND subject_id IS NULL')
      .bind(crypto.randomUUID(), userId),
    ...['training_records', 'game_run_sessions', 'game_runs'].map(table => db.prepare(`
      UPDATE ${table}
      SET subject_id = (SELECT subject_id FROM app_users WHERE id = ?)
      WHERE user_id = ?
    `).bind(userId, userId)),
  ]);
  const assigned = await db.prepare('SELECT subject_id FROM app_users WHERE id = ?').bind(userId).first();
  if (!assigned?.subject_id) throw new Error('Account subject unavailable.');
  return assigned.subject_id;
}
