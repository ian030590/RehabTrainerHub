import { gameValidationFindingDispositions } from '@rehab-trainer/training-contracts';

const scanTransitions = Object.freeze({
  queued: Object.freeze(['running']),
  running: Object.freeze(['passed', 'flagged', 'failed']),
  passed: Object.freeze([]),
  flagged: Object.freeze([]),
  failed: Object.freeze(['queued']),
});

const reviewTransitions = Object.freeze({
  not_requested: Object.freeze(['requested']),
  requested: Object.freeze(['in_review']),
  in_review: Object.freeze(['changes_requested', 'approved', 'rejected']),
  changes_requested: Object.freeze(['requested']),
  approved: Object.freeze([]),
  rejected: Object.freeze([]),
});

const publicationTransitions = Object.freeze({
  unpublished: Object.freeze(['publishing']),
  publishing: Object.freeze(['published', 'unpublished']),
  published: Object.freeze(['revoked']),
  revoked: Object.freeze([]),
});

export const gameValidationStatuses = Object.freeze({
  scan: Object.freeze(Object.keys(scanTransitions)),
  review: Object.freeze(Object.keys(reviewTransitions)),
  publication: Object.freeze(Object.keys(publicationTransitions)),
});

export { gameValidationFindingDispositions };

export function CanTransitionGameScanStatus(from, to) {
  return HasTransition(scanTransitions, from, to);
}

export function CanTransitionGameReviewStatus(from, to) {
  return HasTransition(reviewTransitions, from, to);
}

export function CanTransitionGamePublicationStatus(from, to) {
  return HasTransition(publicationTransitions, from, to);
}

export function AssertGameScanTransition(from, to) {
  return AssertTransition('scan', scanTransitions, from, to);
}

export function AssertGameReviewTransition(from, to) {
  return AssertTransition('review', reviewTransitions, from, to);
}

export function AssertGamePublicationTransition(from, to) {
  return AssertTransition('publication', publicationTransitions, from, to);
}

export function CanPublishGameRelease({ scan, review, publication, hasHardBlock }) {
  return scan === 'passed'
    && review === 'approved'
    && publication === 'unpublished'
    && hasHardBlock !== true;
}

export function CanRequestGameManualReview({ scan, review, eligibleFindingCount, hasHardBlock }) {
  return (scan === 'flagged' || scan === 'passed')
    && (review === 'not_requested' || review === 'changes_requested')
    && Number.isSafeInteger(eligibleFindingCount)
    && eligibleFindingCount > 0
    && hasHardBlock !== true;
}

export function GetGamePublicationBlockReason({ scan, review, publication, hasHardBlock }) {
  if (hasHardBlock === true) return 'hard-block';
  if (scan !== 'passed') return 'scan-not-passed';
  if (review !== 'approved') return 'review-not-approved';
  if (publication !== 'unpublished') return 'publication-not-unpublished';
  return null;
}

function HasTransition(table, from, to) {
  return Object.hasOwn(table, from) && table[from].includes(to);
}

function AssertTransition(axis, table, from, to) {
  if (!HasTransition(table, from, to)) {
    throw new TypeError(`Invalid game ${axis} transition: ${from} -> ${to}.`);
  }
  return to;
}
