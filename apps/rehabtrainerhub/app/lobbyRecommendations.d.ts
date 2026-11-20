interface LobbyFeatureIndex {
  games: Readonly<Record<string, unknown>>;
  similarityScores: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

interface LobbyRecommendation {
  gameId: string;
  reasonGameId: string;
  score: number;
}

export const lobbySimilarityThreshold: number;
export function RankLobbyRecommendations(
  history: unknown, featureIndex: LobbyFeatureIndex, launchableIds: readonly string[],
): LobbyRecommendation[];
