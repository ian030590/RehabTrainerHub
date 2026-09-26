import assert from 'node:assert/strict';
import test from 'node:test';
import { BuildReferenceDrill } from './referenceDrills.ts';
import { AngularDistanceDeg, ValidationThresholdDeg } from '../gaze/gazeScoring.ts';

const base = {
  runMode: 'evaluation', width: 800, height: 600, radiusPx: 20,
  speedArcminSec: 1000, viewingDistanceCm: 60, pxPerCmX: 15, pxPerCmY: 20,
  durationMs: 60_000, dwellMs: 500, holdMs: 2_000,
  changeMs: 500, directions: [0, 2],
};

test('reference drills use center cross, selected edge directions, and evaluation completion', () => {
  const pursuit = BuildReferenceDrill({ ...base, mode: 'pursuit' });
  assert.equal(pursuit.frameAt(0).phase, 'cross');
  assert.equal(pursuit.frameAt(1_000).phase, 'movement');
  assert.equal(pursuit.frameAt(1_500).direction, 0);
  assert.equal(pursuit.frameAt(pursuit.endMs - 1).direction, 2);
  assert.ok(pursuit.endMs < base.durationMs);
  const allDirections = BuildReferenceDrill({ ...base, mode: 'pursuit', directions: [0, 1, 2, 3, 4, 5, 6, 7] });
  assert.equal(allDirections.frameAt(0).direction, 1);
  assert.equal(allDirections.frameAt(3_000).direction, 7);

  const fixation = BuildReferenceDrill({ ...base, mode: 'fixation' });
  assert.equal(fixation.frameAt(2_500).phase, 'hold');
  assert.ok(fixation.endMs > pursuit.endMs);

  const saccade = BuildReferenceDrill({ ...base, mode: 'saccade' });
  assert.equal(saccade.frameAt(0).phase, 'cross');
  assert.equal(saccade.frameAt(1_000).phase, 'dwell');
  assert.equal(saccade.frameAt(1_500).direction, 2);
  assert.equal(saccade.frameAt(2_000).direction, 0);
  assert.equal(saccade.endMs, 13_000);

  const vor = BuildReferenceDrill({ ...base, mode: 'vor' });
  assert.deepEqual([vor.frameAt(500).x, vor.frameAt(500).y], [400, 300]);
  assert.equal(vor.endMs, base.durationMs);
});

test('random sequence excludes the previous direction and rejects empty selection', () => {
  const drill = BuildReferenceDrill({ ...base, mode: 'saccade', runMode: 'random', durationMs: 3_000, random: () => 0 });
  assert.notEqual(drill.frameAt(1_000).direction, drill.frameAt(1_500).direction);
  assert.throws(() => BuildReferenceDrill({ ...base, mode: 'saccade', directions: [] }));
});

test('five-point validation uses measured horizontal and vertical pixel scales', () => {
  const targets = Array.from({ length: 5 }, (_, index) => ({ x: 100 + index * 20, y: 100 }));
  const samples = targets.map((target) => Array.from({ length: 4 }, () => ({ x: target.x, y: target.y + 20 })));
  const result = ValidationThresholdDeg(samples, targets, 40, 60, 20);
  assert.equal(result?.validPoints, 5);
  assert.ok(result.meanErrorDeg > AngularDistanceDeg(samples[0][0], targets[0], 40, 60, 40));
  assert.equal(result.thresholdDeg, Math.max(0.5, result.meanErrorDeg * 2));
  assert.equal(ValidationThresholdDeg([[], ...samples.slice(1)], targets, 40, 60, 20), null);
});
