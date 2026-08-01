// Types local to the Hub-owned VisionTrainer modules.
import type { TranslationKey } from '../../i18n';

export type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;

export interface DrivingEventResult {
  event_id: string;
  label: string;
  distance_m: number;
  rt_ms: number | null;
  raw_rt_ms?: number | null;
  reaction_frames?: number | null;
  valid: boolean;
  collision: boolean;
  brake_preheld: boolean;
  response: string;
}

export interface TrialData {
  trial_index: number;
  rt: number;
  correct: boolean;
  target: string;
  response: string;
  mode?: string;
  pattern?: string;
  acquired_targets?: number;
  average_fps?: number;
  display_refresh_hz?: number;
  display_refresh_ms?: number;
  refresh_sample_count?: number;
  refresh_measurement_valid?: boolean;
  duration_ms?: number;
  score?: number;
  trial_type?: string;
  reading_time?: number;
  response_text?: string;
  aoi_score?: number;
  average_rt?: number;
  median_rt?: number;
  valid_event_count?: number;
  reaction_event_count?: number;
  collisions?: number;
  lane_deviations?: number;
  rendering_quality?: string;
  control_mode?: string;
  route_id?: string;
  route_label?: string;
  route_progress?: number;
  driving_events?: DrivingEventResult[];
}
