/**
 * Compatibility export for existing Vision timeline code. Lifecycle
 * mechanics are owned by the renderer-independent shared module so Brain,
 * Motor, and Mouth setup modules can use the same contract without importing
 * a Vision runtime helper.
 */
export {
  CreateDefaultNativeTimelineResult,
  CreateNativeTimelineEngine,
  ThrowIfAborted,
} from '../shared/nativeTimelineEngine';
export type {
  NativeJsPsychLike,
  NativeTimelineEngineOptions,
} from '../shared/nativeTimelineEngine';
