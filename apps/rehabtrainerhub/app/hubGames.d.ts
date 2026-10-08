export function MergeHubGames<T extends { id: string }>(catalogGames: readonly T[], publishedGames: readonly T[]): T[];
