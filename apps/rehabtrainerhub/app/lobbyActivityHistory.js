export const guestLobbyHistoryKey = 'rehabtrainerhub.lobby.activity-history';
export const lobbyActivitySavedEvent = 'rehab-trainer:lobby-activity-saved';

const guestHistoryLimit = 20;
const gameIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const timestampPattern = /^(\d{4}-\d{2}-\d{2})[T ](?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})?$/;

export function NormalizeActivityHistory(entries, knownIds, limit) {
  if (!Array.isArray(entries)) return [];
  const valid = [];
  for (const entry of entries) {
    const { gameId, playedAt } = entry ?? {};
    if (typeof gameId !== 'string' || !gameIdPattern.test(gameId) || (knownIds && !knownIds.has(gameId))) continue;
    if (typeof playedAt !== 'string') continue;
    const match = timestampPattern.exec(playedAt);
    if (!match) continue;
    const [, date, offset] = match;
    const midnight = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(midnight.getTime()) || !midnight.toISOString().startsWith(date)) continue;
    // SQLite's timestamps without an explicit offset are UTC.
    const time = Date.parse(playedAt.replace(' ', 'T') + (offset ? '' : 'Z'));
    if (Number.isFinite(time)) valid.push({ gameId, playedAt, time });
  }
  const seen = new Set();
  const history = [];
  for (const { gameId, playedAt } of valid.sort((a, b) => b.time - a.time)) {
    if (seen.has(gameId)) continue;
    seen.add(gameId);
    history.push({ gameId, playedAt });
    if (history.length === limit) break;
  }
  return history;
}

function ReadStoredGuestHistory(device) {
  try { return JSON.parse(device.localStorage.getItem(guestLobbyHistoryKey) ?? '[]'); }
  catch { return []; }
}

export function ReadGuestLobbyHistory(device, knownIds) {
  return NormalizeActivityHistory(ReadStoredGuestHistory(device), knownIds, guestHistoryLimit);
}

export function PublishLobbyActivity(device, gameId, playedAt, isGuest) {
  if (isGuest) {
    const saved = ReadStoredGuestHistory(device);
    // Package IDs can be checked against the published catalog when the lobby reads the history.
    const entries = [{ gameId, playedAt }, ...(Array.isArray(saved) ? saved : [])];
    const history = NormalizeActivityHistory(entries, null, guestHistoryLimit);
    try { device.localStorage.setItem(guestLobbyHistoryKey, JSON.stringify(history)); }
    catch { /* Storage restrictions must not change the result of saving an activity. */ }
  }
  device.dispatchEvent(new Event(lobbyActivitySavedEvent));
}
