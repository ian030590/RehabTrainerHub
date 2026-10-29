import type { TrainerCategoryId, TrainingPurposeId } from '@rehab-trainer/hub-modules/catalog';

export const lobbyPageSize: 12;

export type LobbyFilterChip =
  | { key: string; kind: 'category'; id: TrainerCategoryId; purposeIds: TrainingPurposeId[] }
  | { key: string; kind: 'purpose'; id: TrainingPurposeId; purposeIds: TrainingPurposeId[] }
  | { key: string; kind: 'search'; query: string };

export function BuildLobbyFilterChips(
  selectedPurposes: readonly TrainingPurposeId[],
  query: string,
  categorySubcategories: Readonly<Record<TrainerCategoryId, readonly TrainingPurposeId[]>>,
): LobbyFilterChip[];

export function PaginateLobbyGames<T>(games: readonly T[], requestedPage: number): {
  items: T[];
  page: number;
  totalPages: number;
  start: number;
  end: number;
};

export function BuildLobbyPageNumbers(page: number, totalPages: number): (number | 'ellipsis')[];
