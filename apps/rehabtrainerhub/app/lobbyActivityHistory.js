export const guestLobbyHistoryKey = 'rehabtrainerhub.lobby.activity-history';
export const lobbyActivitySavedEvent = 'rehab-trainer:lobby-activity-saved';

const guestHistoryLimit = 200;
const gameIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const timestampPattern = /^(\d{4}-\d{2}-\d{2})[T ](?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})?$/;

function ParseActivityTime(playedAt) {
  if (typeof playedAt !== 'string') return NaN;
  const match = timestampPattern.exec(playedAt);
  if (!match) return NaN;
  const [, date, offset] = match;
  const midnight = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(midnight.getTime()) || !midnight.toISOString().startsWith(date)) return NaN;
  // SQLite's timestamps without an explicit offset are UTC.
  return Date.parse(playedAt.replace(' ', 'T') + (offset ? '' : 'Z'));
}

function NormalizeActivityHistory(entries, knownIds) {
  if (!Array.isArray(entries)) return [];
  const valid = [];
  for (const entry of entries) {
    const { gameId, playedAt } = entry ?? {};
    if (typeof gameId !== 'string' || !gameIdPattern.test(gameId) || (knownIds && !knownIds.has(gameId))) continue;
    const time = ParseActivityTime(playedAt);
    if (Number.isFinite(time)) valid.push({ gameId, playedAt, time });
  }
  return valid.sort((a, b) => b.time - a.time)
    .slice(0, guestHistoryLimit)
    .map(({ gameId, playedAt }) => ({ gameId, playedAt }));
}

function ReadStoredGuestHistory(device) {
  try { return JSON.parse(device.localStorage.getItem(guestLobbyHistoryKey) ?? '[]'); }
  catch { return []; }
}

export function ReadGuestLobbyHistory(device, knownIds) {
  // The old distinct-activity list uses the same fields, so each entry is one event.
  return NormalizeActivityHistory(ReadStoredGuestHistory(device), knownIds);
}

export function SummarizeGuestLobbyHistory(history) {
  const summaries = new Map();
  for (const { gameId, playedAt } of history) {
    const summary = summaries.get(gameId);
    if (summary) summary.count++;
    else summaries.set(gameId, { gameId, count: 1, lastPlayedAt: new Date(ParseActivityTime(playedAt)).toISOString() });
  }
  return [...summaries.values()];
}

export function NormalizeLobbyPlayCounts(entries) {
  if (!Array.isArray(entries)) return [];
  const summaries = new Map();
  for (const entry of entries) {
    const { gameId, count, lastPlayedAt } = entry ?? {};
    if (typeof gameId !== 'string' || !gameIdPattern.test(gameId) || summaries.has(gameId)) continue;
    if (!Number.isSafeInteger(count) || count < 1) continue;
    const time = ParseActivityTime(lastPlayedAt);
    if (Number.isFinite(time)) summaries.set(gameId, { gameId, count, lastPlayedAt: new Date(time).toISOString() });
  }
  return [...summaries.values()];
}

export function PublishLobbyActivity(device, gameId, playedAt, isGuest) {
  if (isGuest) {
    const saved = ReadStoredGuestHistory(device);
    // Package IDs can be checked against the published catalog when the lobby reads the history.
    const entries = [{ gameId, playedAt }, ...(Array.isArray(saved) ? saved : [])];
    const history = NormalizeActivityHistory(entries, null);
    try { device.localStorage.setItem(guestLobbyHistoryKey, JSON.stringify(history)); }
    catch { /* Storage restrictions must not change the result of saving an activity. */ }
  }
  device.dispatchEvent(new Event(lobbyActivitySavedEvent));
}
