export function MergeHubGames<T extends { id: string }>(catalogGames: readonly T[], publishedGames: readonly T[], retainedCatalogIds?: ReadonlySet<string>): T[];
