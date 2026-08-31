import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AssertGamePublicationTransition,
  AssertGameReviewTransition,
  AssertGameScanTransition,
  CanRequestGameManualReview,
  CanPublishGameRelease,
  CanTransitionGameScanStatus,
  GetGamePublicationBlockReason,
} from '../apps/rehabtrainerhub/functions/_lib/gameValidationState.js';

test('scan retries only from infrastructure failure', () => {
  assert.equal(AssertGameScanTransition('queued', 'running'), 'running');
  assert.equal(AssertGameScanTransition('running', 'failed'), 'failed');
  assert.equal(AssertGameScanTransition('failed', 'queued'), 'queued');
  assert.equal(CanTransitionGameScanStatus('passed', 'queued'), false);
  assert.throws(() => AssertGameScanTransition('passed', 'queued'));
});

test('review and publication axes are independent and cannot bypass hard blocks', () => {
  assert.equal(AssertGameReviewTransition('requested', 'in_review'), 'in_review');
  assert.equal(AssertGameReviewTransition('in_review', 'approved'), 'approved');
  assert.equal(AssertGamePublicationTransition('unpublished', 'publishing'), 'publishing');
  assert.equal(CanPublishGameRelease({
    scan: 'passed',
    review: 'approved',
    publication: 'unpublished',
    hasHardBlock: false,
  }), true);
  assert.equal(CanPublishGameRelease({
    scan: 'passed',
    review: 'approved',
    publication: 'unpublished',
    hasHardBlock: true,
  }), false);
  assert.equal(CanRequestGameManualReview({
    scan: 'flagged',
    review: 'not_requested',
    eligibleFindingCount: 1,
    hasHardBlock: false,
  }), true);
  assert.equal(CanRequestGameManualReview({
    scan: 'flagged',
    review: 'not_requested',
    eligibleFindingCount: 1,
    hasHardBlock: true,
  }), false);
  assert.equal(GetGamePublicationBlockReason({
    scan: 'passed',
    review: 'approved',
    publication: 'unpublished',
    hasHardBlock: false,
  }), null);
  assert.equal(GetGamePublicationBlockReason({
    scan: 'passed',
    review: 'approved',
    publication: 'unpublished',
    hasHardBlock: true,
  }), 'hard-block');
});
