export type TrainerHubLifecyclePhase = 'ready' | 'started' | 'paused' | 'resumed' | 'completed' | 'aborted';
export type TrainerHubResultStatus = 'completed' | 'aborted';
export type TrainerHubMetric = number | boolean | null;

export interface TrainerHubAggregateResult {
  status?: TrainerHubResultStatus;
  score?: number;
  durationMs?: number;
  trialCount?: number;
  metrics?: Record<string, TrainerHubMetric>;
}

export interface TrainerHubGameBridge {
  readonly Ready: Promise<Readonly<{
    gameId: string;
    gameVersion: string;
    sessionId: string;
    sessionNonce: string;
  }>>;
  readonly IsConnected: boolean;
  AddCommandListener(listener: (event: { command: 'pause' | 'resume' | 'exit' }) => void): void;
  RemoveCommandListener(listener: (event: { command: 'pause' | 'resume' | 'exit' }) => void): void;
  ReportLifecycle(phase: TrainerHubLifecyclePhase, progress?: number): void;
  ReportResult(result: TrainerHubAggregateResult): void;
  Dispose(): void;
}

export interface RunTrainerHubJsPsychGameOptions {
  initJsPsych: (options: Record<string, unknown>) => {
    run(timeline: unknown[]): Promise<unknown>;
    getProgress?(): { percent_complete?: number };
    pauseExperiment?(): void;
    resumeExperiment?(): void;
    abortExperiment?(reason?: string): void;
  };
  timeline: unknown[];
  jsPsychOptions?: Record<string, unknown>;
  summarize: (jsPsych: unknown) => TrainerHubAggregateResult | Promise<TrainerHubAggregateResult>;
}

export function CreateTrainerHubGameBridge(): TrainerHubGameBridge;
export function NormalizeAggregateResult(
  value: TrainerHubAggregateResult,
  fallbackStatus?: TrainerHubResultStatus,
): Required<Pick<TrainerHubAggregateResult, 'status'>> & Omit<TrainerHubAggregateResult, 'status'>;
export function RunTrainerHubJsPsychGame(
  options: RunTrainerHubJsPsychGameOptions,
): Promise<{ jsPsych: unknown; result: TrainerHubAggregateResult }>;
