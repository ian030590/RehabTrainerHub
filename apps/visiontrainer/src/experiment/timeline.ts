/**
 * jsPsych timeline dispatcher.
 *
 * Keep player-facing module runtime logic in the module-specific timeline
 * builders under experiment/timelines. This file only selects the builder for
 * the requested module.
 */
import type { BuildTimelineOverrides } from './timelines/types';

/**
 * Build a jsPsych timeline for the given module.
 * Each training module owns its plugin imports, settings mapping, and trials.
 */
export async function BuildTimeline(
  moduleId: string,
  overrides?: BuildTimelineOverrides,
): Promise<object[]> {
  switch (moduleId) {
    case 'moving-card': {
      const { BuildMovingCardTimeline } = await import('./timelines/movingCardTimeline');
      return BuildMovingCardTimeline(overrides);
    }
    case 'oculomotor-training': {
      const { BuildOculomotorTimeline } = await import('./timelines/oculomotorTimeline');
      return BuildOculomotorTimeline(overrides);
    }
    case 'gabor-patching': {
      const { BuildGaborPatchingTimeline } = await import('./timelines/gaborPatchingTimeline');
      return BuildGaborPatchingTimeline(overrides);
    }
    case 'reading-training': {
      const { BuildReadingTimeline } = await import('./timelines/readingTimeline');
      return BuildReadingTimeline(overrides);
    }
    case 'driving-rehab': {
      const { BuildDrivingRehabTimeline } = await import('./timelines/drivingRehabTimeline');
      return BuildDrivingRehabTimeline(overrides);
    }
    default: {
      console.warn(`Unknown module: ${moduleId}, falling back to moving-card`);
      const { BuildMovingCardTimeline } = await import('./timelines/movingCardTimeline');
      return BuildMovingCardTimeline(overrides);
    }
  }
}
