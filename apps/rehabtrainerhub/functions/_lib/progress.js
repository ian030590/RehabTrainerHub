export const defaultRehabTimeZone = 'Asia/Taipei';

export const achievementDefinitions = [
  { id: 'streak-7-days', title: '連續復健 7 天', requiredDays: 7 },
  { id: 'streak-14-days', title: '連續復健 14 天', requiredDays: 14 },
  { id: 'streak-21-days', title: '連續復健 21 天', requiredDays: 21 },
  { id: 'streak-1-month', title: '連續復健 1 個月', requiredDays: 30 },
  { id: 'streak-2-months', title: '連續復健 2 個月', requiredDays: 60 },
  { id: 'streak-3-months', title: '連續復健 3 個月', requiredDays: 90 },
  { id: 'streak-4-months', title: '連續復健 4 個月', requiredDays: 120 },
  { id: 'streak-5-months', title: '連續復健 5 個月', requiredDays: 150 },
  { id: 'streak-6-months', title: '連續復健 6 個月', requiredDays: 180 },
  { id: 'streak-1-year', title: '連續復健 1 年', requiredDays: 365 },
  { id: 'streak-2-years', title: '連續復健 2 年', requiredDays: 730 },
  { id: 'streak-3-years', title: '連續復健 3 年', requiredDays: 1095 },
  { id: 'streak-4-years', title: '連續復健 4 年', requiredDays: 1460 },
  { id: 'streak-5-years', title: '連續復健 5 年', requiredDays: 1825 },
];

export function GetServerDate(now = new Date(), timeZone = defaultRehabTimeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function BuildProgressSummary(rows, serverDate, timeZone = defaultRehabTimeZone) {
  const validRows = rows.filter((row) => (
    IsDateKey(row.training_date) && row.training_date <= serverDate
  ));
  const trainingDates = [...new Set(validRows.map((row) => row.training_date))].sort();
  const startedOn = trainingDates[0] ?? null;
  const lastTrainingDate = trainingDates.at(-1) ?? null;
  const currentStreak = HasActiveStreak(lastTrainingDate, serverDate)
    ? CountConsecutiveDays(new Set(trainingDates), lastTrainingDate)
    : 0;
  const todayRows = validRows.filter((row) => row.training_date === serverDate);
  const distinctModules = new Set(
    todayRows.map((row) => `${row.module_id || ''}:${row.game_id || ''}`),
  ).size;
  const recentModules = [];
  const recentModuleIds = new Set();
  for (const row of rows) {
    const moduleId = row.game_id || row.module_id;
    if (!moduleId || recentModuleIds.has(moduleId)) continue;
    recentModuleIds.add(moduleId);
    recentModules.push({
      moduleId,
      gameId: row.game_id || null,
      playedAt: row.created_at || null,
    });
    if (recentModules.length === 3) break;
  }

  return {
    serverDate,
    timeZone,
    startedOn,
    daysSinceStart: startedOn ? DateDifference(startedOn, serverDate) + 1 : 0,
    rehabilitationDays: currentStreak,
    totalRehabilitationDays: trainingDates.length,
    recentModules,
    dailyTasks: [
      CreateDailyTask('complete-one', '完成 1 次訓練', todayRows.length, 1),
      CreateDailyTask('complete-three', '完成 3 次訓練', todayRows.length, 3),
      CreateDailyTask('use-two-modules', '完成 2 種不同模組', distinctModules, 2),
    ],
    achievements: achievementDefinitions.map((achievement) => ({
      ...achievement,
      achieved: currentStreak >= achievement.requiredDays,
    })),
  };
}

function CreateDailyTask(id, title, current, target) {
  return {
    id,
    title,
    current: Math.min(current, target),
    target,
    completed: current >= target,
  };
}

function HasActiveStreak(lastTrainingDate, serverDate) {
  if (!lastTrainingDate) return false;
  return lastTrainingDate === serverDate || lastTrainingDate === AddDays(serverDate, -1);
}

function CountConsecutiveDays(trainingDates, lastTrainingDate) {
  let streak = 0;
  let cursor = lastTrainingDate;
  while (trainingDates.has(cursor)) {
    streak += 1;
    cursor = AddDays(cursor, -1);
  }
  return streak;
}

function IsDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function AddDays(dateKey, days) {
  const date = DateFromKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function DateDifference(startDate, endDate) {
  return Math.floor((DateFromKey(endDate).getTime() - DateFromKey(startDate).getTime()) / 86400000);
}

function DateFromKey(dateKey) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}
