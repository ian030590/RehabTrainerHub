import type { TranslationKey } from '../../i18n';

export type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;

export interface DrivingEventResult {
  event_id: string;
  label: string;
  distance_m: number;
  rt_ms: number | null;
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
  duration_ms?: number;
  score?: number;
  trial_type?: string;
  reading_time?: number;
  response_text?: string;
  aoi_score?: number;
  average_rt?: number;
  median_rt?: number;
  valid_event_count?: number;
  collisions?: number;
  lane_deviations?: number;
  route_progress?: number;
  driving_events?: DrivingEventResult[];
}
