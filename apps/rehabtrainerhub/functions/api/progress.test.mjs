import assert from 'node:assert/strict';
import {
  BuildProgressSummary,
  GetServerDate,
} from '../_lib/progress.js';

assert.equal(
  GetServerDate(new Date('2026-07-23T16:30:00.000Z'), 'Asia/Taipei'),
  '2026-07-24',
);

const activeSummary = BuildProgressSummary([
  CreateRow('2026-07-18', 'vision-training', 'moving-card'),
  CreateRow('2026-07-19', 'vision-training', 'moving-card'),
  CreateRow('2026-07-20', 'attention-training', 'reaction-time'),
  CreateRow('2026-07-21', 'attention-training', 'reaction-time'),
  CreateRow('2026-07-22', 'memory-training', 'memory-match'),
  CreateRow('2026-07-23', 'upper-limb-training', 'drawing-defense'),
  CreateRow('2026-07-24', 'upper-limb-training', 'drawing-defense'),
  CreateRow('2026-07-24', 'vision-training', 'moving-card'),
  CreateRow('2026-07-24', 'vision-training', 'moving-card'),
], '2026-07-24');

assert.equal(activeSummary.startedOn, '2026-07-18');
assert.equal(activeSummary.daysSinceStart, 7);
assert.equal(activeSummary.rehabilitationDays, 7);
assert.equal(activeSummary.totalRehabilitationDays, 7);
assert.equal(activeSummary.achievements[0].achieved, true);
assert.equal(activeSummary.achievements[1].achieved, false);
assert.deepEqual(
  activeSummary.dailyTasks.map((task) => [task.current, task.completed]),
  [[1, true], [3, true], [2, true]],
);
assert.deepEqual(
  activeSummary.recentModules.map((module) => module.moduleId),
  ['moving-card', 'reaction-time', 'memory-match'],
);

const interruptedSummary = BuildProgressSummary([
  CreateRow('2026-07-01', 'vision-training', 'moving-card'),
  CreateRow('2026-07-02', 'vision-training', 'moving-card'),
], '2026-07-24');

assert.equal(interruptedSummary.daysSinceStart, 24);
assert.equal(interruptedSummary.rehabilitationDays, 0);
assert.equal(interruptedSummary.achievements.some((achievement) => achievement.achieved), false);

console.log('progress calculations passed');

function CreateRow(trainingDate, moduleId, gameId) {
  return {
    training_date: trainingDate,
    module_id: moduleId,
    game_id: gameId,
  };
}
